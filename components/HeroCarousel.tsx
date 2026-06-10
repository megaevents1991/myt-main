"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { cn } from "@/lib/utils";

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
  const items = artists.filter((a) => a.fields.heroBanner?.fields?.file?.url);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow <= 8) return; // nothing to reveal

    const delta = Math.min(overflow, 240);
    // RTL page: extra content sits to the left → negative scrollLeft.
    const peek = setTimeout(() => el.scrollBy({ left: -delta, behavior: "smooth" }), 700);
    const back = setTimeout(() => el.scrollBy({ left: delta, behavior: "smooth" }), 1800);
    return () => {
      clearTimeout(peek);
      clearTimeout(back);
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
          return (
            <Link
              key={artist.sys.id}
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
          );
        })}
      </div>
    </div>
  );
};
