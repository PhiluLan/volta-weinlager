"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Ref<T> = T | T[] | null;
type RequestRow = { id: string; request_type: "reorder" | "suggestion"; title: string; supplier: string | null; vintage: string | null; desired_quantity: number | null; note: string | null; status: "open" | "handled"; created_at: string; created_by: string; location: Ref<{ name: string }>; wine: Ref<{ name: string; producer: string | null }> };
const one = <T,>(value: Ref<T>) => Array.isArray(value) ? value[0] : value;
const dateLabel = (value: string) => new Date(value).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"open" | "handled">("open");

  async function loadRequests() {
    const [requestResult, profileResult] = await Promise.all([
      supabase.from("purchase_requests").select("id,request_type,title,supplier,vintage,desired_quantity,note,status,created_at,created_by,location:locations(name),wine:wines(name,producer)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,email"),
    ]);
    if (requestResult.error) setNotice(requestResult.error.message);
    setRequests((requestResult.data ?? []) as RequestRow[]);
    setEmails(Object.fromEntries((profileResult.data ?? []).map((profile) => [profile.id, profile.email])));
    setLoading(false);
  }
  useEffect(() => { let mounted = true; supabase.auth.getUser().then(async ({ data: { user } }) => { if (!user) { router.push("/"); return; } const own = await supabase.from("profiles").select("role").eq("id", user.id).single(); if (own.data?.role !== "super_admin") { setNotice("Nur der Super-Admin darf Anfragen sehen."); setLoading(false); return; } if (mounted) await loadRequests(); }); return () => { mounted = false; }; }, [router]);
  const visibleRequests = useMemo(() => requests.filter((request) => request.status === filter), [filter, requests]);
  async function markHandled(id: string) { const { error } = await supabase.from("purchase_requests").update({ status: "handled", handled_at: new Date().toISOString() }).eq("id", id); if (error) { setNotice(error.message); return; } setRequests((items) => items.map((item) => item.id === id ? { ...item, status: "handled" } : item)); setNotice("Anfrage als erledigt markiert"); }
  async function signOut() { await supabase.auth.signOut(); router.push("/"); }

  if (loading) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Anfragen werden geladen …</h1></div></main>;
  if (notice && !requests.length) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Zugriff verweigert</h1><p>{notice}</p><button className="primary-button auth-submit" onClick={signOut}>Abmelden</button></div></main>;
  return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => router.push("/")}>← Dashboard</button><div className="top-actions"><button className="secondary-button" onClick={signOut}>Abmelden</button></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Super-Admin · Sortiment</div><h1>Anfragen</h1><p>Nachbestellungen und Weinvorschläge der Betriebe bearbeiten.</p></div></div>{notice && <div className="toast">✓ {notice}</div>}<div className="business-tabs"><button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>Offen ({requests.filter((item) => item.status === "open").length})</button><button className={filter === "handled" ? "active" : ""} onClick={() => setFilter("handled")}>Erledigt ({requests.filter((item) => item.status === "handled").length})</button></div><section className="inventory-panel requests-panel"><div className="panel-heading"><div><h2>{filter === "open" ? "Offene Anfragen" : "Erledigte Anfragen"}</h2><p>{filter === "open" ? "Bitte prüfen und anschliessend als erledigt markieren." : "Archiv der bearbeiteten Anfragen."}</p></div><span className="snapshot-badge">Live verbunden</span></div>{visibleRequests.length === 0 ? <p className="empty-cart">Keine {filter === "open" ? "offenen" : "erledigten"} Anfragen vorhanden.</p> : <div className="request-list">{visibleRequests.map((request) => <article className="request-card" key={request.id}><div className="request-card-head"><div><span className={`request-type ${request.request_type}`}>{request.request_type === "reorder" ? "Nachbestellung" : "Weinvorschlag"}</span><h3>{request.title}</h3><p>{one(request.location)?.name ?? "Unbekannter Betrieb"} · {emails[request.created_by] ?? "Unbekannter Benutzer"}<br />{dateLabel(request.created_at)}</p></div><span className={`order-status ${request.status === "handled" ? "approved" : "submitted"}`}>{request.status === "handled" ? "Erledigt" : "Offen"}</span></div>{request.request_type === "suggestion" && <p className="request-wine">Lieferant: {request.supplier || "–"}{request.vintage ? ` · Jahrgang ${request.vintage}` : ""}{request.desired_quantity ? ` · Gewünscht: ${request.desired_quantity} Kartons` : ""}</p>}{request.wine && <p className="request-wine">Wein im Sortiment: {one(request.wine)?.name}{one(request.wine)?.producer ? ` · ${one(request.wine)?.producer}` : ""}</p>}{request.note && <p className="request-note">{request.note}</p>}{request.status === "open" && <button className="primary-button request-complete" onClick={() => markHandled(request.id)}>✓ Als erledigt markieren</button>}</article>)}</div>}</section></div></main>;
}
