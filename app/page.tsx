"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Wine = { id?: string; name: string; producer: string; vintage: string; category: string; stock: number; minStock: number; purchasePrice?: number; cartonsPerCase?: number };
type OrderItem = { wineId: string; name: string; cartons: number };
type OrderSummary = { id: string; status: string; createdAt: string; approvedAt: string | null; locationName: string; items: { name: string; cartons: number }[] };
type Activity = { type: string; wine: string; detail: string; time: string; tone: string };
type MovementHistory = { id: string; type: string; wine: string; cartons: number; from: string; to: string; note: string | null; createdAt: string };

const wines: Wine[] = [
  { name: "Prosecco Stefany Bio DOC", producer: "Il Grappolo", vintage: "–", category: "Schaumwein", stock: 14, minStock: 10 },
  { name: "Cava Hills", producer: "Rivera", vintage: "–", category: "Schaumwein", stock: 132, minStock: 10 },
  { name: "Prosecco Extra Dry Nudo DOC", producer: "Smith & Smith", vintage: "–", category: "Schaumwein", stock: 80, minStock: 10 },
  { name: "Kolonne Null ALKOHOLFREI", producer: "Smith & Smith", vintage: "–", category: "Schaumwein", stock: 55, minStock: 10 },
  { name: "Venus Rosé", producer: "Il Grappolo", vintage: "2025", category: "Rosé", stock: 62, minStock: 10 },
  { name: "Rose Saignée", producer: "Landerer", vintage: "2022", category: "Rosé", stock: 0, minStock: 10 },
];

const demoActivities: Activity[] = [
  { type: "Ausgabe", wine: "Cava Hills", detail: "Consum · 5 Kartons", time: "Heute, 09:42", tone: "rose" },
  { type: "Wareneingang", wine: "Pinot Noir", detail: "Zentrallager · 24 Kartons", time: "Gestern, 16:18", tone: "green" },
  { type: "Ausgabe", wine: "Venus Rosé", detail: "Nomad · 3 Kartons", time: "Gestern, 13:05", tone: "rose" },
  { type: "Inventur", wine: "Chardonnay Réserve", detail: "Zentrallager · korrigiert", time: "26.08.2026, 11:30", tone: "blue" },
];
const navItems = ["Übersicht", "Bestand", "Bestellungen", "Wareneingang", "Inventur", "Historie", "Stammdaten"];
function categorySortValue(category: string) { const value = category.toLowerCase(); if (value.includes("schaum")) return 0; if (value.includes("weiss") || value.includes("weiß")) return 1; if (value.includes("rot")) return 2; return 3; }

