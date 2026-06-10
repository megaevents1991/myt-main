"use client";

import { useMemo } from "react";
import type { Event } from "@/lib/app.types";
import { cn } from "@/lib/utils";

/**
 * Quick-filter chips under the homepage search (per Figma). Built from real
 * event data — categories + cities + popular event names. Clicking a chip runs
 * a search for that term; "כל האירועים" opens the full search.
 */
export const EventFilters = ({
  events,
  onPick,
}: {
  events: Event[];
  onPick: (term: string) => void;
}) => {
  const chips = useMemo(() => {
    const cities = Array.from(
      new Set(events.map((e) => e.location?.name).filter(Boolean) as string[])
    ).slice(0, 6);
    const names = Array.from(
      new Set(events.map((e) => e.name).filter(Boolean))
    ).slice(0, 10);
    // De-dupe across the whole list, keep order: categories → cities → names.
    const seen = new Set<string>();
    return ["הופעות", "ספורט", "פסטיבלים", ...cities, ...names].filter((c) => {
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }, [events]);

  const chipBase =
    "rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      className="flex max-w-3xl flex-wrap justify-center gap-2"
      role="group"
      aria-label="קטגוריות מהירות"
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => onPick("")}
        className={cn(
          chipBase,
          "border-transparent bg-brand-violet text-[hsl(var(--foreground))]"
        )}
      >
        כל האירועים
      </button>
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className={cn(
            chipBase,
            "border-main-foreground/25 text-main-foreground hover:border-primary hover:bg-main-foreground/10"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
};
