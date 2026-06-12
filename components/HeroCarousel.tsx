"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { cn } from "@/lib/utils";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";

// Bright blob backgrounds cycled across the tilted cards.
const blobColors = [
  "bg-[#5BC8E8]",
  "bg-[#F0902F]",
  "bg-badge-soldout",
  "bg-primary",
  "bg-badge-vip",
  "bg-badge-new",
];

// Slight alternating tilt so the row feels playful, per the Figma hero.
const tilts = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3", "-rotate-1", "rotate-1"];

// The row is rendered three times so native scrolling can loop seamlessly:
// whenever the viewport drifts out of the middle copy we instantly jump by
// exactly one copy's width — identical content, so the jump is invisible.
const COPIES = 3;

/** Instant (non-smooth) scroll jump, overriding the `scroll-smooth` class. */
const jumpBy = (el: HTMLElement, delta: number) => {
  const prev = el.style.scrollBehavior;
  el.style.scrollBehavior = "auto";
  el.scrollLeft += delta;
  el.style.scrollBehavior = prev;
};

/**
 * Keep the viewport inside the middle copy. RTL: scrollLeft is 0 at the
 * start (right edge) and negative going forward (left).
 */
const normalize = (el: HTMLElement) => {
  const set = el.scrollWidth / COPIES;
  if (!set) return;
  if (el.scrollLeft > -set * 0.5) jumpBy(el, -set);
  else if (el.scrollLeft < -set * 2) jumpBy(el, set);
};

/**
 * Hero gallery — an infinitely looping scrollable row of tilted, colorful
 * cutout cards shown under the homepage hero headline. Decorative +
 * navigational: each card links to its artist page.
 *
 * - Infinite loop: content is cloned ×3; an instant wrap-jump keeps the user
 *   in the middle copy, so scrolling never hits an edge in either direction.
 * - Auto-play: starts centered on the brand logo card, slowly advances one
 *   direction for exactly one full loop, and settles back on the logo.
 *   Stops on first user interaction; skipped under prefers-reduced-motion.
 * - Desktop: prev/next arrow buttons (RTL-aware) for clear scroll affordance.
 * - Touch: native swipe + scroll-snap.
 */
