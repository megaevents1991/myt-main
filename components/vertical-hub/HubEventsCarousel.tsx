"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { EventCard } from "@/components/EventCard";

/**
 * Horizontal event-card row for the vertical hub pages (חבילות מומלצות).
 * Native RTL-aware overflow scrolling with arrow controls - same approach as
 * the homepage carousels (Mantine/Embla mis-scrolled in RTL, so plain
 * overflow + custom controls).
 */
export const HubEventsCarousel = ({
  events,
  showName = true,
  ariaLabel,
}: {
  events: Event[];
  showName?: boolean;
  ariaLabel: string;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (events.length === 0) return null;

  const showArrows = events.length > 4;
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
      {showArrows && (
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
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => (
          <div
            key={event.id}
            className="w-[85%] shrink-0 snap-start sm:w-[300px]"
          >
            <EventCard event={event} showName={showName} />
          </div>
        ))}
      </div>
    </div>
  );
};
