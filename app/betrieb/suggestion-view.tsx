"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

type View = "order" | "inventory" | "history" | "monthly" | "suggestion";
type Props = { profile: { id: string; location_id: string; location_name: string; email: string }; onView: (view: View) => void; onSignOut: () => void; onSent: (message: string) => void };

export default function SuggestionView({ profile, onView, onSignOut, onSent }: Props) {
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [vintage, setVintage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !supplier.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("purchase_requests").insert({ request_type: "suggestion", location_id: profile.location_id, created_by: profile.id, title: name.trim(), supplier: supplier.trim(), vintage: vintage.trim() || null, desired_quantity: quantity ? Number(quantity) : null, note: comment.trim() || null });
    setSaving(false);
    if (error) { onSent("Weinvorschlag konnte nicht gesendet werden"); return; }
    setName(""); setSupplier(""); setVintage(""); setQuantity(""); setComment(""); onSent("Weinvorschlag wurde an Philipp gesendet");
  }

  return <main className="business-page"><header className="business-top"><div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">{profile.location_name}</div></div></div><div className="business-user"><span>{profile.email}</span><button onClick={onSignOut}>Abmelden</button></div></header><div className="business-content"><div className="page-heading"><div><div className="eyebrow">{profile.location_name} · Persönlicher Bereich</div><h1>Wein vorschlagen</h1><p>Schlage einen Wein vor, den Philipp für euren Betrieb prüfen und bestellen kann.</p></div></div><div className="business-tabs"><button onClick={() => onView("order")}>Neue Bestellung</button><button onClick={() => onView("inventory")}>Bestand</button><button onClick={() => onView("history")}>Meine Bestellungen</button><button onClick={() => onView("monthly")}>Monatsübersicht</button><button className="active" onClick={() => onView("suggestion")}>Wein vorschlagen</button></div><section className="inventory-panel suggestion-page-panel"><div className="suggestion-intro"><div><div className="eyebrow">Sortiment mitgestalten</div><h2>Dein Vorschlag</h2><p>Name und Lieferant sind Pflichtfelder. Alles Weitere hilft Philipp bei der Prüfung.</p></div><span className="snapshot-badge">Direkt an Philipp</span></div><div className="suggestion-form-grid"><label>Name des Weins *<input value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Chardonnay Réserve" /></label><label>Lieferant *<input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="z. B. Rivera Weinhandel" /></label><label>Jahrgang<input value={vintage} onChange={(event) => setVintage(event.target.value)} placeholder="z. B. 2024" /></label><label>Gewünschte Menge<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Kartons" /></label><label className="suggestion-comment">Kommentar<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Warum passt dieser Wein zu eurem Betrieb?" rows={5} /></label></div><button className="primary-button suggestion-submit" disabled={!name.trim() || !supplier.trim() || saving} onClick={submit}>{saving ? "Wird gesendet …" : "Vorschlag an Philipp senden"}</button></section></div></main>;
}
