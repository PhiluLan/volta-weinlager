"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Wine = { id?: string; name: string; producer: string; vintage: string; category: string; stock: number; minStock: number; cartonsPerCase?: number };

const wines: Wine[] = [
  { name: "Prosecco Stefany Bio DOC", producer: "Il Grappolo", vintage: "–", category: "Schaumwein", stock: 14, minStock: 10 },
  { name: "Cava Hills", producer: "Rivera", vintage: "–", category: "Schaumwein", stock: 132, minStock: 10 },
  { name: "Prosecco Extra Dry Nudo DOC", producer: "Smith & Smith", vintage: "–", category: "Schaumwein", stock: 80, minStock: 10 },
  { name: "Kolonne Null ALKOHOLFREI", producer: "Smith & Smith", vintage: "–", category: "Schaumwein", stock: 55, minStock: 10 },
  { name: "Venus Rosé", producer: "Il Grappolo", vintage: "2025", category: "Rosé", stock: 62, minStock: 10 },
  { name: "Rose Saignée", producer: "Landerer", vintage: "2022", category: "Rosé", stock: 0, minStock: 10 },
];

const movements = [
  ["Ausgabe", "Cava Hills", "Consum · 5 Kartons", "Heute, 09:42", "rose"],
  ["Wareneingang", "Pinot Noir", "Zentrallager · 24 Kartons", "Gestern, 16:18", "green"],
  ["Ausgabe", "Venus Rosé", "Nomad · 3 Kartons", "Gestern, 13:05", "rose"],
  ["Inventur", "Chardonnay Réserve", "Zentrallager · korrigiert", "26.08.2026, 11:30", "blue"],
];
const navItems = ["Übersicht", "Bestand", "Bestellungen", "Wareneingang", "Inventur"];

