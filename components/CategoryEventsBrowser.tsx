"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he";
import { Slider } from "@mantine/core";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import type { EventTagChip } from "@/lib/taxonomy";
import type { TagType } from "@/lib/taxonomy.types";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { displayTagName } from "@/lib/tagDisplay";

/**
 * The category page's event browser.
 *
 * A category can hold 130+ packages - the page used to dump every card in one
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

/**
 * Facet groups shown as chip rows. City is skipped - the city dropdown
 * already covers it. `vertical` (כדורגל / מוסיקה) IS included: inside a
 * vertical hub every event carries the same one so it is auto-dropped as
 * non-narrowing, but on a DESTINATION page it is the cut people want
 * (Dor 21.8: "בעמודי יעדים... לדעת לסנן בין כדורגל והופעות") - and there it
 * renders as its own segmented row above the bar, not as an advanced chip.
 */
const TAG_GROUPS: { type: TagType; label: string }[] = [
  { type: "vertical", label: "סוג אירוע" },
  { type: "league", label: "ליגות" },
  { type: "team", label: "קבוצות" },
  { type: "genre", label: "ז'אנרים" },
  { type: "artist", label: "אומנים" },
  { type: "other", label: "תגיות" },
];
/** Chip rows: quick toggles. Dropdown groups: long lists (teams, artists, genres). */
const CHIP_TYPES = new Set<TagType>(["league", "other"]);
/** Rendered as a segmented row in the MAIN bar, never behind "חיפוש מתקדם". */
const PRIMARY_TYPES = new Set<TagType>(["vertical"]);
const DROPDOWN_TYPES = new Set<TagType>(["team", "genre", "artist"]);
const GROUP_CAP = 8;
const DROPDOWN_CAP = 40;

/** "לונדון, בריטניה" → "לונדון" - the city is what people filter by. */
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

/**
 * Checkbox dropdown - same look as Dropdown, but selections toggle and the
 * list stays open (you're picking "ספטמבר וגם אוקטובר", not either-or).
 */
