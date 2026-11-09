"use client";

import { CLUB_COPY } from "@/lib/club/copy";

/** Mockup version C's mint-to-teal. Constant in light and dark: it is the card's own material, text on it is forest. */
export const CLUB_GRADIENT = "linear-gradient(135deg, hsl(var(--brand-glow)) 0%, #25D3B0 100%)";

/** The MEGA CLUB member card (mockup version C): mint to teal, wordmark, chip, number, name, "מאז MM/YY". */
export function ClubCard({
  memberNo,
  name,
  since,
  className = "",
}: {
  memberNo: number;
  name?: string | null;
  since?: Date;
  className?: string;
}) {
  const d = since ?? new Date();
  const mmYY = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  return (
    <div
      dir="rtl"
      className={`relative w-full overflow-hidden rounded-2xl p-5 text-forest shadow-[0_12px_28px_-10px_rgba(37,211,176,0.55)] ${className}`}
      style={{ background: CLUB_GRADIENT, aspectRatio: "1.7 / 1" }}
      aria-label={`${CLUB_COPY.brand} ${CLUB_COPY.memberTag} ${memberNo}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full"
        style={{ background: "rgba(255,255,255,0.18)" }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span dir="ltr" className="text-lg font-extrabold tracking-[0.2em]">
            {CLUB_COPY.brand}
          </span>
          <span
            aria-hidden
            className="h-7 w-9 rounded-md"
            style={{ background: "linear-gradient(135deg,#f6e7a8 0%,#d9b85a 100%)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold opacity-75">{CLUB_COPY.memberTag}</div>
            <div dir="ltr" className="text-right text-2xl font-extrabold tabular-nums tracking-wider">
              {memberNo}
            </div>
            {name ? <div className="mt-0.5 truncate text-sm font-semibold">{name}</div> : null}
          </div>
          <div className="shrink-0 text-xs font-semibold opacity-75">
            {CLUB_COPY.since} <span dir="ltr">{mmYY}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
