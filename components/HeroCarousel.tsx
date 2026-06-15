"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { cn } from "@/lib/utils";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";

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

type Card = { kind: "logo" } | { kind: "artist"; artist: Artist; idx: number };

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
  const logoRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => artists.filter((a) => a.fields.heroBanner?.fields?.file?.url),
    [artists]
  );

  // One copy of the row: artist cards with the brand logo card spliced mid-row.
  const baseCards = useMemo(() => {
    const list: Card[] = items.map((artist, idx) => ({
      kind: "artist" as const,
      artist,
      idx,
    }));
    list.splice(Math.floor(list.length / 2), 0, { kind: "logo" });
    return list;
  }, [items]);

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
      c.querySelector<HTMLElement>("[data-name]")?.style.setProperty(
        "opacity",
        focused ? "1" : "0"
      );
    });
  }, []);

  // Open centered on the brand logo card, then set initial focus.
  useEffect(() => {
    logoRef.current?.scrollIntoView({
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
        logoRef.current?.scrollIntoView({
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
    if (card.kind === "logo") {
      return (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("myt:open-search"))}
          aria-label="חיפוש אירוע"
          className="group relative block h-64 w-44 overflow-hidden rounded-3xl border border-main-foreground/20 bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-80 sm:w-56"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/30 blur-lg"
            style={{ animation: "logo-sheen 3s ease-in-out infinite" }}
          />
          <span
            className="relative flex h-full w-full items-center justify-center text-[hsl(var(--surface-inverse))]"
            style={{ animation: "logo-breathe 3.5s var(--ease-out) infinite" }}
          >
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: "logo-swap 4.5s var(--ease-out) infinite" }}
            >
              <MYT className="h-auto w-[82%]" />
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: "logo-swap 4.5s var(--ease-out) -2.25s infinite" }}
            >
              <MYTMark className="h-auto w-[62%]" />
            </span>
          </span>
        </button>
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
        </div>
        <span
          data-name
          className="absolute inset-x-2 bottom-2 truncate rounded-xl bg-main/70 px-3 py-1.5 text-center text-sm font-bold text-main-foreground opacity-0 transition-opacity"
        >
          {name}
        </span>
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
            const isLogoMiddle = card.kind === "logo" && copy === 1;
            return (
              <div
                key={`${copy}-${i}`}
                ref={isLogoMiddle ? logoRef : undefined}
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
