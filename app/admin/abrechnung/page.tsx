"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Ref<T> = T | T[] | null;
type OrderItem = { cartons: number; unit_price: number | null; wine: Ref<{ name: string; purchase_price: number | null }> };
type Order = { id: string; status: string; created_at: string; delivery_date: string | null; location: Ref<{ name: string }>; order_items: OrderItem[] };

function one<T>(value: Ref<T>) { return Array.isArray(value) ? value[0] : value; }
function monthLabel(month: string) { return new Date(`${month}-01T12:00:00`).toLocaleDateString("de-CH", { month: "long", year: "numeric" }); }
function money(value: number) { return `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function AccountingPage() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [orders, setOrders] = useState<Order[]>([]);
  const [locationFilter, setLocationFilter] = useState("Alle Betriebe");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [printLocation, setPrintLocation] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/"); return; }
      const profile = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile.data?.role !== "super_admin") { setNotice("Nur der Super-Admin darf die Abrechnung sehen."); setLoading(false); return; }
      const result = await supabase.from("orders").select("id,status,created_at,delivery_date,location:locations(name),order_items(cartons,unit_price,wine:wines(name,purchase_price))").order("delivery_date", { ascending: false });
      if (!mounted) return;
      if (result.error) setNotice(result.error.message); else setOrders((result.data ?? []) as Order[]);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => { const reset = () => setPrintLocation(null); window.addEventListener("afterprint", reset); return () => window.removeEventListener("afterprint", reset); }, []);

  const reports = useMemo(() => {
    const grouped = new Map<string, { name: string; orders: Order[]; cartons: number; total: number }>();
    orders.filter((order) => order.status !== "cancelled" && order.delivery_date?.startsWith(month)).forEach((order) => {
      const name = one(order.location)?.name ?? "Unbekannter Betrieb";
      if (locationFilter !== "Alle Betriebe" && locationFilter !== name) return;
      const items = order.order_items ?? [];
      const cartons = items.reduce((sum, item) => sum + item.cartons, 0);
      const total = items.reduce((sum, item) => sum + item.cartons * (item.unit_price ?? one(item.wine)?.purchase_price ?? 0), 0);
      const current = grouped.get(name) ?? { name, orders: [], cartons: 0, total: 0 };
      grouped.set(name, { ...current, orders: [...current.orders, order], cartons: current.cartons + cartons, total: current.total + total });
    });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [locationFilter, month, orders]);

  const locations = [...new Set(orders.map((order) => one(order.location)?.name).filter((name): name is string => Boolean(name)))].sort();
  const total = reports.reduce((sum, report) => sum + report.total, 0);
  const cartons = reports.reduce((sum, report) => sum + report.cartons, 0);

  function printReport(location: string) { setPrintLocation(location); window.requestAnimationFrame(() => window.print()); }
  async function signOut() { await supabase.auth.signOut(); router.push("/"); }

  if (loading) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Abrechnung wird geladen …</h1></div></main>;
  if (notice && orders.length === 0) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Zugriff verweigert</h1><p>{notice}</p><button className="primary-button auth-submit" onClick={signOut}>Abmelden</button></div></main>;

  return <main className="inventory-page"><header className="inventory-top no-print"><button className="back-button" onClick={() => router.push("/")}>← Dashboard</button><div className="top-actions"><button className="secondary-button" onClick={signOut}>Abmelden</button></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Super-Admin · Buchhaltung</div><h1>Monatliche Abrechnung</h1><p>Auswertung nach Liefermonat — unabhängig vom Bestelldatum.</p></div></div><section className="inventory-panel accounting-controls no-print"><label>Liefermonat<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Betrieb<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option>Alle Betriebe</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label></section><section className="accounting-summary"><div><strong>{money(total)}</strong><span>Gesamtbetrag · {monthLabel(month)}</span></div><div><strong>{cartons}</strong><span>Bestellte Kartons</span></div><div><strong>{reports.length}</strong><span>Betriebe mit Lieferungen</span></div></section>{reports.length === 0 ? <section className="inventory-panel"><p className="empty-cart">Keine Bestellungen mit Lieferdatum im ausgewählten Monat.</p></section> : <div className="accounting-reports">{reports.map((report) => <section className={`inventory-panel accounting-report ${printLocation === report.name ? "accounting-print-target" : ""}`} key={report.name}><div className="accounting-report-head"><div><div className="eyebrow">Liefermonat {monthLabel(month)}</div><h2>{report.name}</h2><p>{report.orders.length} Bestellung{report.orders.length === 1 ? "" : "en"} · {report.cartons} Kartons · <strong>{money(report.total)}</strong></p></div><div className="no-print accounting-actions"><button className="secondary-button" onClick={() => printReport(report.name)}>🖨 Abrechnung drucken / PDF</button></div></div><div className="accounting-table"><div className="accounting-row accounting-head"><span>Bestellung / Lieferung</span><span>Bestellte Weine</span><span>Betrag</span></div>{report.orders.map((order) => { const items = order.order_items ?? []; const amount = items.reduce((sum, item) => sum + item.cartons * (item.unit_price ?? one(item.wine)?.purchase_price ?? 0), 0); return <div className="accounting-row" key={order.id}><div><strong>{new Date(order.created_at).toLocaleDateString("de-CH", { dateStyle: "medium" })}</strong><small>Lieferung: {order.delivery_date ? new Date(`${order.delivery_date}T12:00:00`).toLocaleDateString("de-CH", { dateStyle: "medium" }) : "nicht erfasst"}</small></div><div>{items.map((item, index) => <span key={`${order.id}-${index}`}>{one(item.wine)?.name ?? "Unbekannter Wein"} · {item.cartons} Kartons</span>)}</div><strong>{money(amount)}</strong></div>; })}</div><div className="accounting-total"><span>Total {report.name}</span><strong>{money(report.total)}</strong></div></section>)}</div>}<p className="demo-note no-print">Die Abrechnung wird nach Lieferdatum gruppiert. Eine Bestellung Ende Juli mit Lieferung am ersten Montag im August erscheint deshalb in der August-Abrechnung.</p></div></main>;
}
