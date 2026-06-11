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
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const available = useMemo(
    () => events.filter((e) => !isEventSoldOut(e)),
    [events]
  );
  const fuse = useMemo(() => new Fuse(available, fuseOptions), [available]);

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return fuse.search(query.trim()).slice(0, 3).map((r) => r.item);
  }, [query, fuse]);
  const top = matches[0];

  // Header search button + /?search=open land here.
  useEffect(() => {
    const focus = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  const goTo = (event: Event) => {
    trackEvent("heroSearchSelected", {
      eventId: event.id,
      eventName: event.name,
      query,
    });
    router.push(`/order/${event.id}`);
  };

  const price = top ? computePackagePrice(top) : null;
  const parts = top
    ? ([
        ...(!top.skip_flight ? [{ label: "טיסה", Icon: Plane }] : []),
        ...(!top.skip_flight ? [{ label: "מלון", Icon: Building2 }] : []),
        { label: "כרטיס", Icon: Ticket },
      ] as { label: string; Icon: typeof Plane }[])
    : [];

  return (
    <div id="search" className="mx-auto w-full max-w-xl scroll-mt-24 px-4" dir="rtl">
      {/* Input bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-main-foreground/15 bg-main-foreground/[0.07] p-2 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && top) goTo(top);
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
          onClick={() => top && goTo(top)}
          disabled={!top}
          aria-label="חיפוש"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(var(--brand-mint)/0.7)] transition-all hover:bg-primary/90 disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>

      {/* Live package panel */}
      {top && (
        <div className="mt-3 rounded-2xl border border-main-foreground/15 bg-main-foreground/[0.07] p-4 text-right backdrop-blur-sm">
          <p className="flex items-center justify-end gap-2 text-xs font-medium text-main-foreground/60">
            מרכיבים את החבילה שלך…
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goTo(top)}
              className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
            >
              <Check className="size-4" aria-hidden />
              בחרו
            </button>
            <p className="truncate text-base font-bold text-main-foreground">
              {top.name}
              {top.location?.name ? (
                <span className="font-medium text-main-foreground/70"> · {top.location.name}</span>
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

          <div className="mt-3 flex items-center justify-between border-t border-main-foreground/10 pt-3 text-sm">
            <span className="text-main-foreground/60">
              {price !== null ? (
                <>
                  ממוצע <span className="font-bold tabular-nums text-main-foreground">${price.toLocaleString("en-US")}</span> · ניתן לשנות
                </>
              ) : (
                "מחיר יוצג בשלב הבא"
              )}
            </span>
            <span className="font-bold text-primary">החבילה מוכנה</span>
          </div>

          {matches.length > 1 && (
            <div className="mt-2 space-y-1 border-t border-main-foreground/10 pt-2">
              {matches.slice(1).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goTo(m)}
                  className="block w-full truncate rounded-lg px-2 py-1.5 text-right text-sm text-main-foreground/70 transition-colors hover:bg-main-foreground/10 hover:text-main-foreground"
                >
                  {m.name}
                  {m.location?.name ? ` · ${m.location.name}` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
