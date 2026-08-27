"use client";

export type InventoryWine = { id?: string; name: string; producer: string; vintage: string; category: string; stock: number; minStock: number; originCountry?: string; grapeVarieties?: string; cartonsPerCase?: number };

type Props = {
  inventory: InventoryWine[];
  filteredWines: InventoryWine[];
  query: string;
  setQuery: (value: string) => void;
  dataLoading: boolean;
  pendingOrderCartons: number;
  onIncoming: () => void;
  onBack: () => void;
  onSelectWine: (wine: InventoryWine) => void;
  selectedWine: InventoryWine | null;
  onClose: () => void;
  site: string;
  setSite: (value: string) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  onSaveMovement: () => void;
};

const groups = [
  { key: "sparkling", label: "Schaumweine", description: "Prosecco, Cava und alkoholfreie Schaumweine" },
  { key: "white", label: "Weissweine", description: "Weissweine und Roséweine" },
  { key: "red", label: "Rotweine", description: "Rotweine aus dem Zentrallager" },
  { key: "other", label: "Spirituosen / Sonstiges", description: "Weitere Artikel und Spezialitäten" },
];

function groupForCategory(category: string) {
  const value = category.toLowerCase();
  if (value.includes("schaum")) return "sparkling";
  if (value.includes("weiss") || value.includes("weiß") || value.includes("rosé") || value.includes("rose")) return "white";
  if (value.includes("rot")) return "red";
  return "other";
}

export default function InventoryView({ inventory, filteredWines, query, setQuery, dataLoading, pendingOrderCartons, onIncoming, onSelectWine, selectedWine, onClose, site, setSite, quantity, setQuantity, onSaveMovement }: Props) {
  return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={() => window.history.back()}>← Übersicht</button><div className="top-actions"><button className="icon-button" aria-label="Benachrichtigungen">♧<i /></button><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Zentrallager · Supabase Live-Daten</div><h1>Bestand</h1><p>Alle Artikel übersichtlich nach Sorten gruppiert.</p></div><button className="primary-button" onClick={onIncoming}>+ Wareneingang erfassen</button></div><div className="inventory-summary"><div><strong>{dataLoading ? "–" : inventory.reduce((sum, wine) => sum + wine.stock, 0).toLocaleString("de-CH")}</strong><span>Kartons Gesamtbestand</span></div><div><strong>CHF 123’713</strong><span>Warenwert</span></div><div><strong>{dataLoading ? "–" : inventory.filter((wine) => wine.stock === 0).length}</strong><span>Artikel ohne Bestand</span></div><div><strong>{pendingOrderCartons}</strong><span>Bestellte Kartons</span></div></div><section className="inventory-panel grouped-inventory"><div className="panel-heading"><div><h2>Bestand nach Sortiment</h2><p>{dataLoading ? "Bestände werden geladen …" : `${filteredWines.length} Artikel in der Auswahl`}</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div><button className="filter-button">Alle Kategorien <span>≡</span></button></div><div className="inventory-groups">{groups.map((group) => { const groupWines = filteredWines.filter((wine) => groupForCategory(wine.category) === group.key); return <section className={`inventory-group inventory-group-${group.key}`} key={group.key}><div className="inventory-group-heading"><div><span className="inventory-group-kicker">Sortiment</span><h3>{group.label}</h3><p>{group.description}</p></div><strong>{groupWines.length} <small>Artikel</small></strong></div>{groupWines.length === 0 ? <p className="inventory-group-empty">Keine passenden Artikel</p> : <div className="inventory-table"><div className="inventory-row inventory-head"><span>Artikel</span><span>Lieferant · Jahrgang · Herkunft</span><span>Bestand</span><span>Status</span><span>Aktion</span></div>{groupWines.map((wine) => <div className={`inventory-row ${wine.stock === 0 ? "out-of-stock" : ""}`} key={wine.name}><div className="wine-name"><div className="wine-bottle">♢</div><div><strong>{wine.name}</strong><small>{wine.grapeVarieties || "Traubensorte nicht erfasst"}</small></div></div><span className="supplier"><strong>{wine.producer || "–"}</strong><small>{wine.vintage !== "–" ? `Jahrgang ${wine.vintage}` : "Jahrgang nicht erfasst"} · {wine.originCountry || "Herkunft nicht erfasst"}</small></span><strong>{wine.stock} <small className="unit-label">Kartons</small></strong><span className={wine.stock < wine.minStock ? "status-low" : "status-good"}><i />{wine.stock < wine.minStock ? "Niedrig" : "Gut"}</span><button className="row-action" onClick={() => onSelectWine(wine)}>Ausgabe →</button></div>)}</div>}</section>; })}</div></section><div className="demo-note">Quelle: Weinlager_VB_Zentrale (1).xlsx · Sortierung: Schaumweine, Weissweine, Rotweine, Spirituosen / Sonstiges</div></div>{selectedWine && <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Schliessen" onClick={onClose}>×</button><div className="eyebrow">Lagerbewegung · Ausgabe</div><h2 id="movement-title">{selectedWine.name}</h2><p className="modal-subtitle">Bestand aktuell: <strong>{selectedWine.stock} Kartons</strong></p><label>Betrieb<select value={site} onChange={(event) => setSite(event.target.value)}><option>Consum</option><option>VB</option><option>Nomad</option><option>Krafft</option><option>Silo</option></select></label><label>Anzahl Kartons<input type="number" min="1" max={selectedWine.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>{quantity > selectedWine.stock && <div className="form-error">Nicht genügend Bestand vorhanden.</div>}<button className="primary-button modal-submit" disabled={quantity > selectedWine.stock} onClick={onSaveMovement}>Ausgabe speichern</button></section></div>}</main>;
}
