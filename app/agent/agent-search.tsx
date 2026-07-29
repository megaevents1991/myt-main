"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type AgentEvent = {
  id: number;
  name: string;
  date: string | null;
  location: string | null;
  price: number | null;
};

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("he-IL");
}

export function AgentSearch({
  events,
  trackingCode,
}: {
  events: AgentEvent[];
  trackingCode: string;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term
      ? events.filter(
          (e) =>
            e.name.toLowerCase().includes(term) ||
            (e.location ?? "").toLowerCase().includes(term),
        )
      : events;
    return pool.slice(0, 60);
  }, [events, query]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש לפי אירוע או עיר..."
        className="w-full rounded-md border px-3 py-2"
        aria-label="חיפוש חבילות"
      />

      {matches.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">לא נמצאו אירועים</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {matches.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{event.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {[event.location, formatDate(event.date)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-gray-600">
                  {event.price != null ? `${usd.format(event.price)} לנוסע` : "אזל"}
                </span>
                {/* The tracking code rides along, so the booking flow opens in
                    agent mode and the sale is attributed without a second step. */}
                <Link
                  href={`/order/${event.id}?utm_source=${encodeURIComponent(trackingCode)}`}
                  className="rounded-md bg-main px-3 py-1.5 text-sm font-medium text-white"
                >
                  בניית חבילה
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {matches.length === 60 && (
        <p className="text-xs text-gray-500">
          מוצגות 60 התוצאות הראשונות — חדדו את החיפוש כדי לראות עוד.
        </p>
      )}
    </div>
  );
}
