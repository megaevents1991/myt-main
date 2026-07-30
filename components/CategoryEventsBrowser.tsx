"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

/**
 * The category page's event browser.
 *
 * A category can hold 130+ packages — the page used to dump every card in one
 * scroll, which is unusable: you cannot find "Barcelona in October under
 * $2,000" by eye. Filters are derived from the events themselves (only cities
 * and months that exist appear), so no combination ever returns an empty grid
 * unless the user asks for one.
 *
 * Everything filters in the browser: the events are already on the page, so a
 * round trip per keystroke would be slower and would lose scroll position.
 */
type SortKey = "date" | "price_asc" | "price_desc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "date", label: "תאריך קרוב" },
  { value: "price_asc", label: "מחיר: מהזול ליקר" },
  { value: "price_desc", label: "מחיר: מהיקר לזול" },
];

const PAGE_SIZE = 24;
const ALL = "__all__";

const CONTROL =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/** "לונדון, בריטניה" → "לונדון" — the city is what people filter by. */
const cityOf = (event: Event) => (event.location?.name ?? "").split(",")[0].trim();

const monthKeyOf = (event: Event) => (event.date ? dayjs(event.date).format("YYYY-MM") : "");

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(CONTROL, "flex items-center justify-between gap-2 hover:bg-foreground/[0.03]")}
      >
        <span className="flex-1 truncate text-right">{current?.label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full border-t border-border px-4 py-3 text-right text-sm transition-colors first:border-t-0 hover:bg-foreground/5",
                  o.value === value ? "font-bold text-primary" : "font-medium text-foreground"
                )}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CategoryEventsBrowser({
  events,
  tagsByEvent = {},
  ownTags = [],
  headingId,
}: {
  events: Event[];
  /** Tag names per event id — the sharpest slice of a category (see below). */
  tagsByEvent?: Record<number, string[]>;
  /** The tags this category is MADE of — never offered as a filter inside it. */
  ownTags?: string[];
  headingId?: string;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(ALL);
  const [month, setMonth] = useState(ALL);
  const [maxPrice, setMaxPrice] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("date");
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Mobile keeps the filters one tap away instead of pushing the grid down.
  const [openOnMobile, setOpenOnMobile] = useState(false);

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      const c = cityOf(e);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return [
      { value: ALL, label: "כל הערים" },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c, n]) => ({ value: c, label: `${c} (${n})` })),
    ];
  }, [events]);

  const monthOptions = useMemo(() => {
    const keys = new Map<string, number>();
    events.forEach((e) => {
      const k = monthKeyOf(e);
      if (k) keys.set(k, (keys.get(k) ?? 0) + 1);
    });
    return [
      { value: ALL, label: "כל התאריכים" },
      ...[...keys.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, n]) => ({
          value: k,
          label: `${dayjs(`${k}-01`).format("MM/YYYY")} (${n})`,
        })),
    ];
  }, [events]);

  // Price steps come from the actual spread, so the options are never empty
  // and never all-inclusive.
  const priceOptions = useMemo(() => {
    const prices = events
      .map((e) => computePackagePrice(e))
      .filter((p): p is number => p != null && p > 0)
      .sort((a, b) => a - b);
    if (prices.length < 4) return [{ value: ALL, label: "כל המחירים" }];
    const step = (n: number) => Math.ceil(n / 100) * 100;
    const quartiles = [0.25, 0.5, 0.75].map((q) => step(prices[Math.floor(prices.length * q)]));
    return [
      { value: ALL, label: "כל המחירים" },
      ...[...new Set(quartiles)].map((p) => ({
        value: String(p),
        label: `עד $${p.toLocaleString("en-US")}`,
      })),
    ];
  }, [events]);

  /**
   * Tag chips lead the filter bar because tags are what a category IS made of
   * — inside כדורגל, "ליגה אנגלית" is the cut people actually want. Only tags
   * carried by the events on screen appear, ordered by how many they cover.
   */
  const tagOptions = useMemo(() => {
    const own = new Set(ownTags);
    const counts = new Map<string, number>();
    events.forEach((e) => {
      (tagsByEvent[e.id] ?? []).forEach((t) => {
        // A "כדורגל" chip inside כדורגל cuts nothing — that tag is the category.
        if (own.has(t)) return;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      });
    });
    return [...counts.entries()]
      .filter(([, n]) => n > 1 && n < events.length) // a tag on all or one slices nothing
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10);
  }, [events, tagsByEvent, ownTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const max = maxPrice === ALL ? null : Number(maxPrice);
    const arr = events.filter((e) => {
      if (hideSoldOut && isEventSoldOut(e)) return false;
      // OR across chips: picking two leagues widens, it doesn't contradict.
      if (tags.length && !tags.some((t) => (tagsByEvent[e.id] ?? []).includes(t))) {
        return false;
      }
      if (city !== ALL && cityOf(e) !== city) return false;
      if (month !== ALL && monthKeyOf(e) !== month) return false;
      if (max != null) {
        const p = computePackagePrice(e);
        if (p == null || p > max) return false;
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.location?.name ?? "").toLowerCase().includes(q)
      );
    });

    arr.sort((a, b) => {
      if (sort === "date") {
        return (
          (a.date ? dayjs(a.date).valueOf() : Infinity) -
          (b.date ? dayjs(b.date).valueOf() : Infinity)
        );
      }
      const pa = computePackagePrice(a);
      const pb = computePackagePrice(b);
      // Sold-out / priceless events sink to the bottom either way.
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return sort === "price_asc" ? pa - pb : pb - pa;
    });
    return arr;
  }, [events, query, city, month, maxPrice, sort, hideSoldOut, tags, tagsByEvent]);

  // A narrower filter should show its results from the top, not mid-list.
  useEffect(
    () => setVisible(PAGE_SIZE),
    [query, city, month, maxPrice, sort, hideSoldOut, tags]
  );

  const dirty =
    query.trim() !== "" ||
    city !== ALL ||
    month !== ALL ||
    maxPrice !== ALL ||
    hideSoldOut ||
    tags.length > 0;

  const clear = () => {
    setQuery("");
    setCity(ALL);
    setMonth(ALL);
    setMaxPrice(ALL);
    setHideSoldOut(false);
    setTags([]);
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length === events.length
            ? `${events.length} חבילות`
            : `${filtered.length} מתוך ${events.length} חבילות`}
        </p>
        <button
          type="button"
          onClick={() => setOpenOnMobile((v) => !v)}
          aria-expanded={openOnMobile}
          aria-controls="category-filters"
          className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm sm:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          סינון
          {dirty && <span className="size-2 rounded-full bg-primary" aria-hidden />}
        </button>
      </div>

      <div
        id="category-filters"
        className={cn(
          "rounded-2xl border border-border bg-card/60 p-4",
          openOnMobile ? "block" : "hidden sm:block"
        )}
      >
        {tagOptions.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">קטגוריות משנה</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי תגית">
              {tagOptions.map(([tag, count]) => {
                const on = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-pressed={on}
                    className={cn(
                      "flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-foreground/[0.03]"
                    )}
                  >
                    {tag}
                    <span className={cn("text-xs font-medium", on ? "opacity-80" : "text-muted-foreground")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <label
              htmlFor="category-search"
              className="mb-1.5 block text-xs font-semibold text-muted-foreground"
            >
              חיפוש
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <input
                id="category-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="קבוצה, אמן או עיר"
                className={cn(CONTROL, "pr-9 font-medium placeholder:font-normal")}
              />
            </div>
          </div>

          <Dropdown label="עיר" value={city} options={cityOptions} onChange={setCity} />
          <Dropdown label="חודש" value={month} options={monthOptions} onChange={setMonth} />
          <Dropdown label="מחיר" value={maxPrice} options={priceOptions} onChange={setMaxPrice} />
          <Dropdown
            label="מיון"
            value={sort}
            options={SORTS}
            onChange={(v) => setSort(v as SortKey)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={hideSoldOut}
              onChange={(e) => setHideSoldOut(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            רק חבילות זמינות
          </label>
          {dirty && (
            <button
              type="button"
              onClick={clear}
              className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
              נקה סינון
            </button>
          )}
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <div
            className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-labelledby={headingId}
          >
            {filtered.slice(0, visible).map((event) => (
              <EventCard key={event.id} event={event} showName />
            ))}
          </div>

          {visible < filtered.length && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="mx-auto flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03]"
            >
              הצג עוד ({filtered.length - visible})
            </button>
          )}
        </>
      ) : (
        <EmptyState
          title="אין חבילות שמתאימות לסינון"
          description="נסו להרחיב את טווח המחיר או לבחור חודש אחר."
          action={
            dirty ? (
              <button
                type="button"
                onClick={clear}
                className="h-11 rounded-xl bg-main px-5 text-sm font-bold text-main-foreground"
              >
                נקה סינון
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
