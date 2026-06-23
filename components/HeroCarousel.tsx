"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";
import { cn } from "@/lib/utils";

// Bright blob backgrounds cycled across the cards.
const blobColors = [
  "bg-[#5BC8E8]",
  "bg-[#F0902F]",
  "bg-badge-soldout",
  "bg-primary",
  "bg-badge-vip",
  "bg-badge-new",
];

// The row is rendered three times so native scrolling loops seamlessly:
// whenever the viewport drifts out of the middle copy we instantly jump by
// exactly one copy's width — identical content, so the jump is invisible.
const COPIES = 3;

type Card =
  | { kind: "artist"; artist: Artist; idx: number }
  | { kind: "logo" };

/** Instant (non-smooth) scroll jump, overriding the `scroll-smooth` class. */
const jumpBy = (el: HTMLElement, delta: number) => {
  const prev = el.style.scrollBehavior;
  el.style.scrollBehavior = "auto";
  el.scrollLeft += delta;
  el.style.scrollBehavior = prev;
};

/** Keep the viewport inside the middle copy (RTL: scrollLeft ≤ 0). */
const normalize = (el: HTMLElement) => {
  const set = el.scrollWidth / COPIES;
  if (!set) return;
  if (el.scrollLeft > -set * 0.5) jumpBy(el, -set);
  else if (el.scrollLeft < -set * 2) jumpBy(el, set);
};

/**
 * Hero gallery — an infinitely looping coverflow row (per Dor's mock). The row
 * is cloned ×3 so it scrolls endlessly in both directions; the card nearest the
 * viewport center is always brought to the front — scaled up, lit, full opacity
 * — while the rest sit smaller and dimmed behind it. The brand logo card sits
 * mid-row and the carousel opens centered on it.
 *
 * - Native swipe / scroll + RTL-aware arrows that skip two cards at a time.
 * - Center focus is applied imperatively per-frame (transform/opacity only) so
 *   it stays smooth during momentum scroll and the auto-play glide.
 * - Idle auto-play drifts one loop then settles on the logo; stops on first
 *   interaction; skipped under prefers-reduced-motion.
 */