export default function Home() {
  const [active, setActive] = useState("Übersicht");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [inventory, setInventory] = useState(wines);
  const [dataLoading, setDataLoading] = useState(true);
  const [locationIds, setLocationIds] = useState<Record<string, string>>({});
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [site, setSite] = useState("Consum");
  const filteredWines = useMemo(() => inventory.filter((wine) => `${wine.name} ${wine.producer} ${wine.category}`.toLowerCase().includes(query.toLowerCase())), [inventory, query]);
  const lowStock = 13;
  const totalStock = 1806;
  useEffect(() => {
    let mounted = true;
    Promise.all([
      supabase.from("wines").select("id,name,producer,vintage,category,cartons_per_case").eq("active", true).order("name"),
      supabase.from("locations").select("id,name"),
    ]).then(async ([wineResult, locationResult]) => {
      if (!mounted) return;
      if (wineResult.error || locationResult.error) { showNotice("Supabase-Daten konnten nicht geladen werden"); setDataLoading(false); return; }
      const ids = Object.fromEntries((locationResult.data ?? []).map((location) => [location.name, location.id]));
      setLocationIds(ids);
      const balanceResult = await supabase.from("stock_balances").select("wine_id,cartons").eq("location_id", ids.Zentrallager);
      if (balanceResult.error) { showNotice("Bestände konnten nicht geladen werden"); setDataLoading(false); return; }
      const balances = Object.fromEntries((balanceResult.data ?? []).map((balance) => [balance.wine_id, balance.cartons]));
      setInventory((wineResult.data ?? []).map((wine) => ({ id: wine.id, name: wine.name, producer: wine.producer ?? "", vintage: wine.vintage ?? "–", category: wine.category, stock: balances[wine.id] ?? 0, minStock: 10, cartonsPerCase: wine.cartons_per_case ?? 6 })));
      setDataLoading(false);
    });
    return () => { mounted = false; };
  }, []);
  async function saveMovement() {
    if (!selectedWine?.id || !locationIds.Zentrallager || !locationIds[site]) return;
    const { error } = await supabase.rpc("record_stock_movement", { p_wine_id: selectedWine.id, p_from_location_id: locationIds.Zentrallager, p_to_location_id: locationIds[site], p_cartons: quantity, p_movement_type: "ausgabe", p_note: null });
    if (error) { showNotice(error.message); return; }
    setInventory((items) => items.map((item) => item.name === selectedWine.name ? { ...item, stock: item.stock - quantity } : item));
    setSelectedWine(null);
    showNotice(`${quantity} Karton ${selectedWine.name} an ${site} ausgegeben`);
  }
  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3500); }
  if (active === "Bestand") {
    return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => setActive("Übersicht")}>← Übersicht</button><div className="top-actions"><button className="icon-button" aria-label="Benachrichtigungen">♧<i /></button><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Zentrallager · Supabase Live-Daten</div><h1>Bestand</h1><p>61 Artikelpositionen aus der zentralen Weinlager-Liste.</p></div><button className="primary-button" onClick={() => showNotice("Wareneingang kommt als nächster Workflow")}>+ Wareneingang erfassen</button></div><div className="inventory-summary"><div><strong>1’806</strong><span>Kartons Gesamtbestand</span></div><div><strong>CHF 123’713</strong><span>Warenwert</span></div><div><strong>13</strong><span>Artikel ohne Bestand</span></div><div><strong>313</strong><span>Bestellte Kartons</span></div></div><section className="inventory-panel"><div className="panel-heading"><div><h2>Alle Artikel</h2><p>{dataLoading ? "Bestände werden geladen …" : "Live aus Supabase · Ausgabe wird dauerhaft protokolliert."}</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div><button className="filter-button">Alle Kategorien <span>≡</span></button></div><div className="inventory-table"><div className="inventory-row inventory-head"><span>Artikel</span><span>Kategorie</span><span>Lieferant</span><span>Bestand</span><span>Aktion</span></div>{filteredWines.map((wine) => <div className="inventory-row" key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.vintage} · {wine.stock * (wine.cartonsPerCase ?? 6)} Einzelflaschen</small></div></div><span className="category-pill">{wine.category}</span><span className="supplier">{wine.producer}</span><strong>{wine.stock} <small className="unit-label">Kartons</small></strong><button className="row-action" onClick={() => { setSelectedWine(wine); setQuantity(1); }}>Ausgabe →</button></div>)}</div></section><div className="demo-note">Quelle: Weinlager_VB_Zentrale (1).xlsx · Mindestbestände werden als nächster Schritt konfigurierbar</div></div>{selectedWine && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedWine(null)}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Schliessen" onClick={() => setSelectedWine(null)}>×</button><div className="eyebrow">Lagerbewegung · Ausgabe</div><h2 id="movement-title">{selectedWine.name}</h2><p className="modal-subtitle">Bestand aktuell: <strong>{selectedWine.stock} Kartons</strong></p><label>Betrieb<select value={site} onChange={(event) => setSite(event.target.value)}><option>Consum</option><option>VB</option><option>Nomad</option><option>Krafft</option><option>Silo</option></select></label><label>Anzahl Kartons<input type="number" min="1" max={selectedWine.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>{quantity > selectedWine.stock && <div className="form-error">Nicht genügend Bestand vorhanden.</div>}<button className="primary-button modal-submit" disabled={quantity > selectedWine.stock} onClick={saveMovement}>Ausgabe speichern</button></section></div>}</main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">Zentrales Lager</div></div></div>
        <div className="nav-label">Arbeitsbereich</div>
        <nav>{navItems.map((item, index) => <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => setActive(item)}><span className="nav-icon">{["⌂", "▦", "□", "↓", "◉"][index]}</span>{item}{item === "Bestellungen" && <span className="nav-count">2</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="nav-label">Verwaltung</div><button className="nav-item"><span className="nav-icon">⚙</span>Einstellungen</button><div className="user-chip"><div className="avatar">PS</div><div><strong>Philipp</strong><span>MVP-Modus</span></div><span className="dots">•••</span></div></div>
      </aside>
      <section className="content">
        <header className="topbar"><div className="breadcrumb">Volta Bräu <span>/</span> {active}</div><div className="top-actions"><button className="icon-button" aria-label="Benachrichtigungen" onClick={() => showNotice("Keine neuen Benachrichtigungen")}>♧<i /></button><div className="top-avatar">PS</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow">Donnerstag, 27. August 2026</div><h1>Guten Morgen, Philipp</h1><p>Hier ist der aktuelle Überblick über euer Weinlager.</p></div><button className="primary-button" onClick={() => showNotice("Wareneingang kann im nächsten Schritt erfasst werden")}>+ Wareneingang erfassen</button></div>
          {notice && <div className="toast">✓ {notice}</div>}
          <div className="metric-grid">
            <article className="metric-card"><div className="metric-top"><span>Bestand gesamt</span><span className="metric-icon plum">▦</span></div><strong>{totalStock}</strong><div className="metric-foot"><span className="trend">↗ 4.8%</span> <span>vs. letzter Monat</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Warenwert</span><span className="metric-icon gold">◆</span></div><strong>CHF 123&apos;713</strong><div className="metric-foot"><span>Einstandspreise · Zentrallager</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Knapp am Lager</span><span className="metric-icon orange">!</span></div><strong>{lowStock}</strong><div className="metric-foot warning-text"><span>Benötigen Aufmerksamkeit</span><span className="arrow">→</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Bestellte Kartons</span><span className="metric-icon blue">□</span></div><strong>313</strong><div className="metric-foot link-text" onClick={() => setActive("Bestellungen")}>Betriebsbestellungen <span className="arrow">→</span></div></article>
          </div>
          <div className="main-grid">
            <section className="panel stock-panel"><div className="panel-heading"><div><h2>Bestandsübersicht</h2><p>Die wichtigsten Weine im Zentrallager</p></div><button className="text-button" onClick={() => setActive("Bestand")}>Alle anzeigen <span>→</span></button></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div><button className="filter-button">Filter <span>≡</span></button></div><div className="wine-table"><div className="table-row table-head"><span>Wein</span><span>Kategorie</span><span>Bestand</span><span>Status</span></div>{filteredWines.slice(0, 5).map((wine) => <div className="table-row" key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.producer} · {wine.vintage}</small></div></div><span className="category-pill">{wine.category}</span><span className="stock-number">{wine.stock} <small>Kartons</small></span><span className={wine.stock < wine.minStock ? "status-low" : "status-good"}><i />{wine.stock < wine.minStock ? "Niedrig" : "Gut"}</span></div>)}</div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><h2>Letzte Aktivitäten</h2><p>Aktuelle Lagerbewegungen</p></div><button className="more-button">•••</button></div><div className="activity-list">{movements.map((movement) => <div className="activity" key={`${movement[1]}-${movement[3]}`}><div className={`activity-icon ${movement[4]}`}>{movement[4] === "green" ? "↓" : movement[4] === "blue" ? "◉" : "↑"}</div><div className="activity-copy"><strong>{movement[1]}</strong><span>{movement[0]} · {movement[2]}</span></div><time>{movement[3]}</time></div>)}</div><button className="activity-footer" onClick={() => setActive("Bestand")}>Gesamte Historie ansehen <span>→</span></button></section>
          </div>
          <section className="quick-actions"><div><h2>Schnellzugriff</h2><p>Häufig verwendete Aktionen</p></div><div className="action-grid"><button onClick={() => showNotice("Bestellung für einen Betrieb wird vorbereitet")}><span className="action-icon purple">＋</span><span><strong>Neue Bestellung</strong><small>Für einen Betrieb erfassen</small></span><b>→</b></button><button onClick={() => showNotice("Inventur kann im nächsten Schritt gestartet werden")}><span className="action-icon yellow">◉</span><span><strong>Inventur starten</strong><small>Bestände überprüfen</small></span><b>→</b></button><button onClick={() => showNotice("Wein-Stammdaten kommen als nächster Baustein")}><span className="action-icon pink">♢</span><span><strong>Wein hinzufügen</strong><small>Neuen Wein anlegen</small></span><b>→</b></button></div></section>
          <div className="demo-note">Datenstand aus Weinlager_VB_Zentrale · 27. August 2026 · Mindestbestand wird im nächsten Schritt konfigurierbar</div>
        </div>
      </section>
    </main>
  );
}
