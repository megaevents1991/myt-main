"use client";

import { useId, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he";
import { Check, CircleAlert, Search, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { activeFilterCount, type CatalogFilter, type CatalogKind } from "@/lib/itinerary/builder";
import { describeCompat } from "@/lib/itinerary/rules";
import type { Compat } from "@/lib/itinerary/types";

/** A builder panel: the site's card surface. */
export const PANEL = "rounded-2xl border border-border bg-card p-4 shadow-card md:p-5";

/** Rows shown before "הצג עוד" - a long list stays fast on a phone. */
export const LIST_PAGE = 24;

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-display text-[19px] font-extrabold leading-tight">{children}</h2>;
}

/** The dark CTA of the site's cards and continue bar, small. */
export const ADD_BUTTON =
  "whitespace-nowrap rounded-md bg-main px-3.5 py-2 text-xs font-semibold text-main-foreground transition-colors hover:bg-secondary hover:text-black dark:bg-foreground dark:text-background dark:hover:bg-foreground/90 dark:hover:text-background disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:disabled:bg-muted dark:disabled:text-muted-foreground";

/** How an event fits the route, as a soft pill (the site's tag look) - the reason in words. */
export function CompatChip({ compat, className }: { compat: Compat; className?: string }) {
  const s = compat.status;
  const Icon = s === "blocked" ? X : s === "warn" ? CircleAlert : Check;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold leading-snug",
        s === "best" && "border-primary/50 bg-primary/15 text-forest dark:text-primary",
        (s === "same" || s === "ok") && "border-border bg-accent text-foreground",
        s === "warn" && "border-badge-vip/60 bg-badge-vip/20 text-foreground",
        s === "blocked" && "border-badge-urgent/40 bg-badge-urgent/10 text-badge-urgent",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {describeCompat(compat)}
    </span>
  );
}

const KINDS: { value: CatalogKind; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "football", label: "כדורגל" },
  { value: "music", label: "הופעות" },
];

/** הכל / כדורגל / הופעות - the hub's segmented sort control. */
export function KindTabs({ value, onChange }: { value: CatalogKind; onChange: (k: CatalogKind) => void }) {
  return (
    <div
      className="flex h-11 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
      role="group"
      aria-label="סוג האירוע"
    >
      {KINDS.map((k) => (
        <button
          key={k.value}
          type="button"
          onClick={() => onChange(k.value)}
          aria-pressed={value === k.value}
          className={cn(
            "h-full flex-1 rounded-lg px-4 text-sm font-bold transition-colors",
            value === k.value
              ? "bg-main text-main-foreground dark:bg-foreground dark:text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

/** The category hubs' filter chip (components/CategoryEventsBrowser.tsx). */
const chip = (on: boolean) =>
  cn(
    "flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors",
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-foreground/[0.03]",
  );

const monthLabel = (month: string) => dayjs(`${month}-01`).locale("he").format("MMMM YYYY");

/**
 * One row of filter chips: "all" first, then one chip per value; pressing the picked chip again
 * clears it. `wrap` = a scrolling row on a phone that wraps from 640px; otherwise it always
 * scrolls (a narrow popup, a long list of cities).
 */
function ChipRow({
  label,
  allLabel,
  values,
  value,
  onChange,
  name = (v) => v,
  wrap = false,
}: {
  label: string;
  allLabel: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  name?: (v: string) => string;
  wrap?: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5",
        wrap ? "[scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0" : "myt-scroll",
      )}
      role="group"
      aria-label={label}
    >
      <button type="button" onClick={() => onChange("")} aria-pressed={value === ""} className={chip(value === "")}>
        {allLabel}
      </button>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value === v ? "" : v)}
          aria-pressed={value === v}
          className={chip(value === v)}
        >
          {name(v)}
        </button>
      ))}
    </div>
  );
}

/**
 * The catalog's search - the planner and the "הוסף אירוע" popup draw the same bar (Alon + Dor
 * 28.10: a search engine first, every filter behind ONE "סינון" button - "חיפוש מתקדם"). The
 * button opens the months, הכל / כדורגל / הופעות and the cities (`catalogMonths`,
 * `catalogCities`; a row with a single value is not drawn) and counts the ones set; while it is
 * closed, the set filters stay in view as chips that remove themselves. `autoFocus` = the
 * popup's search takes the focus when it opens (Mantine's focus trap reads `data-autofocus`).
 */
