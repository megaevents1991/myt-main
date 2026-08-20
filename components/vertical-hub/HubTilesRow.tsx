"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type HubTileItem = {
  id: number;
  name: string;
  href: string;
  imageUrl: string | null;
};

/**
 * One-row tiles slider - the football page's "הליגות המבוקשות" (creative
 * 2026-08-20: "שיהיה שורה אחת סליידר"). Same RTL scroll-row pattern as
 * HubEventsCarousel; tile design unchanged from the old grid.
 */
export function HubTilesRow({
  items,
  ariaLabel,
}: {
  items: HubTileItem[];
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const scrollRow = (dir: "next" | "prev") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    // RTL: "next" reveals content to the left (negative scrollLeft).
    el.scrollBy({ left: dir === "next" ? -amount : amount, behavior: "smooth" });
  };
  const arrowBtn =
    "absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-main text-main-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  return (
    <div className="relative" dir="rtl">
      {items.length > 4 && (
        <>
          <button
            type="button"
            aria-label="הקודם"
            onClick={() => scrollRow("prev")}
            className={`${arrowBtn} right-0 translate-x-1/2`}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="הבא"
            onClick={() => scrollRow("next")}
            className={`${arrowBtn} left-0 -translate-x-1/2`}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        </>
      )}
      <div
        ref={scrollRef}
        role="list"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            role="listitem"
            className="group relative block h-32 w-[44%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:w-[240px]"
          >
            {item.imageUrl ? (
              <>
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 45vw, 240px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                  {item.name}
                </h3>
              </>
            ) : (
              // No tile image yet (creative pending) - floodlit ground with
              // the league name as the tile, matching the cover's world.
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background:
                    "radial-gradient(80% 90% at 50% -20%, hsl(150 60% 62% / 0.22), hsl(var(--surface-inverse)))",
                }}
              >
                <h3 className="px-3 text-center font-display text-xl font-extrabold text-main-foreground transition-colors group-hover:text-secondary">
                  {item.name}
                </h3>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
