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

/**
 * Hero gallery — a scrollable row of tilted, colorful cutout cards shown
 * under the homepage hero headline. Decorative + navigational: each card
 * links to its artist page.
 *
 * - Desktop: prev/next arrow buttons (RTL-aware) for clear scroll affordance.
 * - Touch: native swipe + scroll-snap.
 * - First load: a single gentle "peek" scroll hints the row is swipeable
 *   (skipped under prefers-reduced-motion).
 */
export const HeroCarousel = ({ artists }: { artists: Artist[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLButtonElement>(null);
  const items = artists.filter((a) => a.fields.heroBanner?.fields?.file?.url);

  // Start with the brand logo card centered in the viewport (per Figma).
  useEffect(() => {
    logoRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [items.length]);

  // Idle auto-rotation: advances one card every few seconds (ping-pong at the
  // edges) until the user first touches the gallery. Plays nicely with scroll
  // snapping because it uses the same smooth scrollBy as the arrow buttons.
  // Skipped under prefers-reduced-motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dir: 1 | -1 = -1; // RTL: forward content sits at negative scrollLeft

    const tick = setInterval(() => {
      if (document.hidden) return;
      const min = -(el.scrollWidth - el.clientWidth);
      if (el.scrollLeft <= min + 8) dir = 1;
      else if (el.scrollLeft >= -8) dir = -1;
      el.scrollBy({ left: dir * 220, behavior: "smooth" });
    }, 2600);

    const stop = () => clearInterval(tick);
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
        {items.map((artist, i) => {
          const url = "https:" + artist.fields.heroBanner!.fields!.file!.url;
          const name = String(artist.fields.name ?? "");
          // Brand card sits mid-row (per Figma) — animated: aurora wash, neon
          // sheen sweep, breathing wordmark. Carousel opens centered on it.
          const logoCard =
            i === Math.floor(items.length / 2) ? (
              <button
                key="logo-card"
                ref={logoRef}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("myt:open-search"))}
                aria-label="חיפוש אירוע"
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
            <React.Fragment key={artist.sys.id}>
              {logoCard}
              <Link
                href={`/artists/${artist.sys.id}`}
                role="listitem"
                aria-label={`עמוד האומן ${name}`}
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
                    alt={name}
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
        })}
      </div>
    </div>
  );
};
