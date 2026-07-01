"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { ChevronDown } from "lucide-react";

import { Event } from "@/lib/app.types";
import { computePackagePrice } from "@/lib/events/price";
import { EventCard } from "@/components/EventCard";
import { cn } from "@/lib/utils";

type SortKey = "date" | "price_asc" | "price_desc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "date", label: "תאריך קרוב" },
  { value: "price_asc", label: "מחיר: זול ליקר" },
  { value: "price_desc", label: "מחיר: יקר לזול" },
];

/**
 * Events list with a single sort control (nearest date / price asc / price
 * desc). The dropdown only appears when there's more than one event. Shared by
 * the artist and football detail pages; `showName` surfaces each event's own
 * name on the card (used on football, where the fixture isn't implied).
 */
export const ArtistEventsFilter = ({
  events,
  title,
  showName = false,
}: {
  events: Event[];
  title: string;
  showName?: boolean;
}) => {
  const [sort, setSort] = useState<SortKey>("date");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = useMemo(() => {
    const arr = [...events];
    if (sort === "date") {
      arr.sort((a, b) => {
        const da = a.date ? dayjs(a.date).valueOf() : Infinity;
        const db = b.date ? dayjs(b.date).valueOf() : Infinity;
        return da - db;
      });
    } else {
      arr.sort((a, b) => {
        const pa = computePackagePrice(a);
        const pb = computePackagePrice(b);
        // Sold-out / priceless events sink to the bottom either way.
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;
        return sort === "price_asc" ? pa - pb : pb - pa;
      });
    }
    return arr;
  }, [events, sort]);

  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0];

  return (
    <div className="flex flex-col gap-5">
      {events.length > 1 && (
        <div ref={menuRef} className="relative w-full sm:w-64">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
            <span className="flex-1 text-right">{current.label}</span>
          </button>

          {open && (
            <ul
              role="listbox"
              aria-label="מיון אירועים"
              className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              {SORTS.map((s) => (
                <li key={s.value} role="option" aria-selected={s.value === sort}>
                  <button
                    type="button"
                    onClick={() => {
                      setSort(s.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "block w-full border-t border-border px-4 py-3 text-right text-sm transition-colors first:border-t-0 hover:bg-foreground/5",
                      s.value === sort
                        ? "font-bold text-primary"
                        : "font-medium text-foreground"
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        className="grid auto-rows-fr gap-4 sm:grid-cols-2"
        role="list"
        aria-label="רשימת אירועים קרובים"
      >
        {sorted.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            title={showName ? event.name : title}
            showName={showName}
          />
        ))}
      </div>
    </div>
  );
};
