"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Wine = { id: string; name: string; producer: string | null; category: string; stock: number };
type Order = { id: string; status: string; created_at: string; order_items: { cartons: number; wine: { name: string }[] }[] };

export default function BetriebPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<{ email: string; location_id: string; location_name: string } | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"order" | "history">("order");
  const [notice, setNotice] = useState("");
  const filteredWines = useMemo(() => wines.filter((wine) => `${wine.name} ${wine.producer ?? ""} ${wine.category}`.toLowerCase().includes(query.toLowerCase())), [wines, query]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return;
      if (!user) { router.push("/"); return; }
      const { data: ownProfile } = await supabase.from("profiles").select("email,location_id,locations(name)").eq("id", user.id).single();
      if (!ownProfile?.location_id) { setNotice("Dein Benutzer ist noch keinem Betrieb zugeordnet."); setSessionReady(true); setLoading(false); return; }
      const { data: locations } = await supabase.from("locations").select("id,name").eq("id", ownProfile.location_id).single();
      const { data: wineRows } = await supabase.from("wines").select("id,name,producer,category").eq("active", true).order("name");
      const { data: balances } = await supabase.from("stock_balances").select("wine_id,cartons").eq("location_id", (await supabase.from("locations").select("id").eq("name", "Zentrallager").single()).data?.id);
      const balanceMap = Object.fromEntries((balances ?? []).map((balance) => [balance.wine_id, balance.cartons]));
      const { data: ownOrders } = await supabase.from("orders").select("id,status,created_at,order_items(cartons,wine:wines(name))").eq("location_id", ownProfile.location_id).order("created_at", { ascending: false });
      if (!mounted) return;
      setProfile({ email: ownProfile.email, location_id: ownProfile.location_id, location_name: locations?.name ?? "Betrieb" });
      setWines((wineRows ?? []).map((wine) => ({ ...wine, stock: balanceMap[wine.id] ?? 0 })));
      setOrders((ownOrders ?? []) as Order[]); setSessionReady(true); setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  async function submitOrder() {
    if (!profile || !Object.keys(cart).length) return;
    const { data: order, error } = await supabase.from("orders").insert({ location_id: profile.location_id, status: "submitted", created_by: (await supabase.auth.getUser()).data.user?.id }).select("id").single();
    if (error || !order) { setNotice(error?.message ?? "Bestellung konnte nicht angelegt werden"); return; }
    const { error: itemError } = await supabase.from("order_items").insert(Object.entries(cart).map(([wineId, cartons]) => ({ order_id: order.id, wine_id: wineId, cartons })));
    if (itemError) { setNotice(itemError.message); return; }
    const { error: submitError } = await supabase.rpc("submit_order", { p_order_id: order.id });
    if (submitError) { setNotice(submitError.message); return; }
    setWines((items) => items.map((wine) => ({ ...wine, stock: wine.stock - (cart[wine.id] ?? 0) }))); setCart({}); setView("history"); setNotice("Bestellung übermittelt und Bestand aktualisiert");
    const { data: ownOrders } = await supabase.from("orders").select("id,status,created_at,order_items(cartons,wine:wines(name))").eq("location_id", profile.location_id).order("created_at", { ascending: false });
    setOrders((ownOrders ?? []) as Order[]);
  }

  async function signOut() { await supabase.auth.signOut(); router.push("/"); }
  if (!sessionReady || loading) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Weinlager wird geladen …</h1></div></main>;
  if (!profile) return <main className="auth-page"><div className="auth-card"><div className="brand-mark">VB</div><h1>Kein Betrieb zugeordnet</h1><p>{notice || "Bitte wende dich an den Super-Admin."}</p><button className="primary-button auth-submit" onClick={signOut}>Abmelden</button></div></main>;
  return <main className="business-page"><header className="business-top"><div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">{profile.location_name}</div></div></div><div className="business-user"><span>{profile.email}</span><button onClick={signOut}>Abmelden</button></div></header><div className="business-content"><div className="page-heading"><div><div className="eyebrow">{profile.location_name} · Persönlicher Bereich</div><h1>Weinbestellung</h1><p>Gesamtbestand des Zentrallagers und deine Bestellhistorie.</p></div></div><div className="business-tabs"><button className={view === "order" ? "active" : ""} onClick={() => setView("order")}>Neue Bestellung</button><button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>Meine Bestellungen</button></div>{notice && <div className="toast business-toast">✓ {notice}</div>}{view === "history" ? <section className="inventory-panel business-history"><div className="panel-heading"><div><h2>Meine Bestellhistorie</h2><p>Nur Bestellungen für {profile.location_name}</p></div><span className="snapshot-badge">Geschützt</span></div>{orders.length === 0 ? <p className="empty-cart">Noch keine Bestellungen vorhanden.</p> : <div className="business-order-list">{orders.map((order) => <article className="business-order" key={order.id}><div><strong>{new Date(order.created_at).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}</strong><p>{order.order_items.map((item) => `${item.wine?.[0]?.name ?? "Wein"} · ${item.cartons} Karton${item.cartons === 1 ? "" : "s"}`).join(" · ")}</p></div><span className={`order-status ${order.status}`}>{order.status === "delivered" ? "Erledigt" : "Übermittelt"}</span></article>)}</div>}</section> : <div className="business-order-layout"><section className="inventory-panel"><div className="panel-heading"><div><h2>Zentrallagerbestand</h2><p>{wines.length} Weine verfügbar</p></div><span className="snapshot-badge">Live</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein suchen..." /></div></div><div className="business-wines">{filteredWines.map((wine) => <div className="business-wine" key={wine.id}><div><strong>{wine.name}</strong><small>{wine.producer ?? ""} · {wine.category}</small></div><b>{wine.stock} <em>Kartons</em></b><div className="business-controls"><button disabled={!cart[wine.id]} onClick={() => setCart((items) => ({ ...items, [wine.id]: Math.max(0, (items[wine.id] ?? 0) - 1) }))}>−</button><span>{cart[wine.id] ?? 0}</span><button disabled={wine.stock <= (cart[wine.id] ?? 0)} onClick={() => setCart((items) => ({ ...items, [wine.id]: (items[wine.id] ?? 0) + 1 }))}>＋</button></div></div>)}</div></section><aside className="business-cart"><div className="eyebrow">Deine Bestellung</div><h2>{profile.location_name}</h2><div className="cart-items">{Object.keys(cart).length === 0 ? <p className="empty-cart">Noch keine Weine ausgewählt.</p> : Object.entries(cart).map(([id, cartons]) => <div className="cart-item" key={id}><strong>{wines.find((wine) => wine.id === id)?.name ?? "Wein"}</strong><span>{cartons} Kartons</span></div>)}</div><button className="primary-button order-submit" disabled={!Object.keys(cart).length} onClick={submitOrder}>Bestellung direkt übermitteln</button><p className="order-note">Die Bestellung wird sofort an das zentrale Weinlager übermittelt. Der Super-Admin markiert sie nach Lieferung als erledigt.</p></aside></div>}</div></main>;
}
