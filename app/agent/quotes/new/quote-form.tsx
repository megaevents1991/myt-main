"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuote, type QuoteEventOption, type QuoteLineItem } from "@/lib/quote-actions";
import { round2, type CommissionTerms as SharedCommissionTerms } from "@/lib/partner-commission";

type CommissionTerms = SharedCommissionTerms | null;

export function QuoteForm({
  events,
  terms,
}: {
  events: QuoteEventOption[];
  terms: CommissionTerms;
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState<number | "">("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  const [extraItems, setExtraItems] = useState<QuoteLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId) || null,
    [events, eventId],
  );
  const suggestedPrice = selectedEvent?.suggested_price ?? null;

  // Mirrors the server's own formula exactly (lib/quote-actions.ts,
  // createQuote) — a live preview, not the enforcement. The server never
  // trusts this number; it recomputes the same check from a freshly-fetched
  // event row and partner commission.
  const discountWarning = useMemo(() => {
    if (suggestedPrice == null || unitPrice === "" || !terms) return null;
    const quoted = round2(Number(unitPrice));
    const discountPerTraveller = round2(suggestedPrice - quoted);
    if (discountPerTraveller <= 0) return null;
    const rate = terms.rate ?? 0;
    const commissionPerTraveller = round2(
      terms.type === "percent_of_sale" ? (quoted * rate) / 100 : rate,
    );
    if (discountPerTraveller > commissionPerTraveller + 0.001) {
      return `ההנחה המקסימלית שלכם היא $${commissionPerTraveller} לנוסע. הורדתם $${discountPerTraveller}.`;
    }
    return null;
  }, [suggestedPrice, unitPrice, terms]);

  const packageTotal =
    unitPrice === "" ? 0 : round2(Number(unitPrice) * qty);
  const extrasTotal = round2(extraItems.reduce((s, i) => s + i.qty * i.unit_price, 0));
  const grandTotal = round2(packageTotal + extrasTotal);

  const addExtraItem = () =>
    setExtraItems((items) => [...items, { label: "", qty: 1, unit_price: 0 }]);
  const updateExtraItem = (index: number, patch: Partial<QuoteLineItem>) =>
    setExtraItems((items) =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const removeExtraItem = (index: number) =>
    setExtraItems((items) => items.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanExtraItems = extraItems.filter((item) => item.label.trim());
    if (!selectedEvent && cleanExtraItems.length === 0) {
      setError("יש להוסיף לפחות פריט אחד");
      return;
    }
    if (selectedEvent && unitPrice === "") {
      setError("יש להזין מחיר לנוסע");
      return;
    }

    setSubmitting(true);
    try {
      // The package line itself (label, qty, price) is built server-side from
      // `package` — never sent as a plain line item — so it can't diverge
      // from what the discount cap actually checked.
      const result = await createQuote({
        event_id: selectedEvent ? selectedEvent.id : null,
        customer_name: customerName,
        title: title || selectedEvent?.name || "הצעת מחיר",
        extra_line_items: cleanExtraItems,
        package:
          selectedEvent && unitPrice !== ""
            ? { qty, unit_price: Number(unitPrice) }
            : null,
        notes: notes || null,
        valid_until: validUntil || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/agent/quotes/${result.id}`);
    } catch {
      setError("שגיאת רשת — נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div>
        <label className="block text-sm font-medium">אירוע (אופציונלי)</label>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={eventId}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : "";
            setEventId(id);
            const ev = events.find((x) => x.id === id);
            if (ev?.suggested_price != null) setUnitPrice(ev.suggested_price);
          }}
        >
          <option value="">— ללא אירוע (הצעה חופשית) —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} {ev.date ? `— ${new Date(ev.date).toLocaleDateString("he-IL")}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-gray-50 p-3">
          <div>
            <label className="block text-sm font-medium">מספר נוסעים</label>
            <input
              type="number"
              min={1}
              max={999}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              מחיר לנוסע {suggestedPrice != null && `(מחיר המערכת: $${suggestedPrice})`}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={unitPrice}
              onChange={(e) =>
                setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </div>
          {discountWarning && (
            <p className="col-span-2 text-sm font-medium text-red-600">{discountWarning}</p>
          )}
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium">פריטים נוספים</label>
          <button
            type="button"
            onClick={addExtraItem}
            className="text-sm font-medium text-main hover:underline"
          >
            + הוספת פריט
          </button>
        </div>
        <div className="space-y-2">
          {extraItems.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="תיאור"
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                value={item.label}
                onChange={(e) => updateExtraItem(i, { label: e.target.value })}
              />
              <input
                type="number"
                min={1}
                placeholder="כמות"
                className="w-20 rounded-md border px-3 py-2 text-sm"
                value={item.qty}
                onChange={(e) => updateExtraItem(i, { qty: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="מחיר"
                className="w-24 rounded-md border px-3 py-2 text-sm"
                value={item.unit_price}
                onChange={(e) => updateExtraItem(i, { unit_price: Number(e.target.value) })}
              />
              <button
                type="button"
                onClick={() => removeExtraItem(i)}
                className="text-sm text-red-600"
                aria-label="הסרת פריט"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">שם הלקוח</label>
          <input
            required
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">כותרת ההצעה</label>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder={selectedEvent?.name || "הצעת מחיר"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">בתוקף עד</label>
          <input
            type="date"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">הערות</label>
        <textarea
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-gray-50 p-3 text-sm">
        <p>
          סה&quot;כ: <span className="font-bold">${grandTotal.toLocaleString()}</span>
        </p>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-main px-4 py-2 font-medium text-main-foreground hover:bg-main/90 disabled:opacity-50"
      >
        {submitting ? "יוצר הצעה..." : "יצירת הצעה"}
      </button>
    </form>
  );
}
