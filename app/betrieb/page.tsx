"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import { supabase } from "../../lib/supabase";
import OrderHistoryView from "./order-history-view";
import SuggestionView from "./suggestion-view";

type Ref<T> = T | T[] | null;
type Wine = { id: string; name: string; producer: string | null; category: string; stock: number; purchase_price: number | null; cartons_per_case?: number | null };
type OrderItem = { cartons: number; bottles_per_carton: number | null; unit_price: number | null; wine: Ref<{ name: string; purchase_price: number | null; cartons_per_case: number | null }> };
type Order = { id: string; status: string; created_at: string; delivery_date: string | null; order_items: OrderItem[] };
type View = "order" | "inventory" | "history" | "monthly" | "suggestion";

const one = <T,>(value: Ref<T>) => Array.isArray(value) ? value[0] : value;
const money = (value: number) => `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string | null) => value ? new Date(`${value.includes("T") ? value : `${value}T12:00:00`}`).toLocaleDateString("de-CH", { dateStyle: "medium" }) : "nicht erfasst";
const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString("de-CH", { month: "long", year: "numeric" });
const bottlePrice = (item: OrderItem) => item.unit_price ?? one(item.wine)?.purchase_price ?? 0;
const itemBottles = (item: OrderItem) => item.bottles_per_carton ?? one(item.wine)?.cartons_per_case ?? 1;
const itemPrice = (item: OrderItem) => bottlePrice(item) * itemBottles(item);
const itemAmount = (item: OrderItem) => item.cartons * itemPrice(item);
function nextDeliveryDate() { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() + (day === 1 ? 7 : 8 - (day || 7))); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function groupForCategory(category: string) { const value = category.toLowerCase(); if (value.includes("schaum")) return "sparkling"; if (value.includes("weiss") || value.includes("weiß") || value.includes("rosé") || value.includes("rose")) return "white"; if (value.includes("rot")) return "red"; return "other"; }

const groups = [
  { key: "sparkling", label: "Schaumweine", description: "Prosecco, Cava und alkoholfreie Schaumweine" },
  { key: "white", label: "Weissweine", description: "Weissweine und Roséweine" },
  { key: "red", label: "Rotweine", description: "Rotweine aus dem Zentrallager" },
  { key: "other", label: "Spirituosen / Sonstiges", description: "Weitere Artikel und Spezialitäten" },
];

export default function BetriebPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<{ id: string; email: string; location_id: string; location_name: string } | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("order");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (!user) { router.push("/"); return; }
      const { data: ownProfile } = await supabase.from("profiles").select("id,email,location_id,favorite_wine_ids,locations(name)").eq("id", user.id).single();
      if (!ownProfile?.location_id) { setNotice("Dein Benutzer ist noch keinem Betrieb zugeordnet."); setSessionReady(true); setLoading(false); return; }
      const location = await supabase.from("locations").select("id,name").eq("id", ownProfile.location_id).single();
      const wineRows = await supabase.from("wines").select("id,name,producer,category,purchase_price,cartons_per_case").eq("active", true).order("name");
      const central = await supabase.from("locations").select("id").eq("name", "Zentrallager").single();
      const balances = await supabase.from("stock_balances").select("wine_id,cartons").eq("location_id", central.data?.id);
      const ownOrders = await supabase.from("orders").select("id,status,created_at,delivery_date,order_items(cartons,bottles_per_carton,unit_price,wine:wines(name,purchase_price,cartons_per_case))").eq("location_id", ownProfile.location_id).order("created_at", { ascending: false });
      if (!mounted) return;
      const balanceMap = Object.fromEntries((balances.data ?? []).map((balance) => [balance.wine_id, balance.cartons]));
      setProfile({ id: ownProfile.id, email: ownProfile.email, location_id: ownProfile.location_id, location_name: location.data?.name ?? "Betrieb" });
      setWines((wineRows.data ?? []).map((wine) => ({ ...wine, stock: balanceMap[wine.id] ?? 0 })) as Wine[]);
      setOrders((ownOrders.data ?? []) as Order[]);
      setFavorites(ownProfile.favorite_wine_ids ?? []);
      setSessionReady(true); setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  const filteredWines = useMemo(() => wines.filter((wine) => `${wine.name} ${wine.producer ?? ""} ${wine.category}`.toLowerCase().includes(query.toLowerCase())), [wines, query]);
  const favoriteWines = useMemo(() => filteredWines.filter((wine) => favorites.includes(wine.id)), [favorites, filteredWines]);
  const reportOrders = useMemo(() => orders.filter((order) => order.status !== "cancelled" && order.delivery_date?.startsWith(month)), [month, orders]);
  const reportTotal = reportOrders.reduce((sum, order) => sum + (order.order_items ?? []).reduce((subtotal, item) => subtotal + itemAmount(item), 0), 0);
  const reportCartons = reportOrders.reduce((sum, order) => sum + (order.order_items ?? []).reduce((subtotal, item) => subtotal + item.cartons, 0), 0);

  async function toggleFavorite(id: string) { if (!profile) return; const next = favorites.includes(id) ? favorites.filter((favorite) => favorite !== id) : [...favorites, id]; setFavorites(next); const { error } = await supabase.from("profiles").update({ favorite_wine_ids: next }).eq("id", profile.id); if (error) setNotice("Favoriten konnten nicht gespeichert werden"); }
  async function requestReorder(wine: Wine) { if (!profile) return; const { error } = await supabase.from("purchase_requests").insert({ request_type: "reorder", wine_id: wine.id, location_id: profile.location_id, created_by: profile.id, title: wine.name, note: `Bitte ${wine.name} nachbestellen.` }); setNotice(error ? "Nachbestellung konnte nicht gemeldet werden" : `Nachbestellung für ${wine.name} an Philipp gemeldet`); }
  async function submitOrder() {
    if (!profile || !Object.keys(cart).length) return;
    const deliveryDate = nextDeliveryDate();
    const { data: order, error } = await supabase.from("orders").insert({ location_id: profile.location_id, status: "submitted", delivery_date: deliveryDate, created_by: (await supabase.auth.getUser()).data.user?.id }).select("id").single();
    if (error || !order) { setNotice(error?.message ?? "Bestellung konnte nicht angelegt werden"); return; }
    const itemError = await supabase.from("order_items").insert(Object.entries(cart).map(([wineId, cartons]) => ({ order_id: order.id, wine_id: wineId, cartons, bottles_per_carton: wines.find((wine) => wine.id === wineId)?.cartons_per_case ?? 1, unit_price: wines.find((wine) => wine.id === wineId)?.purchase_price ?? 0 })));
    if (itemError.error) { setNotice(itemError.error.message); return; }
    const submitError = await supabase.rpc("submit_order", { p_order_id: order.id });
    if (submitError.error) { setNotice(submitError.error.message); return; }
    setWines((items) => items.map((wine) => ({ ...wine, stock: wine.stock - (cart[wine.id] ?? 0) }))); setCart({}); setView("history"); setNotice(`Bestellung übermittelt · Lieferung am ${dateLabel(deliveryDate)}`);
    const refreshed = await supabase.from("orders").select("id,status,created_at,delivery_date,order_items(cartons,bottles_per_carton,unit_price,wine:wines(name,purchase_price,cartons_per_case))").eq("location_id", profile.location_id).order("created_at", { ascending: false });
    setOrders((refreshed.data ?? []) as Order[]);
  }
  async function signOut() { await supabase.auth.signOut(); router.push("/"); }
  function downloadMonthlyPdf() {
    if (!profile) return;
    const doc = new jsPDF(); let y = 18; const right = 196;
    doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.text("Volta Weinlager", 14, y); doc.setFontSize(14); doc.text("Monatliche Bestellübersicht", 14, y + 9); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Betrieb: ${profile.location_name}`, 14, y + 18); doc.text(`Liefermonat: ${monthLabel(month)}`, 14, y + 24); doc.setDrawColor(200, 193, 193); doc.line(14, y + 30, right, y + 30); y += 42;
    reportOrders.forEach((order) => (order.order_items ?? []).forEach((item) => { const amount = itemAmount(item); const wine = one(item.wine)?.name ?? "Unbekannter Wein"; if (y > 270) { doc.addPage(); y = 18; } doc.setFontSize(9); doc.text(dateLabel(order.delivery_date), 14, y); doc.text(dateLabel(order.created_at), 52, y); doc.text(doc.splitTextToSize(wine, 75), 88, y); doc.text(`${item.cartons} Kart.`, 153, y); doc.setFont("helvetica", "bold"); doc.text(money(amount), right, y, { align: "right" }); doc.setFont("helvetica", "normal"); y += 8; }));
    if (y > 270) { doc.addPage(); y = 18; } doc.line(14, y, right, y); y += 9; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Total ${profile.location_name}`, 14, y); doc.text(money(reportTotal), right, y, { align: "right" }); doc.save(`Volta-Weinlager-${profile.location_name}-${month}.pdf`);
  }

  function renderWine(wine: Wine, ordering: boolean) { return <div className={`business-wine ${wine.stock === 0 ? "out-of-stock" : ""}`} key={wine.id}><div className="business-wine-main"><button className="favorite-button" onClick={() => toggleFavorite(wine.id)} aria-label={favorites.includes(wine.id) ? "Favorit entfernen" : "Als Favorit markieren"}>{favorites.includes(wine.id) ? "★" : "☆"}</button><div><strong>{wine.name}</strong><small>{wine.producer ?? "–"} · {wine.category}</small></div></div><b>{wine.stock} <em>Kartons</em></b>{ordering && <div className="business-controls"><button disabled={!cart[wine.id]} onClick={() => setCart((items) => ({ ...items, [wine.id]: Math.max(0, (items[wine.id] ?? 0) - 1) }))}>−</button><span>{cart[wine.id] ?? 0}</span><button disabled={wine.stock <= (cart[wine.id] ?? 0)} onClick={() => setCart((items) => ({ ...items, [wine.id]: (items[wine.id] ?? 0) + 1 }))}>＋</button></div>}{!ordering && <button className="reorder-button" onClick={() => requestReorder(wine)}>↻ Nachbestellen</button>}</div>; }
  function renderGroups(ordering: boolean) { return <div className="inventory-groups">{groups.map((group) => { const groupWines = (favoriteOnly && ordering ? favoriteWines : filteredWines).filter((wine) => groupForCategory(wine.category) === group.key); if (!groupWines.length) return null; return <section className={`inventory-group inventory-group-${group.key}`} key={group.key}><div className="inventory-group-heading"><div><span className="inventory-group-kicker">Sortiment</span><h3>{group.label}</h3><p>{group.description}</p></div><strong>{groupWines.length} <small>Artikel</small></strong></div><div className="business-wines">{groupWines.map((wine) => renderWine(wine, ordering))}</div></section>; })}</div>; }

  if (!sessionReady || loading) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Weinlager wird geladen …</h1></div></main>;
  if (!profile) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Kein Betrieb zugeordnet</h1><p>{notice || "Bitte wende dich an den Super-Admin."}</p><button className="primary-button auth-submit" onClick={signOut}>Abmelden</button></div></main>;
  const selectedView = view as View;
  if (selectedView === "history") return <OrderHistoryView profile={profile} orders={orders} onView={setView} onSignOut={signOut} />;
  if (selectedView === "suggestion") return <SuggestionView profile={profile} onView={setView} onSignOut={signOut} onSent={(message) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); }} />;

  return <main className="business-page"><header className="business-top"><div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">{profile.location_name}</div></div></div><div className="business-user"><span>{profile.email}</span><button onClick={signOut}>Abmelden</button></div></header><div className="business-content"><div className="page-heading"><div><div className="eyebrow">{profile.location_name} · Persönlicher Bereich</div><h1>{view === "order" ? "Weinbestellung" : view === "inventory" ? "Zentrallagerbestand" : view === "monthly" ? "Meine Monatsübersicht" : "Meine Bestellungen"}</h1><p>Bestellen, Bestand prüfen und eigene Bestellungen nachvollziehen.</p></div></div><div className="business-tabs"><button className={view === "order" ? "active" : ""} onClick={() => setView("order")}>Neue Bestellung</button><button className={view === "inventory" ? "active" : ""} onClick={() => setView("inventory")}>Bestand</button><button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>Meine Bestellungen</button><button className={view === "monthly" ? "active" : ""} onClick={() => setView("monthly")}>Monatsübersicht</button><button className={view === "suggestion" ? "active" : ""} onClick={() => setView("suggestion")}>Wein vorschlagen</button></div>{notice && <div className="toast business-toast">✓ {notice}</div>}
    {view === "monthly" ? <section className="inventory-panel business-monthly"><div className="monthly-toolbar"><label>Liefermonat<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><button className="primary-button" onClick={downloadMonthlyPdf}>↓ PDF herunterladen</button></div><div className="business-document-head"><div><div className="eyebrow">Monatliche Bestellübersicht · Liefermonat {monthLabel(month)}</div><h2>{profile.location_name}</h2><p>Bestell- und Liefermonat werden getrennt ausgewiesen.</p></div><div className="business-document-total"><span>Total</span><strong>{money(reportTotal)}</strong><small>{reportCartons} Kartons · {reportOrders.length} Bestellungen</small></div></div>{reportOrders.length === 0 ? <p className="empty-cart">Keine Bestellungen mit Lieferdatum in diesem Monat.</p> : <div className="accounting-table"><div className="accounting-row accounting-head"><span>Lieferung / Bestellung</span><span>Wein</span><span>Menge</span><span>Einzelpreis</span><span>Betrag</span></div>{reportOrders.flatMap((order) => (order.order_items ?? []).map((item, index) => <div className="accounting-row" key={`${order.id}-${index}`}><div><strong>{dateLabel(order.delivery_date)}</strong><small>Bestellt: {dateLabel(order.created_at)}</small></div><div><strong>{one(item.wine)?.name ?? "Unbekannter Wein"}</strong></div><span>{item.cartons} Kartons · {itemBottles(item)} Flaschen</span><span>{money(bottlePrice(item))}</span><strong>{money(itemAmount(item))}</strong></div>))}</div>}<div className="accounting-total"><span>Monatstotal · {profile.location_name}</span><strong>{money(reportTotal)}</strong></div></section> : view === "history" ? <section className="inventory-panel business-history"><div className="panel-heading"><div><h2>Meine Bestellhistorie</h2><p>Nur Bestellungen für {profile.location_name}</p></div><span className="snapshot-badge">Geschützt</span></div>{orders.length === 0 ? <p className="empty-cart">Noch keine Bestellungen vorhanden.</p> : <div className="business-order-list">{orders.map((order) => <article className="business-order" key={order.id}><div><strong>Lieferung {dateLabel(order.delivery_date)}</strong><p>Bestellt am {dateLabel(order.created_at)} · {(order.order_items ?? []).map((item) => `${one(item.wine)?.name ?? "Wein"} · ${item.cartons} Kartons`).join(" · ")}</p></div><span className={`order-status ${order.status}`}>{order.status === "delivered" ? "Erledigt" : "Übermittelt"}</span></article>)}</div>}</section> : <><section className="inventory-panel business-catalog"><div className="panel-heading"><div><h2>{view === "order" ? "Weine auswählen" : "Vollständiger Zentrallagerbestand"}</h2><p>{filteredWines.length} Artikel · nach Sortiment geordnet</p></div><span className="snapshot-badge">Live</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein, Produzent oder Kategorie suchen..." /></div></div>{view === "order" && <div className="favorite-filter"><button className={!favoriteOnly ? "active" : ""} onClick={() => setFavoriteOnly(false)}>Alle Weine</button><button className={favoriteOnly ? "active" : ""} onClick={() => setFavoriteOnly(true)}>★ Meine Favoriten ({favorites.length})</button></div>}{favoriteOnly && !favoriteWines.length ? <p className="empty-cart">Noch keine Favoriten ausgewählt. Klicke auf ☆ neben einem Wein.</p> : renderGroups(view === "order")}</section>{view === "order" && <aside className="business-cart"><div className="eyebrow">Deine Bestellung</div><h2>{profile.location_name}</h2><div className="cart-items">{Object.keys(cart).length === 0 ? <p className="empty-cart">Noch keine Weine ausgewählt.</p> : Object.entries(cart).map(([id, cartons]) => <div className="cart-item" key={id}><strong>{wines.find((wine) => wine.id === id)?.name ?? "Wein"}</strong><span>{cartons} Kartons</span></div>)}</div><button className="primary-button order-submit" disabled={!Object.keys(cart).length} onClick={submitOrder}>Bestellung direkt übermitteln</button><p className="order-note">Lieferung erfolgt regulär am nächsten Montag. Der Bestand wird sofort beim Absenden reduziert.</p></aside>}</>}</div></main>;
}
