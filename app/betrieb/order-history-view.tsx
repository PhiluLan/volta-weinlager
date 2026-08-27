"use client";

import { useState } from "react";

type Ref<T> = T | T[] | null;
type OrderItem = { cartons: number; unit_price: number | null; wine: Ref<{ name: string; purchase_price: number | null }> };
type Order = { id: string; status: string; created_at: string; delivery_date: string | null; order_items: OrderItem[] };
type View = "order" | "inventory" | "history" | "monthly";

const one = <T,>(value: Ref<T>) => Array.isArray(value) ? value[0] : value;
const money = (value: number) => `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string | null) => value ? new Date(`${value.includes("T") ? value : `${value}T12:00:00`}`).toLocaleDateString("de-CH", { dateStyle: "medium" }) : "nicht erfasst";
const itemPrice = (item: OrderItem) => item.unit_price ?? one(item.wine)?.purchase_price ?? 0;

type Props = {
  profile: { email: string; location_name: string };
  orders: Order[];
  onView: (view: View) => void;
  onSignOut: () => void;
};

export default function OrderHistoryView({ profile, orders, onView, onSignOut }: Props) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  return (
    <main className="business-page">
      <header className="business-top">
        <div className="brand"><div className="brand-mark">VB</div><div><div className="brand-name">Volta Weinlager</div><div className="brand-sub">{profile.location_name}</div></div></div>
        <div className="business-user"><span>{profile.email}</span><button onClick={onSignOut}>Abmelden</button></div>
      </header>
      <div className="business-content">
        <div className="page-heading"><div><div className="eyebrow">{profile.location_name} · Persönlicher Bereich</div><h1>Meine Bestellungen</h1><p>Bestellen, Bestand prüfen und eigene Bestellungen nachvollziehen.</p></div></div>
        <div className="business-tabs">
          <button onClick={() => onView("order")}>Neue Bestellung</button><button onClick={() => onView("inventory")}>Bestand</button><button className="active" onClick={() => onView("history")}>Meine Bestellungen</button><button onClick={() => onView("monthly")}>Monatsübersicht</button>
        </div>
        <section className="inventory-panel business-history">
          <div className="panel-heading"><div><h2>Meine Bestellhistorie</h2><p>Nur Bestellungen für {profile.location_name}</p></div><span className="snapshot-badge">Geschützt</span></div>
          {orders.length === 0 ? <p className="empty-cart">Noch keine Bestellungen vorhanden.</p> : <div className="business-order-accordion">
            {orders.map((order) => {
              const items = order.order_items ?? [];
              const total = items.reduce((sum, item) => sum + item.cartons * itemPrice(item), 0);
              const cartons = items.reduce((sum, item) => sum + item.cartons, 0);
              const isExpanded = expandedOrder === order.id;
              return <article className="business-order-accordion-item" key={order.id}>
                <button className="business-order-summary" aria-expanded={isExpanded} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                  <span className="business-order-summary-main"><strong>Lieferung {dateLabel(order.delivery_date)}</strong><small>Bestellt am {dateLabel(order.created_at)} · {cartons} Kartons</small></span>
                  <span className="business-order-summary-total"><small>Bestellwert</small><strong>{money(total)}</strong></span>
                  <span className="business-order-summary-status"><span className={`order-status ${order.status}`}>{order.status === "delivered" ? "Erledigt" : "Übermittelt"}</span><span className="business-order-chevron">{isExpanded ? "⌃" : "⌄"}</span></span>
                </button>
                {isExpanded && <div className="business-order-details">
                  <div className="business-order-detail-row business-order-detail-head"><span>Position / Wein</span><span>Menge</span><span>Einzelpreis</span><span>Betrag</span></div>
                  {items.map((item, index) => { const price = itemPrice(item); return <div className="business-order-detail-row" key={`${order.id}-${index}`}><strong>{one(item.wine)?.name ?? "Unbekannter Wein"}</strong><span>{item.cartons} Kartons</span><span>{money(price)}</span><strong>{money(item.cartons * price)}</strong></div>; })}
                  <div className="business-order-detail-total"><span>Gesamtwert</span><strong>{money(total)}</strong></div>
                </div>}
              </article>;
            })}
          </div>}
        </section>
      </div>
    </main>
  );
}
