"use client";

import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Landmark, MapPin, Users } from "lucide-react";

import type { CategoryStadium } from "@/lib/taxonomy.types";

/**
 * "אצטדיונים מומלצים" - recommended-stadium cards on a vertical hub page.
 * Content comes from `categories.page_content.stadiums` (backoffice-managed).
 * Works with or without a photo: no photo → brand gradient with a stadium
 * glyph, so the section still looks intentional before images are uploaded.
 */
export const StadiumCards = ({
  stadiums,
  variant = "grid",
}: {
  stadiums: CategoryStadium[];
  /** "carousel" = RTL scroll row with arrows (hub page); "grid" = static
   * columns (team page, single card). */
  variant?: "grid" | "carousel";
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!stadiums.length) return null;

  const scrollRow = (dir: "next" | "prev") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    // RTL: "next" reveals content to the left (negative scrollLeft).
    el.scrollBy({ left: dir === "next" ? -amount : amount, behavior: "smooth" });
  };
  const arrowBtn =
    "absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-main text-main-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  const cards = (
    <div
      ref={variant === "carousel" ? scrollRef : undefined}
      role="list"
      aria-label="אצטדיונים מומלצים"
      className={
        variant === "carousel"
          ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {stadiums.map((s) => (
        <article
          key={s.name}
          role="listitem"
          className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover ${
            variant === "carousel" ? "w-[82%] shrink-0 snap-start sm:w-[340px]" : ""
          }`}
        >
          <div className="relative h-40 w-full overflow-hidden bg-main">
            {s.image_url ? (
              <Image
                src={s.image_url}
                alt={`אצטדיון ${s.name}`}
                fill
                sizes="(max-width: 640px) 90vw, 400px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(80%_120%_at_50%_0%,hsl(160_55%_28%/0.9),hsl(var(--surface-inverse)))]">
                <Landmark
                  className="size-14 text-main-foreground/70"
                  aria-hidden
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <h3 className="absolute inset-x-4 bottom-3 font-display text-xl font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
              {s.name}
            </h3>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4 text-primary" aria-hidden />
                {s.city}
              </span>
              {s.capacity && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4 text-primary" aria-hidden />
                  {s.capacity}
                </span>
              )}
            </div>
            {s.teams && (
              <p className="text-sm font-semibold text-foreground">{s.teams}</p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {s.description}
            </p>
          </div>
        </article>
      ))}
    </div>
  );

  if (variant !== "carousel") return cards;

  return (
    <div className="relative" dir="rtl">
      {stadiums.length > 3 && (
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
      {cards}
    </div>
  );
};