function MultiDropdown({
  label,
  allLabel,
  values,
  options,
  onChange,
}: {
  label: string;
  /** Button text while nothing is picked, and the clear-row text. */
  allLabel: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
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

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? allLabel
        : `${values.length} נבחרו`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

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
        <span className="flex-1 truncate text-right">{summary}</span>
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
          aria-multiselectable
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
        >
          <li role="option" aria-selected={values.length === 0}>
            <button
              type="button"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-4 py-3 text-right text-sm transition-colors hover:bg-foreground/5",
                values.length === 0 ? "font-bold text-primary" : "font-medium text-foreground"
              )}
            >
              {allLabel}
            </button>
          </li>
          {options.map((o) => {
            const on = values.includes(o.value);
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-right text-sm transition-colors hover:bg-foreground/5",
                    on ? "font-bold text-primary" : "font-medium text-foreground"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card"
                    )}
                  >
                    {on && (
                      <svg viewBox="0 0 10 8" className="size-2.5" fill="none">
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CategoryEventsBrowser({
  events,
  tagsByEvent = {},
  headingId,
  hideCityFacet = false,
  searchPlaceholder = "קבוצה, אמן או עיר",
  hideTagTypes = [],
}: {
  events: Event[];
  /** Feed tag chips per event id - the sharpest slice of a category. */
  tagsByEvent?: Record<number, EventTagChip[]>;
  headingId?: string;
  /** On a city page every event shares the city - drop the redundant filter. */
  hideCityFacet?: boolean;
  /** Per-page wording (creative 2026-08-20): football "קבוצה, ליגה או עיר",
   * music "אמן או עיר", destination "קבוצה או אמן". */
  searchPlaceholder?: string;
  /** Facet groups that make no sense on this page (e.g. the genre dropdown
   * ON a genre page, artists on a league page). */
  hideTagTypes?: TagType[];
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(ALL);
  // Multi-select: a trip can span "ספטמבר או אוקטובר" - OR within the group.
  const [months, setMonths] = useState<string[]>([]);
  // Exact window inside (or instead of) the month picks - "מתאריך / עד תאריך"
  // in the advanced panel (Dor 21.8). ISO yyyy-mm-dd, "" = open-ended.
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [maxPrice, setMaxPrice] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("date");
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Mobile keeps the filters one tap away instead of pushing the grid down.
  const [openOnMobile, setOpenOnMobile] = useState(false);
  // The bar shows only search/city/month/sort; chips, long dropdowns, the
  // price slider and the sold-out toggle live behind "חיפוש מתקדם" so the
  // desktop panel stays one row tall.
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    // No ALL entry - the multi dropdown renders its own "clear" row.
    return [...keys.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, n]) => ({
        value: k,
        label: `${dayjs(`${k}-01`).locale("he").format("MMMM YYYY")} (${n})`,
      }));
  }, [events]);

  // Price bounds for the slider (redesign spec: "מחירים סרגל מחיר") - from the
  // real spread, rounded to $100 so the handle lands on readable numbers.
  const priceBounds = useMemo(() => {
    const prices = events
      .map((e) => computePackagePrice(e))
      .filter((p): p is number => p != null && p > 0);
    if (prices.length < 2) return null;
    const min = Math.floor(Math.min(...prices) / 100) * 100;
    const max = Math.ceil(Math.max(...prices) / 100) * 100;
    return min < max ? { min, max } : null;
  }, [events]);

  /**
   * The feed tags carried by the events on screen, grouped by type - the same
   * tags the Meta catalogue targets on. Inside כדורגל these are "ליגה
   * אנגלית", "ליגה איטלקית" and so on, which is the cut people actually want.
   *
   * A tag is dropped only when it cannot narrow anything: carried by one event
   * or by (nearly) all of them. Note what is NOT excluded - the tags that
   * COMPOSE this category. They looked redundant, but in כדורגל those are
   * exactly the league tags, and excluding them left the bar with nothing
   * useful on it.
   *
   * `type` falls back to "other" here too - pre-migration data (or any caller
   * that skips getTagsForEvents' own fallback) must still land in a bucket
   * instead of vanishing from every group's filter.
   */
  const tagGroups = useMemo(() => {
    const counts = new Map<string, { type: TagType; n: number }>();
    events.forEach((e) => {
      (tagsByEvent[e.id] ?? []).forEach((t) => {
        const type = t.type ?? "other";
        const cur = counts.get(t.name) ?? { type, n: 0 };
        counts.set(t.name, { type: cur.type, n: cur.n + 1 });
      });
    });
    const coversAll = Math.max(1, Math.floor(events.length * 0.95));
    return TAG_GROUPS.filter((g) => !hideTagTypes.includes(g.type)).map((g) => ({
      ...g,
      options: [...counts.entries()]
        .filter(([, v]) => v.type === g.type && v.n > 1 && v.n < coversAll)
        .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
        .slice(0, DROPDOWN_TYPES.has(g.type) ? DROPDOWN_CAP : GROUP_CAP)
        .map(([name, v]) => [name, v.n] as [string, number]),
    })).filter((g) => g.options.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hideTagTypes is a per-page constant
  }, [events, tagsByEvent, hideTagTypes.join(",")]);

  /** Tag name → type, for grouping the current chip selection when filtering. */
  const typeByName = useMemo(() => {
    const m = new Map<string, TagType>();
    Object.values(tagsByEvent).forEach((list) =>
      list.forEach((t) => m.set(t.name, t.type ?? "other")),
    );
    return m;
  }, [tagsByEvent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const max = maxPrice === ALL ? null : Number(maxPrice);
    const arr = events.filter((e) => {
      if (hideSoldOut && isEventSoldOut(e)) return false;
      // Standard faceting: OR within a group (two leagues widen, they don't
      // contradict), AND across groups (a league + a team narrows both ways).
      if (tags.length) {
        const names = new Set((tagsByEvent[e.id] ?? []).map((t) => t.name));
        const byGroup = new Map<TagType, string[]>();
        tags.forEach((t) => {
          const g = typeByName.get(t) ?? "other";
          (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(t);
        });
        for (const sel of byGroup.values()) {
          if (!sel.some((t) => names.has(t))) return false;
        }
      }
      if (city !== ALL && cityOf(e) !== city) return false;
      if (months.length && !months.includes(monthKeyOf(e))) return false;
      // Exact window narrows further (AND with the month picks), so "ספטמבר"
      // + 10-20.9 shows just that stretch.
      if (dateFrom || dateTo) {
        const d = e.date ? dayjs(e.date).format("YYYY-MM-DD") : "";
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
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
  }, [events, query, city, months, dateFrom, dateTo, maxPrice, sort, hideSoldOut, tags, tagsByEvent, typeByName]);

  // A narrower filter should show its results from the top, not mid-list.
  useEffect(
    () => setVisible(PAGE_SIZE),
    [query, city, months, dateFrom, dateTo, maxPrice, sort, hideSoldOut, tags]
  );

  const dirty =
    query.trim() !== "" ||
    city !== ALL ||
    months.length > 0 ||
    dateFrom !== "" ||
    dateTo !== "" ||
    maxPrice !== ALL ||
    hideSoldOut ||
    tags.length > 0;

  // Advanced-only filters that are active while the advanced block is closed -
  // the toggle shows a dot so a hidden filter never narrows silently. The
  // vertical row lives in the main bar, so its picks don't count here.
  const advancedDirty =
    maxPrice !== ALL ||
    hideSoldOut ||
    dateFrom !== "" ||
    dateTo !== "" ||
    tags.some((t) => !PRIMARY_TYPES.has(typeByName.get(t) ?? "other"));

  const clear = () => {
    setQuery("");
    setCity(ALL);
    setMonths([]);
    setDateFrom("");
    setDateTo("");
    setMaxPrice(ALL);
    setHideSoldOut(false);
    setTags([]);
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  /** Date-picker bounds: the selected months when there are any, else the
   *  whole catalogue on screen - so the range picker can only land on dates
   *  that could actually return something. */
  const monthBounds = useMemo(() => {
    const keys = months.length
      ? [...months].sort()
      : [...new Set(events.map(monthKeyOf).filter(Boolean))].sort();
    if (!keys.length) return null;
    return {
      min: dayjs(`${keys[0]}-01`).format("YYYY-MM-DD"),
      max: dayjs(`${keys[keys.length - 1]}-01`).endOf("month").format("YYYY-MM-DD"),
    };
  }, [months, events]);

  /** The vertical facet, when it actually narrows this page (a city with both
   *  football and concerts). Absent inside a vertical hub - there every event
   *  carries the same one, so tagGroups already dropped it. */
  const verticalGroup = tagGroups.find((g) => g.type === "vertical") ?? null;

  /** Single-select per dropdown group; ALL clears that group's pick. */
  const selectedOfType = (type: TagType) =>
    tags.find((t) => (typeByName.get(t) ?? "other") === type) ?? ALL;
  const selectOfType = (type: TagType, v: string) =>
    setTags((prev) => [
      ...prev.filter((t) => (typeByName.get(t) ?? "other") !== type),
      ...(v === ALL ? [] : [v]),
    ]);

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
        {/* ---- סוג אירוע: the vertical segmented row. Only rendered where a
             vertical actually narrows - i.e. a destination page carrying both
             football and concerts (Dor 21.8). ---- */}
        {verticalGroup && (
          <div
            className="mb-3 flex flex-wrap gap-2"
            role="group"
            aria-label="סינון לפי סוג אירוע"
          >
            <button
              type="button"
              onClick={() => selectOfType("vertical", ALL)}
              aria-pressed={selectedOfType("vertical") === ALL}
              className={cn(
                "flex h-11 items-center rounded-full border px-4 text-sm font-bold transition-colors",
                selectedOfType("vertical") === ALL
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-foreground/[0.03]"
              )}
            >
              הכל
            </button>
            {verticalGroup.options.map(([tag, count]) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => selectOfType("vertical", on ? ALL : tag)}
                  aria-pressed={on}
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-foreground/[0.03]"
                  )}
                >
                  {tag}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      on ? "opacity-80" : "text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                placeholder={searchPlaceholder}
                className={cn(CONTROL, "pr-9 font-medium placeholder:font-normal")}
              />
            </div>
          </div>

          {!hideCityFacet && (
            <Dropdown label="עיר" value={city} options={cityOptions} onChange={setCity} />
          )}
          <MultiDropdown
            label="חודש"
            allLabel="כל התאריכים"
            values={months}
            options={monthOptions}
            onChange={setMonths}
          />
          <Dropdown
            label="מיון"
            value={sort}
            options={SORTS}
            onChange={(v) => setSort(v as SortKey)}
          />
        </div>

        {/* ---- חיפוש מתקדם: chips, long dropdowns, price slider, sold-out ---- */}
        {advancedOpen && (
          <div
            id="advanced-filters"
            className="mt-4 space-y-4 border-t border-border pt-4"
          >
            {/* ---- טווח תאריכים מדויק. Narrows further inside whatever the
                 month picker selected, so "ספטמבר" + 10→20.9 works
                 (Dor 21.8). Bounds follow the month picks so the pickers
                 can't wander outside them. ---- */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                טווח תאריכים
                {months.length > 0 && (
                  <span className="font-medium"> · בתוך החודשים שנבחרו</span>
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">
                    מתאריך
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    min={monthBounds?.min}
                    max={dateTo || monthBounds?.max}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={cn(CONTROL, "flex-1")}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">
                    עד תאריך
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || monthBounds?.min}
                    max={monthBounds?.max}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={cn(CONTROL, "flex-1")}
                  />
                </label>
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  נקה טווח תאריכים
                </button>
              )}
            </div>

            {tagGroups
              .filter((g) => CHIP_TYPES.has(g.type) && !PRIMARY_TYPES.has(g.type))
              .map((g) => (
                <div key={g.type}>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{g.label}</p>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label={`סינון לפי ${g.label}`}
                  >
                    {g.options.map(([tag, count]) => {
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
                          {displayTagName(tag, g.type)}
                          <span
                            className={cn(
                              "text-xs font-medium",
                              on ? "opacity-80" : "text-muted-foreground"
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

            {tagGroups.some((g) => DROPDOWN_TYPES.has(g.type)) && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tagGroups
                  .filter((g) => DROPDOWN_TYPES.has(g.type))
                  .map((g) => (
                    <Dropdown
                      key={g.type}
                      label={g.label}
                      value={selectedOfType(g.type)}
                      options={[
                        { value: ALL, label: `כל ה${g.label}` },
                        ...g.options.map(([tag, count]) => ({
                          value: tag,
                          label: `${displayTagName(tag, g.type)} (${count})`,
                        })),
                      ]}
                      onChange={(v) => selectOfType(g.type, v)}
                    />
                  ))}
              </div>
            )}

            {/* Price slider - "סרגל מחיר" (redesign spec). ALL = handle parked at max. */}
            {priceBounds && (
              <div className="max-w-sm" dir="ltr">
                <p
                  className="mb-1.5 text-right text-xs font-semibold text-muted-foreground"
                  dir="rtl"
                >
                  מחיר מקסימלי לנוסע:{" "}
                  <span className="font-bold text-foreground">
                    {maxPrice === ALL
                      ? "ללא הגבלה"
                      : `$${Number(maxPrice).toLocaleString("en-US")}`}
                  </span>
                </p>
                <Slider
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={100}
                  value={maxPrice === ALL ? priceBounds.max : Number(maxPrice)}
                  onChange={(v) => setMaxPrice(v >= priceBounds.max ? ALL : String(v))}
                  label={(v) => `$${v.toLocaleString("en-US")}`}
                  color="teal"
                  aria-label="מחיר מקסימלי"
                />
              </div>
            )}

            <label className="flex h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={hideSoldOut}
                onChange={(e) => setHideSoldOut(e.target.checked)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              רק חבילות זמינות
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            aria-controls="advanced-filters"
            className="flex h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03]"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            חיפוש מתקדם
            {advancedDirty && !advancedOpen && (
              <span className="size-2 rounded-full bg-primary" aria-hidden />
            )}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
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
