"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { RotatingTileImage } from "@/components/vertical-hub/RotatingTileImage";
import type { CollagePick } from "@/components/vertical-hub/pickerCollage";

export type DestinationTileItem = {
  id: number;
  name: string;
  nameEnglish: string;
  href: string;
  /** Rotating skyline photos (page_content.tile_images). */
  images: string[];
  /** Static fallback when no tile_images exist. */
  imageUrl: string | null;
  /** The city's artists/teams - rotation pool for the face circles. */
  picks: CollagePick[];
  count: number;
};

/**
 * One face/crest circle that crossfades through its slice of the city's
 * people (creative direction 2026-08-20: "תמונה של אמנים מתחלפים על היעדים").
 * Static first face under reduced-motion or a single-person pool.
 */
function RotatingFace({
  picks,
  offsetMs,
  intervalMs = 6000,
  className,
}: {
  picks: CollagePick[];
  offsetMs: number;
  intervalMs?: number;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (picks.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimate(true);
    let interval: ReturnType<typeof setInterval> | undefined;
    const kickoff = setTimeout(() => {
      interval = setInterval(() => setIdx((i) => (i + 1) % picks.length), intervalMs);
      setIdx((i) => (i + 1) % picks.length);
    }, offsetMs + intervalMs);
    return () => {
      clearTimeout(kickoff);
      if (interval) clearInterval(interval);
    };
  }, [picks.length, intervalMs, offsetMs]);

  if (!picks.length) return null;
  const n = picks.length;
  const mounted = animate ? [...new Set([(idx - 1 + n) % n, idx, (idx + 1) % n])] : [0];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-black/40 ring-2 ring-white/80 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {mounted.map((i) => (
        <Image
          key={picks[i].url}
          src={picks[i].url}
          alt=""
          fill
          sizes="56px"
          loading={i === 0 ? undefined : "lazy"}
          className={cn(
            "transition-opacity duration-1000",
            picks[i].crest ? "object-contain p-1.5" : "object-cover object-top",
            i === idx ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}

/**
 * The יעדים picker grid: rotating skyline photos with the city's artists and
 * teams riding the photo as small rotating circles, plus a free-text filter
 * next to the section title (creative 2026-08-20: "שורת הקלדה חופשית שמפלטרת
 * את התוצאות").
 */
export function DestinationTiles({
  items,
  title,
}: {
  items: DestinationTileItem[];
  title: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.nameEnglish.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div>
      <div
        id="picker-grid"
        className="mb-6 flex scroll-mt-24 flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <p className="text-center font-display text-xl font-bold text-foreground sm:text-2xl">
          {title}
        </p>
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפשו עיר..."
            aria-label="סינון יעדים"
            className="h-11 w-full rounded-xl border border-border bg-card px-4 pr-9 text-sm font-medium text-foreground shadow-sm placeholder:font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          לא מצאנו יעד כזה - נסו שם אחר.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" role="list">
          {filtered.map((child, idx) => {
            // Faces: split the pool across up to 3 circles so each rotates
            // through different people (slot i gets picks i, i+3, i+6...).
            const slots = [0, 1, 2]
              .map((s) => child.picks.filter((_, i) => i % 3 === s))
              .filter((slot) => slot.length > 0);
            return (
              <Link
                key={child.id}
                href={child.href}
                role="listitem"
                className="group relative block h-40 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:h-48"
              >
                {child.images.length > 0 ? (
                  <RotatingTileImage
                    images={child.images}
                    alt={child.name}
                    offsetMs={(idx % 6) * 900}
                  />
                ) : child.imageUrl ? (
                  <Image
                    src={child.imageUrl}
                    alt={child.name}
                    fill
                    sizes="(max-width: 640px) 45vw, 400px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(80% 90% at 50% -20%, hsl(150 60% 62% / 0.22), hsl(var(--surface-inverse)))",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* The city's people, rotating on the skyline. */}
                {slots.length > 0 && (
                  <div
                    aria-hidden
                    className="absolute right-3 top-3 flex flex-row-reverse items-center"
                  >
                    {slots.map((slot, s) => (
                      <RotatingFace
                        key={s}
                        picks={slot}
                        offsetMs={(idx % 6) * 900 + s * 2000}
                        className={cn("size-11 sm:size-14", s > 0 && "-mr-2.5")}
                      />
                    ))}
                  </div>
                )}

                <div className="absolute inset-x-3 bottom-3 text-center">
                  <h3 className="text-xl font-extrabold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.85)] transition-colors group-hover:text-secondary">
                    {child.name}
                  </h3>
                  {child.count > 0 && (
                    <p className="text-xs font-medium text-white/75 [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]">
                      {child.count} אירועים
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
