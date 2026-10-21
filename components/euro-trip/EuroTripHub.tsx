"use client";

import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/he";
import { Plus, Search, X } from "lucide-react";

import { useSessionState } from "@/app/hooks/useSessionState";
import { RouteCard } from "@/components/euro-trip/RouteCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HUB_VIEW,
  HUB_PAGE_SIZE,
  hubCards,
  hubMonths,
  parseHubView,
  type HubKind,
  type HubSort,
  type HubView,
  type RouteCardData,
} from "@/lib/itinerary/routeCard";

const KINDS: { value: HubKind; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "music", label: "הופעות" },
  { value: "football", label: "כדורגל" },
  { value: "mix", label: "מיקס" },
];

const SORTS: { value: HubSort; label: string }[] = [
  { value: "recommended", label: "מומלץ" },
  { value: "price", label: "מחיר" },
  { value: "date", label: "תאריך" },
];

const BUILD_HREF = "/euro-trip/build";

/** The chip look of the category hubs' filters (components/CategoryEventsBrowser.tsx). */
const chip = (on: boolean) =>
  cn(
    "flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold transition-colors",
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-foreground/[0.03]",
  );

const monthLabel = (month: string) => dayjs(`${month}-01`).locale("he").format("MMMM YYYY");

/** "בנו טריפ משלכם" - the grid's last tile. */
function BuildTile() {
  return (
    <Link
      href={BUILD_HREF}
      className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl border-[1.5px] border-dashed border-primary/50 bg-primary/[0.04] p-6 text-center transition-colors hover:bg-primary/[0.08]"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Plus className="size-7" aria-hidden />
      </span>
      <span className="font-display text-xl font-extrabold">בנו טריפ משלכם</span>
      <span className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
        בחרו אירוע, ואנחנו נראה מה עוד אפשר לשלב אליו - לפי ימים ומרחק.
      </span>
    </Link>
  );
}

/**
 * The hub's routes with their filters: search (event names and cities), month chips,
 * הכל / הופעות / כדורגל / מיקס, sort and "הצג עוד". The view is kept for this tab in
 * sessionStorage (`viewStateKey("/euro-trip", "hub")`): the first render is the defaults the
 * server printed, the stored view is applied right after hydration (useSessionState).
 */
export function EuroTripHub({ cards, headingId }: { cards: RouteCardData[]; headingId?: string }) {
  const [view, setView] = useSessionState<HubView>("hub", DEFAULT_HUB_VIEW, parseHubView);

  if (cards.length === 0) {
    return (
      <EmptyState
        title="עוד אין מסלולים מוכנים - בנו טריפ משלכם"
        description="בחרו את האירוע הראשון, ואנחנו נראה מה עוד אפשר לשלב אליו."
        action={
          <Link
            href={BUILD_HREF}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            בנו טריפ משלכם
          </Link>
        }
      />
    );
  }

  const months = hubMonths(cards);
  // A month stored on an earlier visit that no route falls in any more is not applied.
  const fitted: HubView = months.includes(view.month) ? view : { ...view, month: "" };
  const shown = hubCards(cards, fitted);
  const dirty = fitted.query.trim() !== "" || fitted.month !== "" || fitted.kind !== "all";

  /** A narrower filter shows its results from the top. */
  const filter = (patch: Partial<HubView>) =>
    setView((v) => ({ ...v, ...patch, visible: HUB_PAGE_SIZE }));
  // Back at the defaults the view is the default object itself, so nothing stays stored.
  const clear = () =>
    setView((v) => (v.sort === DEFAULT_HUB_VIEW.sort ? DEFAULT_HUB_VIEW : { ...DEFAULT_HUB_VIEW, sort: v.sort }));

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="סוג הטריפ">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => filter({ kind: k.value })}
              aria-pressed={fitted.kind === k.value}
              className={chip(fitted.kind === k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="euro-trip-search" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              חיפוש
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
                aria-hidden
              />
              <input
                id="euro-trip-search"
                type="search"
                value={fitted.query}
                onChange={(e) => filter({ query: e.target.value })}
                placeholder="אמן, קבוצה או עיר"
                className="h-11 w-full rounded-xl border border-border bg-card pe-4 ps-9 text-sm font-medium text-foreground shadow-sm transition-colors placeholder:font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground" id="euro-trip-sort-label">
              מיון
            </p>
            <div
              className="flex h-11 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm"
              role="group"
              aria-labelledby="euro-trip-sort-label"
            >
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setView((v) => ({ ...v, sort: s.value }))}
                  aria-pressed={fitted.sort === s.value}
                  className={cn(
                    "h-full flex-1 rounded-lg px-4 text-sm font-bold transition-colors sm:flex-none",
                    fitted.sort === s.value
                      ? "bg-main text-main-foreground dark:bg-foreground dark:text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {months.length > 1 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0"
            role="group"
            aria-label="חודש"
          >
            <button type="button" onClick={() => filter({ month: "" })} aria-pressed={fitted.month === ""} className={chip(fitted.month === "")}>
              כל התאריכים
            </button>
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => filter({ month: fitted.month === m ? "" : m })}
                aria-pressed={fitted.month === m}
                className={chip(fitted.month === m)}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>
        )}

        {dirty && (
          <button
            type="button"
            onClick={clear}
            className="flex h-10 items-center gap-1.5 rounded-xl text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
            נקה סינון
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {shown.length === cards.length ? `${cards.length} מסלולים` : `${shown.length} מתוך ${cards.length} מסלולים`}
      </p>

      {shown.length > 0 ? (
        <>
          {/* Equal rows from two columns up; on a phone each row keeps its own height, so the
              build tile is not stretched to a card's. */}
          <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3" role="list" aria-labelledby={headingId}>
            {shown.slice(0, fitted.visible).map((c, i) => (
              <div key={c.ids.join("-")} role="listitem">
                <RouteCard data={c} priority={i < 3} />
              </div>
            ))}
            <div role="listitem">
              <BuildTile />
            </div>
          </div>

          {fitted.visible < shown.length && (
            <button
              type="button"
              onClick={() => setView((v) => ({ ...v, visible: v.visible + HUB_PAGE_SIZE }))}
              className="mx-auto flex h-12 items-center rounded-xl border border-border bg-card px-6 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground/[0.03]"
            >
              הצג עוד ({shown.length - fitted.visible})
            </button>
          )}
        </>
      ) : (
        <EmptyState
          title="אין מסלולים שמתאימים לסינון"
          description="נסו חודש אחר, או בנו טריפ משלכם מכל האירועים."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={clear}
                className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground"
              >
                נקה סינון
              </button>
              <Link
                href={BUILD_HREF}
                className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
              >
                בנו טריפ משלכם
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
