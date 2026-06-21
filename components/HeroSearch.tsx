"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { ArrowUp, Check, Mic, Plane, Building2, Ticket } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";
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
export const HeroSearch = ({ events }: { events: Event[] }) => {
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

  // The event the user picked from the list — drives the package panel.
  const [selected, setSelected] = useState<Event | null>(null);

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return fuse.search(query.trim()).slice(0, 5).map((r) => r.item);
  }, [query, fuse]);
  const top = matches[0];

  // Header search button + /?search=open land here.
  useEffect(() => {
    const focus = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 350);
    };
    window.addEventListener("myt:open-search", focus);
    if (new URLSearchParams(window.location.search).get("search") === "open") {
      focus();
    }
    return () => window.removeEventListener("myt:open-search", focus);
  }, []);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

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

  const price = selected ? computePackagePrice(selected) : null;
  const parts = selected
    ? ([
        ...(!selected.skip_flight ? [{ label: "טיסה", Icon: Plane }] : []),
        ...(!selected.skip_flight ? [{ label: "מלון", Icon: Building2 }] : []),
        { label: "כרטיס", Icon: Ticket },
      ] as { label: string; Icon: typeof Plane }[])
    : [];

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
            if (selected) setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (selected) goTo(selected);
            else if (top) pick(top);
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
          onClick={() => (selected ? goTo(selected) : top && pick(top))}
          disabled={!top && !selected}
          aria-label={selected ? "המשך להזמנה" : "חיפוש"}
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
          <ul>
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
                      <span className="shrink-0 text-left text-sm leading-tight text-main-foreground/60">
                        מחיר מ־
                        <span className="block text-base font-bold tabular-nums text-primary">
                          ${mPrice.toLocaleString("en-US")}
                        </span>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-main-foreground">
                        {m.name}
                      </span>
                      {m.location?.name ? (
                        <span className="block truncate text-xs text-main-foreground/60">
                          {m.location.name}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
              onClick={() => setSelected(null)}
              className="text-xs font-medium text-main-foreground/60 underline-offset-2 hover:text-main-foreground hover:underline"
            >
              החלף בחירה
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
              <Check className="size-3.5" aria-hidden />
              נבחר
            </span>
            <p className="min-w-0 truncate text-base font-bold text-main-foreground">
              {selected.name}
              {selected.location?.name ? (
                <span className="font-medium text-main-foreground/70"> · {selected.location.name}</span>
              ) : null}
            </p>
          </div>

          <div className="mt-3 flex flex-row-reverse flex-wrap justify-start gap-2">
            {parts.map(({ label, Icon }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-xl border border-primary/50 px-4 py-2 text-sm font-semibold text-primary"
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-main-foreground/10 pt-3 text-sm">
            <span className="text-main-foreground/60">
              {price !== null ? (
                <>
                  מחיר מ־<span className="font-bold tabular-nums text-main-foreground">${price.toLocaleString("en-US")}</span> · ניתן לשנות
                </>
              ) : (
                "מחיר יוצג בשלב הבא"
              )}
            </span>
            <button
              type="button"
              onClick={() => goTo(selected)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              החבילה מוכנה
            </button>
          </div>

          {/* Other matches — pick a different event without re-typing */}
          {matches.filter((m) => m.id !== selected.id).length > 0 && (
            <div className="mt-3 border-t border-main-foreground/10 pt-2">
              <p className="px-1 pb-1 text-xs font-medium text-main-foreground/50">
                אירועים נוספים
              </p>
              <ul>
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
                            {m.location?.name ? (
                              <span className="text-main-foreground/50"> · {m.location.name}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
