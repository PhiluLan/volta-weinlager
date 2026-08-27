"use client";

type Wine = { id?: string; name: string; producer: string; vintage: string; category: string; stock: number; minStock: number; originCountry?: string; grapeVarieties?: string };

type Props = {
  inventory: Wine[];
  query: string;
  setQuery: (value: string) => void;
  selectedId: string | null;
  name: string;
  producer: string;
  category: string;
  vintage: string;
  originCountry: string;
  grapeVarieties: string;
  bottleSize: string;
  cartonsPerCase: string;
  purchasePrice: string;
  minStock: string;
  setName: (value: string) => void;
  setProducer: (value: string) => void;
  setCategory: (value: string) => void;
  setVintage: (value: string) => void;
  setOriginCountry: (value: string) => void;
  setGrapeVarieties: (value: string) => void;
  setBottleSize: (value: string) => void;
  setCartonsPerCase: (value: string) => void;
  setPurchasePrice: (value: string) => void;
  setMinStock: (value: string) => void;
  onSelect: (wine: Wine) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  onBack: () => void;
};

export default function MasterDataView({ inventory, query, setQuery, selectedId, name, producer, category, vintage, originCountry, grapeVarieties, bottleSize, cartonsPerCase, purchasePrice, minStock, setName, setProducer, setCategory, setVintage, setOriginCountry, setGrapeVarieties, setBottleSize, setCartonsPerCase, setPurchasePrice, setMinStock, onSelect, onReset, onSave, saving, onBack }: Props) {
  const filtered = inventory.filter((wine) => `${wine.name} ${wine.producer} ${wine.category}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="inventory-page"><header className="inventory-top"><button className="back-button" onClick={onBack}>← Übersicht</button><div className="top-actions"><div className="top-avatar">PS</div></div></header><div className="inventory-content"><div className="page-heading"><div><div className="eyebrow">Weinstamm · Stammdaten</div><h1>Stammdaten</h1><p>Weine, Herkunft und Traubensorten zentral pflegen.</p></div><button className="primary-button" onClick={onReset}>＋ Neuer Wein</button></div><div className="master-layout"><section className="inventory-panel master-list"><div className="panel-heading"><div><h2>Weinliste</h2><p>{inventory.length} aktive Artikel</p></div><span className="snapshot-badge">Live verbunden</span></div><div className="search-row"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wein oder Produzent suchen..." /></div></div><div className="master-wines">{filtered.map((wine) => <button className={`master-wine ${selectedId === wine.id ? "selected" : ""}`} key={wine.id ?? wine.name} onClick={() => onSelect(wine)}><span><strong>{wine.name}</strong><small>{wine.producer || "Kein Lieferant"} · {wine.vintage !== "–" ? wine.vintage : "Jahrgang offen"}</small></span><b>{wine.stock} <em>Kartons</em></b></button>)}</div></section><section className="incoming-card master-form"><div className="eyebrow">{selectedId ? "Wein bearbeiten" : "Neuen Wein anlegen"}</div><h2>{selectedId ? "Stammdaten ändern" : "Wein hinzufügen"}</h2><label>Name *<input value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Cava Hills" /></label><div className="master-fields"><label>Produzent<input value={producer} onChange={(event) => setProducer(event.target.value)} placeholder="Lieferant" /></label><label>Kategorie *<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="z. B. Weisswein" /></label><label>Jahrgang<input value={vintage} onChange={(event) => setVintage(event.target.value)} placeholder="z. B. 2023 oder NV" /></label><label>Herkunftsland<input value={originCountry} onChange={(event) => setOriginCountry(event.target.value)} placeholder="z. B. Schweiz" /></label><label className="master-field-wide">Traubensorten<input value={grapeVarieties} onChange={(event) => setGrapeVarieties(event.target.value)} placeholder="z. B. Pinot Noir, Gamay" /></label><label>Flaschengrösse (l)<input type="number" min="0.01" step="0.01" value={bottleSize} onChange={(event) => setBottleSize(event.target.value)} placeholder="0.75" /></label><label>Kartons pro Einheit *<input type="number" min="1" step="1" value={cartonsPerCase} onChange={(event) => setCartonsPerCase(event.target.value)} /></label><label>Einkaufspreis / Karton (CHF)<input type="number" min="0" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} placeholder="0.00" /></label><label>Mindestbestand (Kartons) *<input type="number" min="0" step="1" value={minStock} onChange={(event) => setMinStock(event.target.value)} /></label></div><div className="master-actions"><button className="secondary-button" onClick={onReset}>Zurücksetzen</button><button className="primary-button" disabled={saving} onClick={onSave}>{saving ? "Wird gespeichert …" : selectedId ? "Änderungen speichern" : "Wein anlegen"}</button></div></section></div></div></main>;
}
