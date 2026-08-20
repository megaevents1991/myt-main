import Image from "next/image";
import Link from "next/link";

import { EVENT_ART_BLOB_SHAPES, EVENT_ART_COLORS } from "@/lib/eventArt";
import type { CollagePick } from "@/components/vertical-hub/pickerCollage";

export type GenreTileItem = {
  id: number;
  name: string;
  href: string;
  picks: CollagePick[];
  count: number;
};

/**
 * Genre tiles - dark tile, brand blob halo, hero + two side circles of the
 * genre's artists (Dor's circle-cluster design). Used on /c/music right under
 * the cover (creative 2026-08-20: the standalone genres picker page is gone,
 * "זה ממש מתחת להדר").
 */
export function GenreTiles({ items }: { items: GenreTileItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" role="list">
      {items.map((item, idx) => {
        // Brand blob per tile - color/shape spread by position (steps 1 and 5,
        // coprime with the pool sizes) so neighbours never match.
        const blobShape =
          EVENT_ART_BLOB_SHAPES[(idx * 5 + 1) % EVENT_ART_BLOB_SHAPES.length];
        const blobColor = EVENT_ART_COLORS[idx % EVENT_ART_COLORS.length];
        return (
          <Link
            key={item.id}
            href={item.href}
            role="listitem"
            className="group relative block h-40 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:h-48"
          >
            <div className="relative flex h-full w-full flex-col items-center justify-end overflow-hidden bg-[hsl(var(--surface-inverse))] pb-3">
              {/* Brand blob halo - sits high behind the circle cluster. */}
              <svg
                className="absolute -top-1/4 left-1/2 h-[130%] w-[130%] -translate-x-1/2 opacity-40 transition-transform duration-300 group-hover:scale-105"
                viewBox={`0 0 ${blobShape.w} ${blobShape.h}`}
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
              >
                <path
                  d={blobShape.d}
                  fill={`hsl(${blobColor})`}
                  transform={
                    blobShape.mirror
                      ? `translate(${blobShape.w},0) scale(-1,1)`
                      : undefined
                  }
                />
              </svg>
              {/* Legibility ground under the name, over the blob. */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />
              {/* Hero circle + two side circles, uniform crop so mixed
                  cut-out scales read as one set. */}
              {item.picks.length > 0 && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-3 flex items-end justify-center sm:top-4"
                >
                  {[item.picks[1], item.picks[0], item.picks[2]]
                    .filter((p): p is CollagePick => p != null)
                    .map((p, i, arr) => {
                      const hero = arr.length === 1 || p === item.picks[0];
                      return (
                        <div
                          key={p.url}
                          className={
                            hero
                              ? "relative z-10 -mx-3 size-20 shrink-0 overflow-hidden rounded-full shadow-[0_14px_30px_-10px_rgba(0,0,0,0.85)] sm:size-24"
                              : "relative size-12 shrink-0 overflow-hidden rounded-full opacity-90 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.7)] sm:size-14"
                          }
                          style={{
                            background:
                              "radial-gradient(70% 70% at 50% 32%, rgba(255,255,255,0.14), rgba(0,0,0,0.35))",
                            ...(hero
                              ? {
                                  boxShadow: `0 0 0 2px hsl(${blobColor} / 0.7), 0 14px 30px -10px rgba(0,0,0,0.85)`,
                                }
                              : {}),
                          }}
                        >
                          <Image
                            src={p.url}
                            alt=""
                            fill
                            sizes="96px"
                            className={
                              p.crest
                                ? "object-contain p-2.5"
                                : "rounded-full object-cover object-top"
                            }
                          />
                        </div>
                      );
                    })}
                </div>
              )}
              <h3 className="relative z-10 px-3 text-center font-display text-xl font-extrabold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.8)] transition-colors group-hover:text-secondary">
                {item.name}
              </h3>
              {item.count > 0 && (
                <p className="relative z-10 text-xs font-medium text-white/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                  {item.count} אירועים
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
