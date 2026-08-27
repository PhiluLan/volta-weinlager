"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { supabase } from "../../../lib/supabase";

type Ref<T> = T | T[] | null;
type OrderItem = { cartons: number; bottles_per_carton: number | null; unit_price: number | null; wine: Ref<{ name: string; purchase_price: number | null; cartons_per_case: number | null }> };
type Order = { id: string; status: string; created_at: string; delivery_date: string | null; location: Ref<{ name: string }>; order_items: OrderItem[] };
type Report = { name: string; orders: Order[]; cartons: number; total: number };

const one = <T,>(value: Ref<T>) => Array.isArray(value) ? value[0] : value;
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("de-CH", { month: "long", year: "numeric" });
const dateLabel = (value: string | null) => value ? new Date(`${value.includes("T") ? value : `${value}T12:00:00`}`).toLocaleDateString("de-CH", { dateStyle: "medium" }) : "nicht erfasst";
const money = (value: number) => `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const bottlePrice = (item: OrderItem) => item.unit_price ?? one(item.wine)?.purchase_price ?? 0;
const itemBottles = (item: OrderItem) => item.bottles_per_carton ?? one(item.wine)?.cartons_per_case ?? 1;
const itemPrice = (item: OrderItem) => bottlePrice(item) * itemBottles(item);
const itemAmount = (item: OrderItem) => item.cartons * itemPrice(item);

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
      const result = await supabase.from("orders").select("id,status,created_at,delivery_date,location:locations(name),order_items(cartons,bottles_per_carton,unit_price,wine:wines(name,purchase_price,cartons_per_case))").order("delivery_date", { ascending: false });
      if (!mounted) return;
      if (result.error) setNotice(result.error.message); else setOrders((result.data ?? []) as Order[]);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => { const reset = () => setPrintLocation(null); window.addEventListener("afterprint", reset); return () => window.removeEventListener("afterprint", reset); }, []);

  const reports = useMemo<Report[]>(() => {
    const grouped = new Map<string, Report>();
    orders.filter((order) => order.status !== "cancelled" && order.delivery_date?.startsWith(month)).forEach((order) => {
      const name = one(order.location)?.name ?? "Unbekannter Betrieb";
      if (locationFilter !== "Alle Betriebe" && locationFilter !== name) return;
      const items = order.order_items ?? [];
      const current = grouped.get(name) ?? { name, orders: [], cartons: 0, total: 0 };
      grouped.set(name, { ...current, orders: [...current.orders, order], cartons: current.cartons + items.reduce((sum, item) => sum + item.cartons, 0), total: current.total + items.reduce((sum, item) => sum + itemAmount(item), 0) });
    });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [locationFilter, month, orders]);

  const locations = [...new Set(orders.map((order) => one(order.location)?.name).filter((name): name is string => Boolean(name)))].sort();
  const total = reports.reduce((sum, report) => sum + report.total, 0);
  const cartons = reports.reduce((sum, report) => sum + report.cartons, 0);

  function printReport(location: string) { setPrintLocation(location); window.requestAnimationFrame(() => window.print()); }

  function downloadReport(report: Report) {
    const doc = new jsPDF();
    const left = 14; const right = 196; let y = 18;
    const header = () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.text("Volta Weinlager", left, y);
      doc.setFontSize(14); doc.text("Monatliche Abrechnung", left, y + 9);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Betrieb: ${report.name}`, left, y + 18); doc.text(`Liefermonat: ${monthLabel(month)}`, left, y + 24);
      doc.setDrawColor(200, 193, 193); doc.line(left, y + 30, right, y + 30);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("LIEFERUNG", left, y + 38); doc.text("BESTELLUNG", 43, y + 38); doc.text("WEIN / POSITION", 75, y + 38); doc.text("MENGE", 151, y + 38); doc.text("BETRAG", right, y + 38, { align: "right" }); y += 45;
    };
    header();
    report.orders.forEach((order) => (order.order_items ?? []).forEach((item) => {
      const wine = one(item.wine)?.name ?? "Unbekannter Wein"; const amount = itemAmount(item); const lines = doc.splitTextToSize(wine, 68);
      if (y > 270) { doc.addPage(); y = 18; header(); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(dateLabel(order.delivery_date), left, y); doc.text(dateLabel(order.created_at), 43, y); doc.text(lines, 75, y); doc.text(`${item.cartons} Kart.`, 151, y); doc.setFont("helvetica", "bold"); doc.text(money(amount), right, y, { align: "right" }); y += Math.max(7, lines.length * 5) + 3;
    }));
    if (y > 270) { doc.addPage(); y = 18; }
    doc.setDrawColor(150, 143, 143); doc.line(left, y, right, y); y += 9; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Total ${report.name}`, left, y); doc.text(money(report.total), right, y, { align: "right" }); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`${report.cartons} Kartons · Liefermonat ${monthLabel(month)}`, left, y + 8);
    doc.save(`Volta-Weinlager-Abrechnung-${report.name}-${month}.pdf`);
  }

  async function signOut() { await supabase.auth.signOut(); router.push("/"); }
  if (loading) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Abrechnung wird geladen …</h1></div></main>;
  if (notice && orders.length === 0) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Zugriff verweigert</h1><p>{notice}</p><button className="primary-button auth-submit" onClick={signOut}>Abmelden</button></div></main>;

  return <main className="inventory-page"><header className="inventory-top no-print"><button className="back-button" onClick={() => router.push("/")}>← Dashboard</button><div className="top-actions"><button className="secondary-button" onClick={signOut}>Abmelden</button></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Super-Admin · Buchhaltung</div><h1>Monatliche Abrechnung</h1><p>Strukturierte Monatsübersicht nach tatsächlichem Lieferdatum.</p></div></div><section className="inventory-panel accounting-controls no-print"><label>Liefermonat<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Betrieb<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option>Alle Betriebe</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label></section><section className="accounting-summary"><div><strong>{money(total)}</strong><span>Gesamtbetrag · {monthLabel(month)}</span></div><div><strong>{cartons}</strong><span>Gelieferte Kartons</span></div><div><strong>{reports.length}</strong><span>Betriebe mit Lieferungen</span></div></section>{reports.length === 0 ? <section className="inventory-panel"><p className="empty-cart">Keine Bestellungen mit Lieferdatum im ausgewählten Monat.</p></section> : <div className="accounting-reports">{reports.map((report) => <section className={`inventory-panel accounting-report ${printLocation === report.name ? "accounting-print-target" : ""}`} key={report.name}><div className="accounting-report-head"><div><div className="eyebrow">Monatsabrechnung · Liefermonat {monthLabel(month)}</div><h2>{report.name}</h2><p>{report.orders.length} Bestellung{report.orders.length === 1 ? "" : "en"} · {report.cartons} Kartons · <strong>{money(report.total)}</strong></p></div><div className="no-print accounting-actions"><button className="secondary-button" onClick={() => printReport(report.name)}>🖨 Drucken</button><button className="primary-button" onClick={() => downloadReport(report)}>↓ PDF herunterladen</button></div></div><div className="accounting-table"><div className="accounting-row accounting-head"><span>Lieferung / Bestellung</span><span>Bestellte Weine</span><span>Menge</span><span>Preis / Flasche</span><span>Betrag</span></div>{report.orders.flatMap((order) => (order.order_items ?? []).map((item, index) => { return <div className="accounting-row" key={`${order.id}-${index}`}><div><strong>{dateLabel(order.delivery_date)}</strong><small>Bestellt: {dateLabel(order.created_at)}</small></div><div><strong>{one(item.wine)?.name ?? "Unbekannter Wein"}</strong><small>{report.name}</small></div><span>{item.cartons} Kartons · {itemBottles(item)} Flaschen</span><span>{money(bottlePrice(item))}</span><strong>{money(itemAmount(item))}</strong></div>; }))}</div><div className="accounting-total"><span>Monatstotal · {report.name}</span><strong>{money(report.total)}</strong></div></section>)}</div>}<p className="demo-note no-print">Bestell- und Liefermonat werden bewusst getrennt geführt. Massgebend für diese Abrechnung ist immer das Lieferdatum.</p></div></main>;
}