export const HeroCarousel = ({ artists }: { artists: Artist[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const items = artists.filter((a) => a.fields.heroBanner?.fields?.file?.url);
  const mid = Math.floor(items.length / 2);

  // Start with the brand logo card (middle copy) centered in the viewport.
  useEffect(() => {
    logoRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [items.length]);

  // Infinite wrap for manual scrolling. Debounced so the instant jump only
  // happens after a smooth/momentum scroll settles — never mid-animation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => normalize(el), 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [items.length]);

  // Idle auto-play: a slow continuous glide in one direction (rAF-driven)
  // until it has covered exactly one full loop, then settles centered on the
  // logo card. Scroll-snap is suspended while gliding so the browser doesn't
  // fight the sub-pixel scroll position; restored on stop. Stops on first
  // user interaction. Skipped under prefers-reduced-motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SPEED = 140; // px per second; RTL: forward = negative scrollLeft
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
      // Clamp dt so returning from a background tab doesn't lurch forward.
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      const set = el.scrollWidth / COPIES;
      const dx = (SPEED * dt) / 1000;
      if (set && traveled + dx >= set) {
        // Full loop done — wrap-jumps along the way kept us in the middle
        // copy, so its logo is the nearest one. Center it to finish.
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
      raf = requestAnimationFrame(frame);
    };

    // Suspend snap AND smooth behavior while gliding: with `scroll-smooth`
    // active, every per-frame scrollLeft write would start its own smooth
    // animation — dozens of competing animations read as vibration.
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
    raf = requestAnimationFrame(frame);
    // Wrapper catches the arrow buttons too, not just the scroll row.
    const wrap = el.parentElement ?? el;
    const opts = { passive: true } as AddEventListenerOptions;
    wrap.addEventListener("pointerdown", stop, opts);
    wrap.addEventListener("wheel", stop, opts);
    wrap.addEventListener("touchstart", stop, opts);
    wrap.addEventListener("keydown", stop);
    return () => {
      stop();
      wrap.removeEventListener("pointerdown", stop);
      wrap.removeEventListener("wheel", stop);
      wrap.removeEventListener("touchstart", stop);
      wrap.removeEventListener("keydown", stop);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  // RTL: "forward" reveals content to the left (negative scrollLeft).
  const scroll = (dir: "next" | "prev") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir === "next" ? -amount : amount, behavior: "smooth" });
  };

  const arrowBtn =
    "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  // One copy of the row. Only the middle copy (copy === 1) is exposed to
  // assistive tech / keyboard — the clones are presentational scroll buffer.
  const renderSet = (copy: number) => {
    const isPrimary = copy === 1;
    return items.map((artist, i) => {
      const url = "https:" + artist.fields.heroBanner!.fields!.file!.url;
      const name = String(artist.fields.name ?? "");
      // Brand card sits mid-row (per Figma) — animated: aurora wash, neon
      // sheen sweep, breathing wordmark. Carousel opens centered on it.
      const logoCard =
        i === mid ? (
          <button
            key={`logo-${copy}`}
            ref={isPrimary ? logoRef : undefined}
            type="button"
            tabIndex={isPrimary ? undefined : -1}
            aria-hidden={isPrimary ? undefined : true}
            onClick={() => window.dispatchEvent(new CustomEvent("myt:open-search"))}
            aria-label={isPrimary ? "חיפוש אירוע" : undefined}
            className="group relative block h-64 w-44 shrink-0 snap-center overflow-hidden rounded-3xl border border-main-foreground/20 bg-primary transition-transform duration-300 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-main sm:h-80 sm:w-56"
          >
            {/* Soft sheen sweeping across */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/30 blur-lg"
              style={{ animation: "logo-sheen 3s ease-in-out infinite" }}
            />
            {/* Wordmark ⇄ MΣ mark crossfade-morph */}
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
        ) : null;
      return (
        <React.Fragment key={`${copy}-${artist.sys.id}`}>
          {logoCard}
          <Link
            href={`/artists/${artist.sys.id}`}
            role={isPrimary ? "listitem" : undefined}
            tabIndex={isPrimary ? undefined : -1}
            aria-hidden={isPrimary ? undefined : true}
            aria-label={isPrimary ? `עמוד האומן ${name}` : undefined}
            className={cn(
              "group relative block shrink-0 snap-start transition-transform duration-300 hover:rotate-0 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-main",
              tilts[i % tilts.length]
            )}
          >
            <div
              className={cn(
                "relative h-64 w-44 overflow-hidden rounded-3xl sm:h-80 sm:w-56",
                blobColors[i % blobColors.length]
              )}
            >
              <Image
                src={url}
                alt={isPrimary ? name : ""}
                fill
                sizes="(max-width: 640px) 11rem, 14rem"
                className="object-cover object-bottom"
              />
            </div>
            <span className="absolute inset-x-2 bottom-2 truncate rounded-xl bg-main/70 px-3 py-1.5 text-center text-sm font-bold text-main-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {name}
            </span>
          </Link>
        </React.Fragment>
      );
    });
  };

  return (
    <div className="relative">
      {/* Next (forward) — left side in RTL */}
      <button
        type="button"
        onClick={() => scroll("next")}
        aria-label="האירועים הבאים"
        className={cn(arrowBtn, "left-2")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {/* Prev — right side in RTL */}
      <button
        type="button"
        onClick={() => scroll("prev")}
        aria-label="האירועים הקודמים"
        className={cn(arrowBtn, "right-2")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory scroll-smooth gap-3 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] sm:gap-4 sm:px-8"
        role="list"
        aria-label="אירועים מובילים"
      >
        {Array.from({ length: COPIES }, (_, copy) => renderSet(copy))}
      </div>
    </div>
  );
};