export default function Home() {
  const [active, setActive] = useState("Übersicht");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [inventory, setInventory] = useState(wines);
  const [dataLoading, setDataLoading] = useState(true);
  const [locationIds, setLocationIds] = useState<Record<string, string>>({});
  const [orderSite, setOrderSite] = useState("Consum");
  const [orderCart, setOrderCart] = useState<OrderItem[]>([]);
  const [orderView, setOrderView] = useState<"new" | "history">("new");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [pendingOrderCartons, setPendingOrderCartons] = useState(0);
  const [activities, setActivities] = useState<Activity[]>(demoActivities);
  const [history, setHistory] = useState<MovementHistory[]>([]);
  const [historyType, setHistoryType] = useState("Alle Bewegungen");
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [site, setSite] = useState("Consum");
  const [incomingWineId, setIncomingWineId] = useState("");
  const [incomingQuantity, setIncomingQuantity] = useState(1);
  const [incomingSupplier, setIncomingSupplier] = useState("");
  const [incomingReference, setIncomingReference] = useState("");
  const [incomingSaving, setIncomingSaving] = useState(false);
  const [countedStocks, setCountedStocks] = useState<Record<string, string>>({});
  const [inventorySaving, setInventorySaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [masterWineId, setMasterWineId] = useState<string | null>(null);
  const [masterName, setMasterName] = useState("");
  const [masterProducer, setMasterProducer] = useState("");
  const [masterCategory, setMasterCategory] = useState("");
  const [masterVintage, setMasterVintage] = useState("");
  const [masterBottleSize, setMasterBottleSize] = useState("");
  const [masterCartonsPerCase, setMasterCartonsPerCase] = useState("6");
  const [masterPurchasePrice, setMasterPurchasePrice] = useState("");
  const [masterMinStock, setMasterMinStock] = useState("10");
  const [masterSaving, setMasterSaving] = useState(false);
  const filteredWines = useMemo(() => inventory.filter((wine) => `${wine.name} ${wine.producer} ${wine.category}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => categorySortValue(a.category) - categorySortValue(b.category) || a.name.localeCompare(b.name)), [inventory, query]);
  const filteredHistory = useMemo(() => history.filter((movement) => (historyType === "Alle Bewegungen" || movement.type === historyType) && `${movement.wine} ${movement.from} ${movement.to} ${movement.note ?? ""}`.toLowerCase().includes(query.toLowerCase())), [history, historyType, query]);
  const lowStock = useMemo(() => inventory.filter((wine) => wine.stock <= wine.minStock).length, [inventory]);
  const totalStock = useMemo(() => inventory.reduce((sum, wine) => sum + wine.stock, 0), [inventory]);
  const totalValue = useMemo(() => inventory.reduce((sum, wine) => sum + wine.stock * (wine.purchasePrice ?? 0) * (wine.cartonsPerCase ?? 1), 0), [inventory]);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("wines").select("id,name,producer,vintage,category,purchase_price,cartons_per_case,min_stock").eq("active", true).order("name"),
      supabase.from("locations").select("id,name"),
    ]).then(async ([wineResult, locationResult]) => {
      if (!mounted) return;
      if (wineResult.error || locationResult.error) { showNotice("Supabase-Daten konnten nicht geladen werden"); setDataLoading(false); return; }
      const ids = Object.fromEntries((locationResult.data ?? []).map((location) => [location.name, location.id]));
      setLocationIds(ids);
      const orderResult = await supabase.from("orders").select("id,status,created_at,approved_at,location:locations(name),order_items(cartons,wine:wines(name))").order("created_at", { ascending: false }).limit(30);
      if (orderResult.error) { showNotice("Bestellungen konnten nicht geladen werden"); }
      else { setOrders((orderResult.data ?? []).map((order) => ({ id: order.id, status: order.status, createdAt: order.created_at, approvedAt: order.approved_at, locationName: (order.location as unknown as { name: string } | null)?.name ?? "Unbekannter Betrieb", items: (order.order_items as unknown as { cartons: number; wine: { name: string }[] }[] ?? []).map((item) => ({ name: item.wine?.[0]?.name ?? "Unbekannter Wein", cartons: item.cartons })) }))); setPendingOrderCartons((orderResult.data ?? []).filter((order) => ["draft", "submitted"].includes(order.status)).reduce((sum, order) => sum + ((order.order_items as unknown as { cartons: number }[] ?? []).reduce((subtotal, item) => subtotal + item.cartons, 0)), 0)); }
      const movementResult = await supabase.from("stock_movements").select("id,created_at,movement_type,cartons,note,wine:wines(name),from:locations!stock_movements_from_location_id(name),to:locations!stock_movements_to_location_id(name)").order("created_at", { ascending: false }).limit(100);
      if (!movementResult.error && movementResult.data?.length) { const rows = movementResult.data.map((movement) => { const wine = (movement.wine as unknown as { name: string }[] | null)?.[0]?.name ?? "Unbekannter Wein"; const to = (movement.to as unknown as { name: string }[] | null)?.[0]?.name ?? ""; const from = (movement.from as unknown as { name: string }[] | null)?.[0]?.name ?? ""; const label = movement.movement_type === "wareneingang" ? "Wareneingang" : movement.movement_type === "inventur" ? "Inventur" : "Ausgabe"; return { id: movement.id, type: label, wine, cartons: movement.cartons, from, to, note: movement.note, createdAt: movement.created_at }; }); setHistory(rows); setActivities(rows.slice(0, 5).map((row) => ({ type: row.type, wine: row.wine, detail: `${row.to || row.from || "Zentrallager"} · ${row.cartons} Kartons`, time: new Date(row.createdAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" }), tone: row.type === "Wareneingang" ? "green" : row.type === "Inventur" ? "blue" : "rose" }))); }
      const balanceResult = await supabase.from("stock_balances").select("wine_id,cartons").eq("location_id", ids.Zentrallager);
      if (balanceResult.error) { showNotice("Bestände konnten nicht geladen werden"); setDataLoading(false); return; }
      const balances = Object.fromEntries((balanceResult.data ?? []).map((balance) => [balance.wine_id, balance.cartons]));
      setInventory((wineResult.data ?? []).map((wine) => ({ id: wine.id, name: wine.name, producer: wine.producer ?? "", vintage: wine.vintage ?? "–", category: wine.category, stock: balances[wine.id] ?? 0, minStock: wine.min_stock ?? 10, purchasePrice: wine.purchase_price ?? 0, cartonsPerCase: wine.cartons_per_case ?? 6 })));
      setDataLoading(false);
    });
    return () => { mounted = false; };
  }, [refreshTick]);
  async function saveMovement() {
    if (!selectedWine?.id || !locationIds.Zentrallager || !locationIds[site]) return;
    const { error } = await supabase.rpc("record_stock_movement", { p_wine_id: selectedWine.id, p_from_location_id: locationIds.Zentrallager, p_to_location_id: locationIds[site], p_cartons: quantity, p_movement_type: "ausgabe", p_note: null });
    if (error) { showNotice(error.message); return; }
    setInventory((items) => items.map((item) => item.name === selectedWine.name ? { ...item, stock: item.stock - quantity } : item));
    setRefreshTick((value) => value + 1);
    setSelectedWine(null);
    showNotice(`${quantity} Karton ${selectedWine.name} an ${site} ausgegeben`);
  }
  function addToOrder(wine: Wine) {
    const wineId = wine.id;
    if (!wineId) return;
    setOrderCart((items) => items.some((item) => item.wineId === wineId) ? items.map((item) => item.wineId === wineId ? { ...item, cartons: item.cartons + 1 } : item) : [...items, { wineId, name: wine.name, cartons: 1 }]);
  }
  async function approveOrder() {
    if (!locationIds[orderSite] || orderCart.length === 0) return;
    const { data: order, error: orderError } = await supabase.from("orders").insert({ location_id: locationIds[orderSite], status: "submitted", note: null }).select("id").single();
    if (orderError || !order) { showNotice(orderError?.message ?? "Bestellung konnte nicht angelegt werden"); return; }
    const { error: itemsError } = await supabase.from("order_items").insert(orderCart.map((item) => ({ order_id: order.id, wine_id: item.wineId, cartons: item.cartons })));
    if (itemsError) { showNotice(itemsError.message); return; }
    const { error: approvalError } = await supabase.rpc("approve_order", { p_order_id: order.id });
    if (approvalError) { showNotice(approvalError.message); return; }
    setInventory((items) => items.map((wine) => { const item = orderCart.find((entry) => entry.wineId === wine.id); return item ? { ...wine, stock: wine.stock - item.cartons } : wine; }));
    setRefreshTick((value) => value + 1);
    setOrders((items) => [{ id: order.id, status: "approved", createdAt: new Date().toISOString(), approvedAt: new Date().toISOString(), locationName: orderSite, items: orderCart.map((item) => ({ name: item.name, cartons: item.cartons })) }, ...items]);
    setOrderCart([]);
    setOrderView("history");
    showNotice(`Bestellung für ${orderSite} freigegeben`);
  }
  async function saveIncomingDelivery() {
    const wine = inventory.find((item) => item.id === incomingWineId);
    if (!wine || !locationIds.Zentrallager || incomingQuantity < 1) return;
    setIncomingSaving(true);
    const details = [incomingSupplier && `Lieferant: ${incomingSupplier}`, incomingReference && `Lieferschein: ${incomingReference}`].filter(Boolean).join(" · ") || null;
    const { error } = await supabase.rpc("record_stock_movement", { p_wine_id: incomingWineId, p_from_location_id: null, p_to_location_id: locationIds.Zentrallager, p_cartons: incomingQuantity, p_movement_type: "wareneingang", p_note: details });
    setIncomingSaving(false);
    if (error) { showNotice(error.message); return; }
    setInventory((items) => items.map((item) => item.id === incomingWineId ? { ...item, stock: item.stock + incomingQuantity } : item));
    setRefreshTick((value) => value + 1);
    setIncomingWineId(""); setIncomingQuantity(1); setIncomingSupplier(""); setIncomingReference("");
    showNotice(`${incomingQuantity} Karton ${wine.name} im Zentrallager erfasst`);
  }
  async function saveInventoryCount(wine: Wine) {
    if (!wine.id || !locationIds.Zentrallager) return;
    const counted = Number(countedStocks[wine.id]);
    if (!Number.isInteger(counted) || counted < 0) { showNotice("Bitte eine gültige Kartonanzahl eingeben"); return; }
    const difference = counted - wine.stock;
    if (difference === 0) { showNotice(`${wine.name}: Bestand unverändert`); return; }
    setInventorySaving(true);
    const { error } = await supabase.rpc("record_stock_movement", { p_wine_id: wine.id, p_from_location_id: difference < 0 ? locationIds.Zentrallager : null, p_to_location_id: difference > 0 ? locationIds.Zentrallager : null, p_cartons: Math.abs(difference), p_movement_type: "inventur", p_note: "Inventur über Weinlager-App" });
    setInventorySaving(false);
    if (error) { showNotice(error.message); return; }
    setInventory((items) => items.map((item) => item.id === wine.id ? { ...item, stock: counted } : item));
    setRefreshTick((value) => value + 1);
    setCountedStocks((values) => { const next = { ...values }; delete next[wine.id as string]; return next; });
    showNotice(`${wine.name}: Bestand auf ${counted} Kartons korrigiert`);
  }
  function editMasterWine(wine: Wine) {
    setMasterWineId(wine.id ?? null); setMasterName(wine.name); setMasterProducer(wine.producer); setMasterCategory(wine.category); setMasterVintage(wine.vintage === "–" ? "" : wine.vintage); setMasterBottleSize(""); setMasterCartonsPerCase(String(wine.cartonsPerCase ?? 6)); setMasterPurchasePrice(String(wine.purchasePrice ?? "")); setMasterMinStock(String(wine.minStock));
  }
  function resetMasterWine() { setMasterWineId(null); setMasterName(""); setMasterProducer(""); setMasterCategory(""); setMasterVintage(""); setMasterBottleSize(""); setMasterCartonsPerCase("6"); setMasterPurchasePrice(""); setMasterMinStock("10"); }
  async function saveMasterWine() {
    const name = masterName.trim(); const category = masterCategory.trim(); const cartonsPerCase = Number(masterCartonsPerCase); const minStock = Number(masterMinStock); const purchasePrice = Number(masterPurchasePrice || 0); const bottleSize = masterBottleSize ? Number(masterBottleSize) : null;
    if (!name || !category || !Number.isInteger(cartonsPerCase) || cartonsPerCase < 1 || !Number.isInteger(minStock) || minStock < 0 || purchasePrice < 0 || (bottleSize !== null && bottleSize <= 0)) { showNotice("Bitte die Pflichtfelder und gültige Zahlen prüfen"); return; }
    setMasterSaving(true);
    const values = { name, producer: masterProducer.trim() || null, category, vintage: masterVintage.trim() || null, bottle_size_l: bottleSize, cartons_per_case: cartonsPerCase, purchase_price: purchasePrice, min_stock: minStock, active: true };
    const result = masterWineId ? await supabase.from("wines").update(values).eq("id", masterWineId).select("id").single() : await supabase.from("wines").insert(values).select("id").single();
    setMasterSaving(false);
    if (result.error) { showNotice(result.error.message); return; }
    if (masterWineId) setInventory((items) => items.map((item) => item.id === masterWineId ? { ...item, ...values, producer: values.producer ?? "", vintage: values.vintage ?? "–", purchasePrice: values.purchase_price, cartonsPerCase: values.cartons_per_case, minStock: values.min_stock } : item));
    else setInventory((items) => [...items, { id: result.data.id, name, producer: values.producer ?? "", category, vintage: values.vintage ?? "–", stock: 0, minStock, purchasePrice, cartonsPerCase }].sort((a, b) => a.name.localeCompare(b.name)));
    showNotice(masterWineId ? `${name} aktualisiert` : `${name} angelegt`); resetMasterWine();
  }
  function showNotice(message: string) { if (message === "Wareneingang kommt als nächster Workflow" || message === "Wareneingang kann im nächsten Schritt erfasst werden") { setActive("Wareneingang"); return; } if (message === "Bestellung für einen Betrieb wird vorbereitet") { setActive("Bestellungen"); return; } if (message === "Inventur kann im nächsten Schritt gestartet werden") { setActive("Inventur"); return; } if (message === "Wein-Stammdaten kommen als nächster Baustein") { setActive("Stammdaten"); return; } setNotice(message); window.setTimeout(() => setNotice(""), 3500); }
  if (active === "Bestand") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><button className="icon-button" aria-label="Benachrichtigungen">♧<i /></button><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Zentrallager · Supabase Live-Daten</div><h1>Bestand</h1><p>61 Artikelpositionen aus der zentralen Weinlager-Liste.</p></div><button className="primary-button" onClick={() => showNotice("Wareneingang kommt als nächster Workflow")}>+ Wareneingang erfassen</button></div><div className="inventory-summary"><div><strong>1’806</strong><span>Kartons Gesamtbestand</span></div><div><strong>CHF 123’713</strong><span>Warenwert</span></div><div><strong>13</strong><span>Artikel ohne Bestand</span></div><div><strong>313</strong><span>Bestellte Kartons</span></div></div><section className="inventory-panel"><div className="panel-heading"><div><h2>Alle Artikel</h2><p>{dataLoading ? "Bestände werden geladen …" : "Live aus Supabase · Ausgabe wird dauerhaft protokolliert."}</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div><button className="filter-button">Alle Kategorien <span>≡</span></button></div><div className="inventory-table"><div className="inventory-row inventory-head"><span>Artikel</span><span>Kategorie</span><span>Lieferant</span><span>Bestand</span><span>Aktion</span></div>{filteredWines.map((wine) => <div className="inventory-row" key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.vintage} · {wine.stock * (wine.cartonsPerCase ?? 6)} Einzelflaschen</small></div></div><span className="category-pill">{wine.category}</span><span className="supplier">{wine.producer}</span><strong>{wine.stock} <small className="unit-label">Kartons</small></strong><button className="row-action" onClick={() => { setSelectedWine(wine); setQuantity(1); }}>Ausgabe →</button></div>)}</div></section><div className="demo-note">Quelle: Weinlager_VB_Zentrale (1).xlsx · Mindestbestände werden als nächster Schritt konfigurierbar</div></div>{selectedWine && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedWine(null)}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Schliessen" onClick={() => setSelectedWine(null)}>×</button><div className="eyebrow">Lagerbewegung · Ausgabe</div><h2 id="movement-title">{selectedWine.name}</h2><p className="modal-subtitle">Bestand aktuell: <strong>{selectedWine.stock} Kartons</strong></p><label>Betrieb<select value={site} onChange={(event) => setSite(event.target.value)}><option>Consum</option><option>VB</option><option>Nomad</option><option>Krafft</option><option>Silo</option></select></label><label>Anzahl Kartons<input type="number" min="1" max={selectedWine.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>{quantity > selectedWine.stock && <div className="form-error">Nicht genügend Bestand vorhanden.</div>}<button className="primary-button modal-submit" disabled={quantity > selectedWine.stock} onClick={saveMovement}>Ausgabe speichern</button></section></div>}</main>;
  }
  if (active === "Wareneingang") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Zentrallager · Supabase Live-Daten</div><h1>Wareneingang</h1><p>Neue Lieferungen erfassen und den Bestand automatisch aktualisieren.</p></div></div><section className="incoming-card"><div className="eyebrow">Lieferung erfassen</div><h2>Neue Lieferung</h2><p className="incoming-intro">Die Eingabe wird als Wareneingang in der Lagerhistorie gespeichert.</p><label>Wein<select value={incomingWineId} onChange={(event) => setIncomingWineId(event.target.value)}><option value="">Wein auswählen …</option>{inventory.map((wine) => <option key={wine.id} value={wine.id}>{wine.name} · aktuell {wine.stock} Kartons</option>)}</select></label><div className="incoming-fields"><label>Anzahl Kartons<input type="number" min="1" value={incomingQuantity} onChange={(event) => setIncomingQuantity(Math.max(1, Number(event.target.value) || 1))} /></label><label>Lieferant <span className="optional-label">optional</span><input value={incomingSupplier} onChange={(event) => setIncomingSupplier(event.target.value)} placeholder="z. B. Smith & Smith" /></label><label>Lieferschein <span className="optional-label">optional</span><input value={incomingReference} onChange={(event) => setIncomingReference(event.target.value)} placeholder="z. B. LS-2026-081" /></label></div><button className="primary-button incoming-submit" disabled={!incomingWineId || incomingSaving || dataLoading} onClick={saveIncomingDelivery}>{incomingSaving ? "Wird gespeichert …" : "Wareneingang speichern"}</button></section><div className="demo-note">Der Bestand wird unmittelbar erhöht und die Bewegung dauerhaft protokolliert.</div></div></main>;
  }
  if (active === "Inventur") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Zentrallager · Supabase Live-Daten</div><h1>Inventur</h1><p>Gezählte Kartons eintragen und Differenzen direkt korrigieren.</p></div></div><section className="inventory-panel stocktake-panel"><div className="panel-heading"><div><h2>Bestand zählen</h2><p>{dataLoading ? "Bestände werden geladen …" : `${filteredWines.length} Artikel in der Auswahl`}</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div></div><div className="stocktake-list">{filteredWines.map((wine) => { const value = countedStocks[wine.id ?? ""]; const counted = value === undefined ? wine.stock : Number(value); const difference = counted - wine.stock; return <div className="stocktake-row" key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.producer} · Systembestand {wine.stock} Kartons</small></div></div><div className="counted-field"><label>Gezählt<input type="number" min="0" value={value ?? ""} placeholder={String(wine.stock)} onChange={(event) => setCountedStocks((values) => ({ ...values, [wine.id as string]: event.target.value }))} /></label></div><span className={difference === 0 ? "difference-even" : difference > 0 ? "difference-plus" : "difference-minus"}>{difference === 0 ? "Keine Differenz" : `${difference > 0 ? "+" : ""}${difference} Kartons`}</span><button className="row-action" disabled={value === undefined || inventorySaving} onClick={() => saveInventoryCount(wine)}>Speichern</button></div>; })}</div></section><div className="demo-note">Nur gespeicherte Zählungen verändern den Bestand. Jede Differenz wird als Inventurbewegung protokolliert.</div></div></main>;
  }
  if (active === "Historie") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Lagerbewegungen · Supabase Live-Daten</div><h1>Historie</h1><p>Alle Bestandsveränderungen im Zentrallager auf einen Blick.</p></div></div><section className="inventory-panel history-panel"><div className="panel-heading"><div><h2>Alle Bewegungen</h2><p>{dataLoading ? "Bewegungen werden geladen …" : `${filteredHistory.length} Bewegungen gefunden`}</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein, Betrieb oder Notiz suchen..." /></div><select className="history-filter" value={historyType} onChange={(event) => setHistoryType(event.target.value)}><option>Alle Bewegungen</option><option>Wareneingang</option><option>Ausgabe</option><option>Inventur</option></select></div>{filteredHistory.length === 0 ? <p className="empty-cart">Noch keine passenden Bewegungen vorhanden.</p> : <div className="history-list">{filteredHistory.map((movement) => <article className="history-row" key={movement.id}><div className={`activity-icon ${movement.type === "Wareneingang" ? "green" : movement.type === "Inventur" ? "blue" : "rose"}`}>{movement.type === "Wareneingang" ? "↓" : movement.type === "Inventur" ? "◉" : "↑"}</div><div className="history-main"><strong>{movement.wine}</strong><span>{movement.type} · {movement.from ? `${movement.from} → ` : ""}{movement.to || "Zentrallager"}</span>{movement.note && <small>{movement.note}</small>}</div><div className="history-quantity">{movement.cartons} Kartons</div><time>{new Date(movement.createdAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}</div>}</section></div></main>;
  }
  if (active === "Stammdaten") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Weinstamm · MVP ohne Login</div><h1>Stammdaten</h1><p>Weine, Einkaufspreise und Mindestbestände pflegen.</p></div><button className="primary-button" onClick={resetMasterWine}>＋ Neuer Wein</button></div><div className="master-layout"><section className="inventory-panel master-list"><div className="panel-heading"><div><h2>Weinliste</h2><p>{inventory.length} aktive Artikel</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div></div><div className="master-wines">{filteredWines.map((wine) => <button className={`master-wine ${masterWineId === wine.id ? "selected" : ""}`} key={wine.id ?? wine.name} onClick={() => editMasterWine(wine)}><span><strong>{wine.name}</strong><small>{wine.producer || "Kein Lieferant"} · {wine.category}</small></span><b>{wine.minStock} <em>Min.</em></b></button>)}</div></section><section className="incoming-card master-form"><div className="eyebrow">{masterWineId ? "Wein bearbeiten" : "Neuen Wein anlegen"}</div><h2>{masterWineId ? "Stammdaten ändern" : "Wein hinzufügen"}</h2><label>Name *<input value={masterName} onChange={(event) => setMasterName(event.target.value)} placeholder="z. B. Cava Hills" /></label><div className="master-fields"><label>Produzent<input value={masterProducer} onChange={(event) => setMasterProducer(event.target.value)} placeholder="Lieferant" /></label><label>Kategorie *<input value={masterCategory} onChange={(event) => setMasterCategory(event.target.value)} placeholder="z. B. Rotwein" /></label><label>Jahrgang<input value={masterVintage} onChange={(event) => setMasterVintage(event.target.value)} placeholder="z. B. 2023" /></label><label>Flaschengrösse (l)<input type="number" min="0.01" step="0.01" value={masterBottleSize} onChange={(event) => setMasterBottleSize(event.target.value)} placeholder="0.75" /></label><label>Kartons pro Einheit *<input type="number" min="1" step="1" value={masterCartonsPerCase} onChange={(event) => setMasterCartonsPerCase(event.target.value)} /></label><label>Einkaufspreis / Karton (CHF)<input type="number" min="0" step="0.01" value={masterPurchasePrice} onChange={(event) => setMasterPurchasePrice(event.target.value)} placeholder="0.00" /></label><label>Mindestbestand (Kartons) *<input type="number" min="0" step="1" value={masterMinStock} onChange={(event) => setMasterMinStock(event.target.value)} /></label></div><div className="master-actions"><button className="secondary-button" onClick={resetMasterWine}>Zurücksetzen</button><button className="primary-button" disabled={masterSaving} onClick={saveMasterWine}>{masterSaving ? "Wird gespeichert …" : masterWineId ? "Änderungen speichern" : "Wein anlegen"}</button></div><p className="order-note">MVP-Modus: Stammdaten sind momentan ohne Login bearbeitbar. Für den späteren Produktivbetrieb ergänzen wir Rollen und Rechte.</p></section></div></div></main>;
  }
  if (active === "Bestellungen") {
    return <main className="orders-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="orders-content"><div className="page-heading"><div><div className="eyebrow">Betriebsbestellungen · Supabase Live-Daten</div><h1>{orderView === "new" ? "Neue Bestellung" : "Bestellübersicht"}</h1><p>{orderView === "new" ? "Weine auswählen, Betrieb bestimmen und direkt freigeben." : `${orders.length} Bestellungen aus dem Weinlager`}</p></div><button className="primary-button" onClick={() => setOrderView("new")}>＋ Neue Bestellung</button></div><div className="order-tabs"><button className={orderView === "history" ? "active" : ""} onClick={() => setOrderView("history")}>Bestellübersicht</button><button className={orderView === "new" ? "active" : ""} onClick={() => setOrderView("new")}>Neue Bestellung</button></div>{orderView === "history" ? <section className="inventory-panel order-history"><div className="panel-heading"><div><h2>Letzte Bestellungen</h2><p>Freigegebene Bestellungen werden hier dauerhaft angezeigt.</p></div><span className="snapshot-badge">Live verbunden</span></div>{orders.length === 0 ? <p className="empty-cart">Noch keine Bestellungen vorhanden.</p> : <div className="order-history-list">{orders.map((order) => <article className="order-history-item" key={order.id}><div><strong>{order.locationName}</strong><small>{new Date(order.createdAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}</small><p>{order.items.map((item) => `${item.name} · ${item.cartons} Karton${item.cartons === 1 ? "" : "s"}`).join(" · ")}</p></div><span className={`order-status ${order.status}`}>{order.status === "approved" ? "Freigegeben" : order.status === "submitted" ? "Eingereicht" : order.status}</span></article>)}</div>}</section> : <div className="order-layout"><section className="inventory-panel"><div className="panel-heading"><div><h2>Wein auswählen</h2><p>{dataLoading ? "Bestand wird geladen …" : `${inventory.length} Artikel im Zentrallager`}</p></div></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein suchen..." /></div></div><div className="order-wines">{filteredWines.map((wine) => <button className="order-wine" key={wine.name} onClick={() => addToOrder(wine)} disabled={!wine.stock}><span className="wine-bottle">♢</span><span><strong>{wine.name}</strong><small>{wine.producer} · {wine.stock} Kartons verfügbar</small></span><b>＋</b></button>)}</div></section><aside className="order-cart"><div className="eyebrow">Bestellentwurf</div><h2>{orderSite}</h2><label>Betrieb<select value={orderSite} onChange={(event) => setOrderSite(event.target.value)}><option>Consum</option><option>VB</option><option>Nomad</option><option>Krafft</option><option>Silo</option></select></label><div className="cart-items">{orderCart.length === 0 ? <p className="empty-cart">Noch keine Weine ausgewählt.</p> : orderCart.map((item) => <div className="cart-item" key={item.wineId}><div><strong>{item.name}</strong><small>{item.cartons} Kartons</small></div><div className="cart-controls"><button onClick={() => setOrderCart((items) => items.map((entry) => entry.wineId === item.wineId ? { ...entry, cartons: Math.max(1, entry.cartons - 1) } : entry))}>−</button><span>{item.cartons}</span><button onClick={() => setOrderCart((items) => items.map((entry) => entry.wineId === item.wineId ? { ...entry, cartons: entry.cartons + 1 } : entry))}>＋</button></div></div>)}</div><button className="primary-button order-submit" disabled={!orderCart.length || dataLoading} onClick={approveOrder}>Bestellung freigeben</button><p className="order-note">Bei der Freigabe wird der Zentrallagerbestand automatisch reduziert und die Bewegung protokolliert.</p></aside></div>}</div></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">Zentrales Lager</div></div></div>
        <div className="nav-label">Arbeitsbereich</div>
        <nav>{navItems.map((item, index) => <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}><span className="nav-icon">{["⌂", "▦", "□", "↓", "◉", "≡", "⚙"][index]}</span>{item}{item === "Bestellungen" && <span className="nav-count">2</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="nav-label">Verwaltung</div><button className="nav-item"><span className="nav-icon">⚙</span>Einstellungen</button><div className="user-chip"><div className="avatar">PS</div><div><strong>Philipp</strong><span>MVP-Modus</span></div><span className="dots">•••</span></div></div>
      </aside>
      <section className="content">
        <header className="topbar"><div className="breadcrumb">Volta Bräu <span>/</span> {active}</div><div className="top-actions"><button className="icon-button" aria-label="Benachrichtigungen" onClick={() => showNotice("Keine neuen Benachrichtigungen")}>♧<i /></button><div className="top-avatar">PS</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow">Donnerstag, 27. August 2026</div><h1>Guten Morgen, Philipp</h1><p>Hier ist der aktuelle Überblick über euer Weinlager.</p></div><button className="primary-button" onClick={() => showNotice("Wareneingang kann im nächsten Schritt erfasst werden")}>+ Wareneingang erfassen</button></div>
          {notice && <div className="toast">✓ {notice}</div>}
          <div className="metric-grid">
            <article className="metric-card"><div className="metric-top"><span>Bestand gesamt</span><span className="metric-icon plum">▦</span></div><strong>{dataLoading ? "–" : totalStock.toLocaleString("de-CH")}</strong><div className="metric-foot"><span className="trend">Live</span> <span>Zentrallager</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Warenwert</span><span className="metric-icon gold">◆</span></div><strong>{dataLoading ? "–" : `CHF ${totalValue.toLocaleString("de-CH", { maximumFractionDigits: 0 })}`}</strong><div className="metric-foot"><span>Einstandspreise · Zentrallager</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Knapp am Lager</span><span className="metric-icon orange">!</span></div><strong>{lowStock}</strong><div className="metric-foot warning-text"><span>Benötigen Aufmerksamkeit</span><span className="arrow">→</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Bestellte Kartons</span><span className="metric-icon blue">□</span></div><strong>{dataLoading ? "–" : pendingOrderCartons}</strong><div className="metric-foot link-text" onClick={() => setActive("Bestellungen")}>Offene Bestellungen <span className="arrow">→</span></div></article>
          </div>
          <div className="main-grid">
            <section className="panel stock-panel"><div className="panel-heading"><div><h2>Bestandsübersicht</h2><p>Die wichtigsten Weine im Zentrallager</p></div><button className="text-button" onClick={() => setActive("Bestand")}>Alle anzeigen <span>→</span></button></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div><button className="filter-button">Filter <span>≡</span></button></div><div className="wine-table"><div className="table-row table-head"><span>Wein</span><span>Kategorie</span><span>Bestand</span><span>Status</span></div>{filteredWines.slice(0, 5).map((wine) => <div className="table-row" key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.producer} · {wine.vintage}</small></div></div><span className="category-pill">{wine.category}</span><span className="stock-number">{wine.stock} <small>Kartons</small></span><span className={wine.stock < wine.minStock ? "status-low" : "status-good"}><i />{wine.stock < wine.minStock ? "Niedrig" : "Gut"}</span></div>)}</div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><h2>Letzte Aktivitäten</h2><p>Aktuelle Lagerbewegungen</p></div><button className="more-button">•••</button></div><div className="activity-list">{activities.map((activity) => <div className="activity" key={`${activity.wine}-${activity.time}`}><div className={`activity-icon ${activity.tone}`}>{activity.tone === "green" ? "↓" : activity.tone === "blue" ? "◉" : "↑"}</div><div className="activity-copy"><strong>{activity.wine}</strong><span>{activity.type} · {activity.detail}</span></div><time>{activity.time}</time></div>)}</div><button className="activity-footer" onClick={() => setActive("Bestand")}>Gesamte Historie ansehen <span>→</span></button></section>
          </div>
          <section className="quick-actions"><div><h2>Schnellzugriff</h2><p>Häufig verwendete Aktionen</p></div><div className="action-grid"><button onClick={() => showNotice("Bestellung für einen Betrieb wird vorbereitet")}><span className="action-icon purple">＋</span><span><strong>Neue Bestellung</strong><small>Für einen Betrieb erfassen</small></span><b>→</b></button><button onClick={() => showNotice("Inventur kann im nächsten Schritt gestartet werden")}><span className="action-icon yellow">◉</span><span><strong>Inventur starten</strong><small>Bestände überprüfen</small></span><b>→</b></button><button onClick={() => showNotice("Wein-Stammdaten kommen als nächster Baustein")}><span className="action-icon pink">♢</span><span><strong>Wein hinzufügen</strong><small>Neuen Wein anlegen</small></span><b>→</b></button></div></section>
          <div className="demo-note">Datenstand aus Weinlager_VB_Zentrale · 27. August 2026 · Mindestbestand wird im nächsten Schritt konfigurierbar</div>
        </div>
      </section>
    </main>
  );
}
