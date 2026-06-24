"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { ArrowUp, Search, SlidersHorizontal, X } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { EventCard } from "@/components/EventCard";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";

const fuseOptions = {
  keys: ["name", "location.name", "name_english"],
  threshold: 0.35,
  ignoreLocation: true,
};

type Category = "all" | "music" | "sports";
type SortKey = "relevance" | "price-asc" | "price-desc" | "date-asc";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "music", label: "מוזיקה" },
  { key: "sports", label: "ספורט" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "רלוונטיות" },
  { key: "price-asc", label: "מחיר: מהנמוך" },
  { key: "price-desc", label: "מחיר: מהגבוה" },
  { key: "date-asc", label: "תאריך: הקרוב" },
];

// Sports events vs everything else (concerts). Mondial football is a tx_event
// but belongs under sports.
const categoryOf = (e: Event): Exclude<Category, "all"> =>
  e.type === "sports_event" ||
  e.type === "sports_event_dynamic" ||
  (e.type === "tx_event" && e.name.startsWith("מונדיאל"))
    ? "sports"
    : "music";

export type SearchInitial = {
  q?: string;
  cat?: Category;
  city?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  sold?: string;
  ticket?: string;
  sort?: SortKey;
};

export const SearchResults = ({
  events,
  initial,
}: {
  events: Event[];
  initial: SearchInitial;
}) => {
  const router = useRouter();

  const [query, setQuery] = useState(initial.q ?? "");
  const [category, setCategory] = useState<Category>(initial.cat ?? "all");
  const [city, setCity] = useState(initial.city ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [minPrice, setMinPrice] = useState(initial.min ?? "");
  const [maxPrice, setMaxPrice] = useState(initial.max ?? "");
  const [includeSold, setIncludeSold] = useState(initial.sold === "1");
  const [ticketOnly, setTicketOnly] = useState(initial.ticket === "1");
  const [sort, setSort] = useState<SortKey>(initial.sort ?? "relevance");
  const [showFilters, setShowFilters] = useState(false);

  const fuse = useMemo(() => new Fuse(events, fuseOptions), [events]);

  // Price (USD) cached once per event for filtering + sorting.
  const priceOf = useMemo(() => {
    const m = new Map<number, number | null>();
    events.forEach((e) => m.set(e.id, computePackagePrice(e)));
    return m;
  }, [events]);

  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          events.map((e) => e.location?.name).filter((n): n is string => !!n)
        )
      ).sort((a, b) => a.localeCompare(b, "he")),
    [events]
  );

  // Keep the URL shareable/deep-linkable as filters change.
  useEffect(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (category !== "all") p.set("cat", category);
    if (city) p.set("city", city);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (minPrice) p.set("min", minPrice);
    if (maxPrice) p.set("max", maxPrice);
    if (includeSold) p.set("sold", "1");
    if (ticketOnly) p.set("ticket", "1");
    if (sort !== "relevance") p.set("sort", sort);
    const qs = p.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }, [
    query,
    category,
    city,
    from,
    to,
    minPrice,
    maxPrice,
    includeSold,
    ticketOnly,
    sort,
    router,
  ]);

  const results = useMemo(() => {
    const q = query.trim();
    // Base order: fuse relevance when searching, else date-ascending.
    let list: Event[] =
      q.length >= 2
        ? fuse.search(q).map((r) => r.item)
        : [...events].sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          );

    list = list.filter((e) => {
      if (!includeSold && isEventSoldOut(e)) return false;
      if (category !== "all" && categoryOf(e) !== category) return false;
      if (city && e.location?.name !== city) return false;
      if (ticketOnly && !e.skip_flight) return false;
      if (from && e.date && e.date < from) return false;
      if (to && e.date && e.date > to) return false;
      const price = priceOf.get(e.id);
      if (minPrice && (price === null || price < Number(minPrice))) return false;
      if (maxPrice && (price === null || price > Number(maxPrice))) return false;
      return true;
    });

    const byPrice = (a: Event, b: Event, dir: 1 | -1) => {
      const pa = priceOf.get(a.id);
      const pb = priceOf.get(b.id);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * dir;
    };

    if (sort === "price-asc") list = [...list].sort((a, b) => byPrice(a, b, 1));
    else if (sort === "price-desc")
      list = [...list].sort((a, b) => byPrice(a, b, -1));
    else if (sort === "date-asc")
      list = [...list].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

    return list;
  }, [
    query,
    fuse,
    events,
    category,
    city,
    from,
    to,
    minPrice,
    maxPrice,
    includeSold,
    ticketOnly,
    sort,
    priceOf,
  ]);

  useEffect(() => {
    trackEvent("searchPageQuery", {
      query: query.trim(),
      category,
      city,
      resultsCount: results.length,
    });
    // Only when the query itself changes — avoid firing on every filter tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasActiveFilters =
    category !== "all" ||
    !!city ||
    !!from ||
    !!to ||
    !!minPrice ||
    !!maxPrice ||
    includeSold ||
    ticketOnly ||
    sort !== "relevance";

  const clearFilters = () => {
    setCategory("all");
    setCity("");
    setFrom("");
    setTo("");
    setMinPrice("");
    setMaxPrice("");
    setIncludeSold(false);
    setTicketOnly(false);
    setSort("relevance");
  };

  const fieldCls =
    "rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-card focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="ms-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש אירוע, אומן או עיר…"
          aria-label="חיפוש אירוע"
          className="min-w-0 flex-1 bg-transparent px-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          type="text"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="ניקוי חיפוש"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-label="מסננים"
          aria-expanded={showFilters}
          className={cn(
            "relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted md:hidden",
            showFilters ? "text-primary" : "text-muted-foreground"
          )}
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          {hasActiveFilters && (
            <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Category chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              category === c.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div
        className={cn(
          "mt-3 flex-wrap items-end gap-3 md:flex",
          showFilters ? "flex" : "hidden md:flex"
        )}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          עיר
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={fieldCls}
          >
            <option value="">כל הערים</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          מתאריך
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          עד תאריך
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={fieldCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          מחיר מ־ ($)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            className={cn(fieldCls, "w-24")}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          מחיר עד ($)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="∞"
            className={cn(fieldCls, "w-24")}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          מיון
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={fieldCls}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 py-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={ticketOnly}
            onChange={(e) => setTicketOnly(e.target.checked)}
            className="size-4 accent-primary"
          />
          כרטיס בלבד
        </label>

        <label className="flex cursor-pointer items-center gap-2 py-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={includeSold}
            onChange={(e) => setIncludeSold(e.target.checked)}
            className="size-4 accent-primary"
          />
          כולל אזל מהמלאי
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 py-2 text-sm font-medium text-primary hover:underline"
          >
            <X className="size-4" aria-hidden />
            ניקוי מסננים
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="mt-4 text-sm text-muted-foreground">
        {results.length === 0
          ? "לא נמצאו אירועים"
          : `${results.length.toLocaleString("he-IL")} אירועים`}
      </p>

      {/* Grid */}
      {results.length > 0 ? (
        <div
          role="list"
          className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {results.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="text-lg font-bold text-foreground">
            לא מצאנו אירועים מתאימים
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            נסו מונח חיפוש אחר או נקו את המסננים כדי לראות עוד אירועים.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowUp className="size-4 rotate-45" aria-hidden />
              ניקוי מסננים
            </button>
          )}
        </div>
      )}
    </div>
  );
};