export const HeroCarousel = ({ artists }: { artists: Artist[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => artists.filter((a) => a.fields.heroBanner?.fields?.file?.url),
    [artists]
  );

  // One copy of the row — all artist cards, with the brand-logo card spliced
  // into the middle so the carousel opens on it and auto-play settles back to it.
  const baseCards = useMemo<Card[]>(() => {
    const cards: Card[] = items.map((artist, idx) => ({
      kind: "artist" as const,
      artist,
      idx,
    }));
    cards.splice(Math.floor(cards.length / 2), 0, { kind: "logo" });
    return cards;
  }, [items]);
  // The card the carousel opens on and settles back to (the logo, mid-row).
  const centerIndex = baseCards.findIndex((c) => c.kind === "logo");

  // Bring the card closest to the row center to the front (imperative so it
  // tracks momentum scroll smoothly; transform/opacity only — no reflow).
  const updateFocus = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const cards = el.querySelectorAll<HTMLElement>("[data-card]");
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    cards.forEach((c) => {
      const r = c.getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    });
    cards.forEach((c) => {
      const focused = c === best;
      c.style.transform = focused ? "scale(1.08)" : "scale(0.84)";
      c.style.opacity = focused ? "1" : "0.5";
      c.style.filter = focused ? "none" : "brightness(0.65)";
      c.style.zIndex = focused ? "20" : "1";
    });
  }, []);

  // Open centered on the mid-row card, then set initial focus.
  useEffect(() => {
    centerRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
    requestAnimationFrame(updateFocus);
  }, [baseCards.length, updateFocus]);

  // Infinite wrap + per-frame focus on manual scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateFocus);
      clearTimeout(t);
      t = setTimeout(() => normalize(el), 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [updateFocus]);

  // Idle auto-play: a slow continuous glide for one full loop, then settle on
  // the logo. Snap + smooth suspended while gliding so the browser doesn't
  // fight the sub-pixel writes. Stops on first interaction / reduced-motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SPEED = 130; // px/sec; RTL forward = negative scrollLeft
    let traveled = 0;
    let raf = 0;
    let last = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
    };

    const frame = (now: number) => {
      if (stopped) return;
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      const set = el.scrollWidth / COPIES;
      const dx = (SPEED * dt) / 1000;
      if (set && traveled + dx >= set) {
        stop();
        centerRef.current?.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: "smooth",
        });
        return;
      }
      traveled += dx;
      el.scrollLeft -= dx;
      normalize(el);
      updateFocus();
      raf = requestAnimationFrame(frame);
    };

    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
    raf = requestAnimationFrame(frame);
    const opts = { passive: true } as AddEventListenerOptions;
    el.addEventListener("pointerdown", stop, opts);
    el.addEventListener("wheel", stop, opts);
    el.addEventListener("touchstart", stop, opts);
    return () => {
      stop();
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
    };
  }, [baseCards.length, updateFocus]);

  if (baseCards.length === 0) return null;

  // Arrows skip TWO cards at a time. RTL: forward reveals content to the left.
  const scroll = (dir: "next" | "prev") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const gap = 16;
    const step = card ? (card.offsetWidth + gap) * 2 : Math.round(el.clientWidth * 0.6);
    el.scrollBy({ left: dir === "next" ? -step : step, behavior: "smooth" });
  };

  const arrowBtn =
    "absolute top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  const renderCard = (card: Card) => {
    // Brand-logo card — the row's center, what the carousel opens on. Layered
    // brand animation: a breathing mint glow, a diagonal neon sheen sweep, and
    // the wordmark ⇄ MΣ-mark morph (two layers crossfading on opposite phases).
    // All motion gated behind `motion-safe`; reduced-motion shows the static
    // wordmark only.
    if (card.kind === "logo") {
      return (
        <div
          className="relative flex h-64 w-44 items-center justify-center overflow-hidden rounded-3xl bg-secondary shadow-card sm:h-80 sm:w-56"
          aria-label="מגה איבנטס"
        >
          {/* Breathing emerald glow behind the mark (deeper green so it reads on
              the bright #5BFF95 card) */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(160_84%_39%/0.45),transparent_70%)] blur-2xl motion-safe:animate-[logo-breathe_6s_ease-in-out_infinite]"
          />
          {/* Diagonal sheen sweeping across the card */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 -right-1/2 motion-reduce:hidden"
          >
            <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md motion-safe:animate-[logo-sheen_4.5s_ease-in-out_infinite]" />
          </span>
          {/* Wordmark ⇄ MΣ-mark morph (stacked, opposite phases) */}
          <div className="relative grid place-items-center">
            <MYT className="col-start-1 row-start-1 w-28 text-primary-foreground sm:w-36 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite]" />
            <MYTMark className="col-start-1 row-start-1 w-14 text-primary-foreground sm:w-16 opacity-0 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite] motion-safe:[animation-delay:-3.5s]" />
          </div>
        </div>
      );
    }
    const { artist, idx } = card;
    const url = "https:" + artist.fields.heroBanner!.fields!.file!.url;
    const name = String(artist.fields.name ?? "");
    return (
      <Link
        href={`/artists/${artist.sys.id}`}
        aria-label={`עמוד האומן ${name}`}
        className="group relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        draggable={false}
      >
        <div
          className={cn(
            "relative h-64 w-44 overflow-hidden rounded-3xl sm:h-80 sm:w-56",
            blobColors[idx % blobColors.length]
          )}
        >
          <Image
            src={url}
            alt={name}
            fill
            sizes="(max-width: 640px) 11rem, 14rem"
            className="object-cover object-bottom"
            draggable={false}
          />
          {/* Always-on gradient + name so every card is identifiable, not just
              the focused one. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent"
          />
          <span className="absolute inset-x-2 bottom-2 truncate text-center text-sm font-bold text-white drop-shadow">
            {name}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="relative">
      {/* Next (forward) — left side in RTL */}
      <button
        type="button"
        onClick={() => scroll("next")}
        aria-label="האירועים הבאים"
        className={cn(arrowBtn, "left-2 sm:left-6")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {/* Prev — right side in RTL */}
      <button
        type="button"
        onClick={() => scroll("prev")}
        aria-label="האירועים הקודמים"
        className={cn(arrowBtn, "right-2 sm:right-6")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory scroll-smooth items-center gap-4 overflow-x-auto px-[40%] py-8 [scrollbar-width:none] sm:px-[calc(50%-7rem)]"
        role="list"
        aria-label="אירועים מובילים"
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          baseCards.map((card, i) => {
            const isCenter = i === centerIndex && copy === 1;
            return (
              <div
                key={`${copy}-${i}`}
                ref={isCenter ? centerRef : undefined}
                data-card
                role="listitem"
                className="shrink-0 snap-center transition-[transform,opacity,filter] duration-300 ease-out will-change-transform"
                style={{ transform: "scale(0.84)", opacity: 0.5 }}
              >
                {renderCard(card)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
