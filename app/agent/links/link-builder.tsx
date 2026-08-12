"use client";

import { useMemo, useState } from "react";
import type { QuoteEventOption } from "@/lib/quote-actions";
import { partnerLink } from "@/lib/agent-links";

function CopyLinkField({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700"
          dir="ltr"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard unavailable - the field above can be selected manually */
            }
          }}
          className="shrink-0 rounded-md bg-main px-4 py-2 text-sm font-medium text-main-foreground hover:bg-main/90"
        >
          {copied ? "הועתק ✓" : "העתקה"}
        </button>
      </div>
    </div>
  );
}

export function LinkBuilder({
  trackingCode,
  events,
}: {
  trackingCode: string;
  events: QuoteEventOption[];
}) {
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState<number | "">("");

  const generalLink = useMemo(() => partnerLink(trackingCode), [trackingCode]);

  // Keep the currently-selected event visible in the list even if a later
  // search term would otherwise filter it out - losing the selection out
  // from under the user just because they kept typing would be surprising.
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? events.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.location ? e.location.toLowerCase().includes(q) : false),
        )
      : events;
    if (eventId !== "" && !list.some((e) => e.id === eventId)) {
      const selected = events.find((e) => e.id === eventId);
      if (selected) list = [selected, ...list];
    }
    return list;
  }, [events, search, eventId]);

  const eventLink = eventId === "" ? null : partnerLink(trackingCode, eventId);

  return (
    <section className="space-y-4 rounded-md border p-4" dir="rtl">
      <div>
        <h2 className="font-bold">קישורי מעקב</h2>
        <p className="text-sm text-gray-500">
          כל הזמנה שתתבצע דרך הקישורים האלה תסומן עם קוד המעקב שלכם (
          <span className="font-mono">{trackingCode}</span>).
        </p>
      </div>

      <CopyLinkField label="קישור כללי לאתר" url={generalLink} />

      <div className="space-y-2 border-t pt-4">
        <label className="block text-sm font-medium">קישור לאירוע ספציפי</label>
        <input
          type="text"
          placeholder="חיפוש אירוע לפי שם או יעד..."
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={eventId}
          size={Math.min(8, Math.max(4, filteredEvents.length || 1))}
          onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : "")}
        >
          {filteredEvents.length === 0 ? (
            <option value="" disabled>
              {events.length === 0 ? "אין אירועים זמינים" : "לא נמצאו אירועים"}
            </option>
          ) : (
            filteredEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
                {ev.location ? ` - ${ev.location}` : ""}
                {ev.date ? ` - ${new Date(ev.date).toLocaleDateString("he-IL")}` : ""}
              </option>
            ))
          )}
        </select>
        {eventLink && <CopyLinkField label="קישור לאירוע שנבחר" url={eventLink} />}
      </div>
    </section>
  );
}
