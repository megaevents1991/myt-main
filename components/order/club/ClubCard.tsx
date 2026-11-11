"use client";

import Image from "next/image";
import { CLUB_COPY } from "@/lib/club/copy";

/** Mockup version C's mint-to-teal. Constant in light and dark: it is the card's own material, text on it is forest. */
export const CLUB_GRADIENT = "linear-gradient(135deg, hsl(var(--brand-glow)) 0%, #25D3B0 100%)";

/** The MEGA CLUB member card (mockup version C): mint to teal, wordmark, chip, number, name, "מאז MM/YY". */
export function ClubCard({
  memberNo,
  name,
  since,
  size = "full",
  reveal = false,
  showSince = true,
  className = "",
}: {
  /** null = the preview on the /club page: no number yet. */
  memberNo: number | null;
  name?: string | null;
  since?: Date;
  /** "compact" = a short strip for the order summary (D17); "full" keeps the card's 1.7:1. */
  size?: "full" | "compact";
  /** D17: the card arrives - it lifts into place and one sheen crosses it (globals.css, off under reduced motion). */
  reveal?: boolean;
  /** Off where the join date is not known (a member remembered on this device): today's date would be wrong. */
  showSince?: boolean;
  className?: string;
}) {
  const d = since ?? new Date();
  const mmYY = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  const compact = size === "compact";
  return (
    <div
      dir="rtl"
      className={`relative w-full overflow-hidden text-forest shadow-[0_12px_28px_-10px_rgba(37,211,176,0.55)] ${
        compact ? "h-[116px] rounded-[14px] px-4 py-3.5" : "rounded-2xl p-5"
      } ${reveal ? "club-card-in" : ""} ${className}`}
      style={compact ? { background: CLUB_GRADIENT } : { background: CLUB_GRADIENT, aspectRatio: "1.7 / 1" }}
      aria-label={memberNo == null ? CLUB_COPY.brand : `${CLUB_COPY.brand} ${CLUB_COPY.memberTag} ${memberNo}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute rounded-full ${
          compact ? "-left-10 -top-[52px] h-[150px] w-[150px]" : "-left-10 -top-12 h-40 w-40"
        }`}
        style={{ background: "rgba(255,255,255,0.18)" }}
      />
      {reveal && <div aria-hidden className="club-sheen pointer-events-none absolute inset-0" />}
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span dir="ltr" className={`font-extrabold tracking-[0.2em] ${compact ? "text-[15px]" : "text-lg"}`}>
            {CLUB_COPY.brand}
          </span>
          <span
            aria-hidden
            className={compact ? "h-6 w-8 rounded-md" : "h-7 w-9 rounded-md"}
            style={{ background: "linear-gradient(135deg,#f6e7a8 0%,#d9b85a 100%)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className={`font-semibold opacity-75 ${compact ? "text-[11px]" : "text-xs"}`}>{CLUB_COPY.memberTag}</div>
            <div
              dir="ltr"
              className={`text-right font-extrabold tabular-nums tracking-wider ${compact ? "text-[22px] leading-tight" : "text-2xl"}`}
            >
              {memberNo ?? "• • • •"}
            </div>
            {name ? <div className={`mt-0.5 truncate font-semibold ${compact ? "text-[13px]" : "text-sm"}`}>{name}</div> : null}
          </div>
          {/* Our wordmark in the bottom corner, like an issuer's mark (Tom 11.11); the join date sits above it. */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {memberNo != null && showSince && (
              <div className={`font-semibold opacity-75 ${compact ? "text-[11px]" : "text-xs"}`}>
                {CLUB_COPY.since} <span dir="ltr">{mmYY}</span>
              </div>
            )}
            <Image
              src="/brand/logo-wordmark-forest.svg"
              alt="מגה איבנטס"
              width={297}
              height={43}
              unoptimized
              className={`w-auto ${compact ? "h-3" : "h-4"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
