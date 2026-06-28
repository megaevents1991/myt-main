"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/he";
import Fuse from "fuse.js";
import {
  ArrowUp,
  Check,
  Mic,
  Plane,
  Building2,
  Ticket,
  ChevronLeft,
} from "lucide-react";

import type { Event, Artist } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
import { multiTermSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";

const fuseOptions = {
  keys: ["name", "location.name", "name_english"],
  threshold: 0.35,
  ignoreLocation: true,
};

// Minimal Web Speech API surface (not in TS DOM libs).
type SpeechRecognitionResultEvent = {
  results?: { [i: number]: { [i: number]: { transcript?: string } } };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
const getSpeechRecognition = ():
  | (new () => SpeechRecognitionLike)
  | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

/**
 * Hero "AI" search — the single search experience on the homepage (per Dor's
 * mock): one big input; typing assembles a package live ("מרכיבים את החבילה
 * שלך…") with the best-matching event, its included parts and average price.
 * Optional voice input via the Web Speech API (Hebrew).
 */
export const HeroSearch = ({
  events,
  artists = [],
  autoFocus = false,
}: {
  events: Event[];
  artists?: Artist[];
  /** Focus the input on mount — used when rendered inside the search modal. */
  autoFocus?: boolean;
}) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const available = useMemo(
    () => events.filter((e) => !isEventSoldOut(e)),
    [events]
  );
  const fuse = useMemo(() => new Fuse(available, fuseOptions), [available]);

  // Event date → Hebrew "26 באוקטובר" (or a placeholder when unset).
  const fmtDate = (d?: string) =>
    d ? dayjs(d).locale("he").format("D בMMMM") : "תאריך יפורסם";

  // The event the user picked from the list — drives the package panel.
  const [selected, setSelected] = useState<Event | null>(null);

  // First-pick-only "assembling your package online" animation: pills reveal
  // one-by-one, then the price. `revealed` = how many pills are shown so far;
  // while `assembling` the rest render as shimmer skeletons.
  const [assembling, setAssembling] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const assembledOnce = useRef(false);

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return multiTermSearch(fuse, query).slice(0, 50);
  }, [query, fuse]);
  const top = matches[0];

  // Match an event to a Contentful artist page by english name (same rule as
  // the homepage cards). Used for the "all shows of <artist>" footer link.
  const artistFor = (event?: Event | null): Artist | null => {
    if (!event?.name_english || artists.length === 0) return null;
    const id = event.name_english.trim().toLowerCase();
    return (
      artists.find(
        (a) => a.fields.nameDBenglish?.trim().toLowerCase() === id
      ) ?? null
    );
  };
  const topArtist = artistFor(top);
  const selectedArtist = artistFor(selected);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  // When mounted inside the search modal, focus + open the dropdown immediately
  // (the open event that triggered the modal fired before this mounted).
  useEffect(() => {
    if (!autoFocus) return;
    setOpen(true);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [autoFocus]);

  // Close the results/package dropdown on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const startVoice = () => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionResultEvent) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) setQuery(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  // Stage 1 → 2: pull a chosen list row up into the package panel.
  const pick = (event: Event) => {
    trackEvent("heroSearchSelected", {
      eventId: event.id,
      eventName: event.name,
      query,
    });
    setSelected(event);
    // Play the "assembling online" animation only on the very first pick.
    if (!assembledOnce.current) {
      setRevealed(0);
      setAssembling(true);
    }
  };

  // Stage 2 CTA: go to the order flow for the assembled package.
  const goTo = (event: Event) => {
    trackEvent("heroSearchOrder", {
      eventId: event.id,
      eventName: event.name,
      query,
    });
    router.push(`/order/${event.id}`);
  };

  // Stage 1 ↑/Enter: "see all results" → the full search page (grid + filters).
  // The inline dropdown stays the quick-pick path (click a row to assemble).
  const goToSearch = () => {
    const q = query.trim();
    trackEvent("heroSearchSeeAll", { query: q });
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const price = selected ? computePackagePrice(selected) : null;
  // Always show all three parts; flight + hotel are struck-through/dimmed for
  // ticket-only (skip_flight) events.
  const parts: { label: string; Icon: typeof Plane; disabled: boolean }[] =
    selected
      ? [
          { label: "טיסה", Icon: Plane, disabled: !!selected.skip_flight },
          { label: "מלון", Icon: Building2, disabled: !!selected.skip_flight },
          { label: "כרטיס", Icon: Ticket, disabled: false },
        ]
      : [];

  // Drive the staggered reveal once `assembling` turns on (first pick only).
  useEffect(() => {
    if (!assembling) return;
    const total = parts.length;
    const STEP = 500;
    const timers = Array.from({ length: total }, (_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * STEP)
    );
    // Price reveals one step after the last pill; then assembly is done.
    timers.push(
      setTimeout(() => {
        setAssembling(false);
        assembledOnce.current = true;
      }, (total + 1) * STEP)
    );
    return () => timers.forEach(clearTimeout);
  }, [assembling, parts.length]);

  return (
    <div ref={containerRef} id="search" className="mx-auto w-full max-w-xl scroll-mt-24 px-4" dir="rtl">
      {/* Input bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-main-foreground/15 bg-main-foreground/[0.07] p-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected) {
              setSelected(null);
              setAssembling(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (selected) goTo(selected);
            else goToSearch();
          }}
          placeholder="לאן טסים? אירוע, אומן או עיר…"
          aria-label="חיפוש אירוע — הקלידו אירוע, אומן או עיר"
          className="min-w-0 flex-1 bg-transparent px-2 text-base text-main-foreground placeholder:text-main-foreground/50 focus:outline-none"
          type="text"
          autoComplete="off"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={startVoice}
            aria-label="חיפוש קולי"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl text-main-foreground/70 transition-colors hover:bg-main-foreground/10",
              listening && "animate-pulse text-primary"
            )}
          >
            <Mic className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => (selected ? goTo(selected) : goToSearch())}
          aria-label={selected ? "המשך להזמנה" : "הצגת כל התוצאות"}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(var(--brand-mint)/0.7)] transition-all hover:bg-primary/90 disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>

      {/* Stage 1 — plain results list. Pick a row to assemble its package. */}
      {open && !selected && matches.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-main-foreground/15 bg-main-foreground/[0.07] backdrop-blur-sm">
          <p className="flex items-center justify-end gap-2 border-b border-main-foreground/10 px-4 py-2.5 text-xs font-medium text-main-foreground/60">
            אירועים תואמים · המחיר ממוצע וניתן לשינוי בהמשך
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
          </p>
          <ul className="max-h-[20rem] overflow-y-auto overscroll-contain">
            {matches.map((m) => {
              const mPrice = computePackagePrice(m);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pick(m)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-main-foreground/10"
                  >
                    {mPrice !== null && (
                      <span className="flex shrink-0 items-baseline gap-1 text-left text-sm text-main-foreground/60">
                        מחיר מ־
                        <span className="text-base font-bold tabular-nums text-primary">
                          ${mPrice.toLocaleString("en-US")}
                        </span>
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="min-w-0 truncate text-base font-bold text-main-foreground">
                        {m.name}
                      </span>
                      <span className="shrink-0 text-xs text-main-foreground/60">
                        {m.location?.name ? `${m.location.name} · ` : ""}
                        {fmtDate(m.date)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {topArtist && (
            <Link
              href={`/artists/${topArtist.sys.id}`}
              onClick={() =>
                trackEvent("heroSearchArtistAllShows", {
                  artistId: topArtist.sys.id,
                  artistName: topArtist.fields.name,
                  query,
                })
              }
              className="flex items-center justify-between gap-2 border-t border-main-foreground/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-main-foreground/10"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-right">
                לכל ההופעות של {topArtist.fields.name}
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Stage 2 — chosen event pulled up; package assembles live. */}
      {open && selected && (
        <div className="mt-3 rounded-2xl border border-main-foreground/15 bg-main-foreground/[0.07] p-4 text-right backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-medium text-main-foreground/60">
              מרכיבים את החבילה שלך…
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            </p>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setAssembling(false);
              }}
              className="text-xs font-medium text-main-foreground/60 underline-offset-2 hover:text-main-foreground hover:underline"
            >
              החלף בחירה
            </button>
          </div>

          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
              <Check className="size-3.5" aria-hidden />
              נבחר
            </span>
            <p className="min-w-0 truncate text-base font-bold text-main-foreground">
              {selected.name}
              <span className="font-medium text-main-foreground/70">
                {selected.location?.name ? ` · ${selected.location.name}` : ""}
                {` · ${fmtDate(selected.date)}`}
              </span>
            </p>
          </div>

          <div className="mt-3 flex flex-row-reverse gap-2">
            {parts.map(({ label, Icon }, i) =>
              assembling && i >= revealed ? (
                <span
                  key={label}
                  className="h-10 flex-1 animate-pulse rounded-xl bg-main-foreground/10"
                  aria-hidden
                />
              ) : (
                <span
                  key={label}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/50 px-4 py-2 text-sm font-semibold text-primary"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </span>
              )
            )}
          </div>
          {!assembling && selected.skip_flight && (
            <p className="mt-2 text-center text-xs font-medium text-primary/80">
              אפשרות לכרטיס בלבד
            </p>
          )}

          <div className="mt-3 flex items-center justify-center gap-3 border-t border-main-foreground/10 pt-3 text-sm">
            {assembling ? (
              <span
                className="h-5 w-28 animate-pulse rounded bg-main-foreground/10"
                aria-hidden
              />
            ) : (
              <span className="text-main-foreground/60">
                {price !== null ? (
                  <>
                    מחיר מ־<span className="font-bold tabular-nums text-main-foreground">${price.toLocaleString("en-US")}</span> · ניתן לשנות
                  </>
                ) : (
                  "מחיר יוצג בשלב הבא"
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => goTo(selected)}
              disabled={assembling}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {assembling ? "מרכיבים…" : "החבילה מוכנה"}
            </button>
          </div>

          {/* Other matches — pick a different event without re-typing */}
          {matches.filter((m) => m.id !== selected.id).length > 0 && (
            <div className="mt-3 border-t border-main-foreground/10 pt-2">
              <p className="px-1 pb-1 text-xs font-medium text-main-foreground/50">
                אירועים נוספים
              </p>
              <ul className="max-h-[15rem] overflow-y-auto overscroll-contain">
                {matches
                  .filter((m) => m.id !== selected.id)
                  .map((m) => {
                    const mPrice = computePackagePrice(m);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => pick(m)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-right transition-colors hover:bg-main-foreground/10"
                        >
                          {mPrice !== null && (
                            <span className="shrink-0 text-left text-xs font-bold tabular-nums text-primary">
                              ${mPrice.toLocaleString("en-US")}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm text-main-foreground/80">
                            {m.name}
                            <span className="text-main-foreground/50">
                              {m.location?.name ? ` · ${m.location.name}` : ""}
                              {` · ${fmtDate(m.date)}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}

          {/* All shows of this artist — keep available after a pick too */}
          {selectedArtist && (
            <Link
              href={`/artists/${selectedArtist.sys.id}`}
              onClick={() =>
                trackEvent("heroSearchArtistAllShows", {
                  artistId: selectedArtist.sys.id,
                  artistName: selectedArtist.fields.name,
                  query,
                  source: "stage2",
                })
              }
              className="mt-3 flex items-center justify-between gap-2 border-t border-main-foreground/10 pt-3 text-sm font-semibold text-primary transition-colors hover:opacity-80"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-right">
                לכל ההופעות של {selectedArtist.fields.name}
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