export function EventSearchBar({
  filter,
  onChange,
  months,
  cities,
  autoFocus = false,
  className,
  searchClassName,
}: {
  filter: CatalogFilter;
  onChange: (patch: Partial<CatalogFilter>) => void;
  months: string[];
  cities: string[];
  autoFocus?: boolean;
  /** Merged onto the bar's root (`flex flex-col gap-2`) - the popup passes `contents`. */
  className?: string;
  /** Wraps the search row alone (the popup makes it sticky). */
  searchClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = activeFilterCount(filter);
  const kindLabel = KINDS.find((k) => k.value === filter.kind)?.label ?? "";
  const set: { key: string; label: string; clear: Partial<CatalogFilter> }[] = [
    ...(filter.month ? [{ key: "month", label: monthLabel(filter.month), clear: { month: "" } }] : []),
    ...(filter.kind !== "all" ? [{ key: "kind", label: kindLabel, clear: { kind: "all" as CatalogKind } }] : []),
    ...(filter.city ? [{ key: "city", label: filter.city, clear: { city: "" } }] : []),
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={searchClassName}>
        <div className="flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
            <input
              type="search"
              value={filter.query}
              onChange={(e) => onChange({ query: e.target.value })}
              placeholder="לאן טסים? אמן, קבוצה או עיר..."
              aria-label="חיפוש אירוע - אמן, קבוצה או עיר"
              autoComplete="off"
              data-autofocus={autoFocus || undefined}
              className="min-w-0 flex-1 bg-transparent px-2 text-base text-foreground placeholder:text-[15px] placeholder:font-medium placeholder:text-muted-foreground focus:outline-none"
            />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
              <Search className="size-5" />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-sm font-bold shadow-sm transition-colors sm:px-4",
              open || count > 0
                ? "border-main bg-main text-main-foreground dark:border-foreground dark:bg-foreground dark:text-background"
                : "border-border bg-card text-foreground hover:bg-foreground/[0.03]",
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            סינון
            {count > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground">
                {count}
                <span className="sr-only"> מסננים פעילים</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div id={panelId} role="group" aria-label="חיפוש מתקדם" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
          {months.length > 1 && (
            <ChipRow
              label="חודש"
              allLabel="כל התאריכים"
              values={months}
              value={filter.month}
              onChange={(month) => onChange({ month })}
              name={monthLabel}
              wrap
            />
          )}
          <KindTabs value={filter.kind} onChange={(kind) => onChange({ kind })} />
          {cities.length > 1 && (
            <ChipRow
              label="עיר"
              allLabel="כל הערים"
              values={cities}
              value={filter.city}
              onChange={(city) => onChange({ city })}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange({ month: "", kind: "all", city: "" })}
              disabled={count === 0}
              className="text-sm font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:no-underline disabled:opacity-40"
            >
              ניקוי הסינון
            </button>
            <button type="button" onClick={() => setOpen(false)} className={ADD_BUTTON}>
              הצגת התוצאות
            </button>
          </div>
        </div>
      ) : (
        set.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="מסננים פעילים">
            {set.map((f) => (
              <li key={f.key}>
                <button
                  type="button"
                  onClick={() => onChange(f.clear)}
                  aria-label={`הסרת הסינון: ${f.label}`}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-3 text-xs font-bold text-forest transition-colors hover:bg-primary/25 dark:text-primary"
                >
                  {f.label}
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

/** "הצג עוד (N)" under a long list. */
export function ShowMore({ hidden, onClick }: { hidden: number; onClick: () => void }) {
  if (hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-4 flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03]"
    >
      הצג עוד ({hidden})
    </button>
  );
}

/** "לילה אחד" / "N לילות". */
export const nightsLabel = (n: number): string => (n === 1 ? "לילה אחד" : `${n} לילות`);

/** The hotels step's card of one stay - the flow scrolls to it when the summary opens that stay. */
export const stayCardId = (stayKey: string): string => `trip-stay-${stayKey}`;
