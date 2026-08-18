"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { FootballTeam } from "@/lib/app.types";
import { EventArt } from "@/components/ui/EventArt";
import { isTightCrest } from "@/lib/eventArt";

/**
 * League-page teams carousel - the homepage compact team card (blob art +
 * crest), in a native RTL-aware scroll row. Card art logic mirrors
 * CompactTeamCard in ClientSideHomepage (photo-bg vs blob crest sizing).
 */
export const TeamCardsRow = ({
  teams,
  hrefById,
  size = "default",
}: {
  teams: FootballTeam[];
  /** Canonical /c/ link per team sys.id (falls back to the legacy route). */
  hrefById?: Record<string, string>;
  /** "compact" = the crest strip that sits right under a hub cover: more
   * crests in view, so the row reads as the vertical's roster rather than a
   * feature carousel. */
  size?: "default" | "compact";
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (teams.length === 0) return null;

  const compact = size === "compact";
  const cardWidth = compact
    ? "w-[31%] shrink-0 snap-start sm:w-[148px]"
    : "w-[44%] shrink-0 snap-start sm:w-[240px]";

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
      {teams.length > 4 && (
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
        aria-label="קבוצות הליגה"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {teams.map((team) => {
          // Same crest-sizing rules as the homepage compact card: photo-bg
          // shapes ignore the backoffice dials unless the crest is a tight
          // (unpadded) badge; blob shapes honor them as-is.
          const isPhotoBg = (team.fields.artShapeIndex ?? 0) >= 6;
          const tightCrest = isTightCrest(team.fields.artImageUrl);
          const crestScale = team.fields.artImageScale ?? 0.65;
          const crestOffsetY = team.fields.artImageOffsetY ?? -12;
          return (
            <Link
              key={team.sys.id}
              href={hrefById?.[team.sys.id] ?? `/football/${team.sys.id}`}
              role="listitem"
              aria-label={`עמוד קבוצת כדורגל ${team.fields.name || "לא ידוע"}`}
              className={`group block ${cardWidth} ${compact ? "" : "transition-opacity hover:opacity-90"}`}
            >
              {compact ? (
                <div className="flex flex-col items-center gap-2.5 py-1">
                  <div
                    className="relative flex size-24 items-center justify-center rounded-full ring-1 ring-white/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:ring-secondary/70 group-hover:shadow-[0_14px_44px_-10px_hsl(var(--brand-mint)/0.55)] sm:size-32"
                    style={{
                      background:
                        "radial-gradient(65% 65% at 50% 38%, hsl(150 60% 62% / 0.16), hsl(160 55% 20% / 0.4) 72%, transparent 100%)",
                    }}
                  >
                    {team.fields.artImageUrl ? (
                      <Image
                        src={team.fields.artImageUrl}
                        alt={`סמל ${team.fields.name || ""}`}
                        fill
                        sizes="(max-width: 640px) 30vw, 128px"
                        className="object-contain p-4 drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)] transition-transform duration-300 group-hover:scale-105 sm:p-5"
                      />
                    ) : team.fields.heroBanner?.fields?.file?.url ? (
                      <Image
                        src={"https:" + team.fields.heroBanner.fields.file.url}
                        alt={`תמונה של ${team.fields.name || ""}`}
                        fill
                        sizes="(max-width: 640px) 30vw, 128px"
                        className="rounded-full object-cover"
                      />
                    ) : null}
                  </div>
                  <h3
                    className="max-w-full truncate text-center text-sm font-bold text-main-foreground/90"
                    title={team.fields.name || ""}
                  >
                    {team.fields.name || ""}
                  </h3>
                </div>
              ) : (
              <div
                className="flex h-full w-full flex-col rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover"
                style={{ height: "245px" }}
              >
                <div className="group relative flex-1 overflow-hidden rounded-t-2xl">
                  <EventArt
                    id={team.sys.id}
                    imageUrl={
                      team.fields.artImageUrl ||
                      (team.fields.heroBanner?.fields?.file?.url
                        ? "https:" + team.fields.heroBanner.fields.file.url
                        : undefined)
                    }
                    alt={`לוגו של קבוצת כדורגל ${team.fields.name || "לא ידוע"}`}
                    variant={team.fields.artImageUrl ? "blob" : "photo"}
                    colorIndex={team.fields.artColorIndex ?? undefined}
                    shapeIndex={team.fields.artShapeIndex ?? undefined}
                    imageScale={
                      isPhotoBg
                        ? tightCrest
                          ? crestScale
                          : undefined
                        : team.fields.artImageScale
                    }
                    bgScale={team.fields.artBgScale}
                    imageOffsetX={
                      isPhotoBg
                        ? tightCrest
                          ? team.fields.artImageOffsetX ?? undefined
                          : undefined
                        : team.fields.artImageOffsetX
                    }
                    imageOffsetY={
                      isPhotoBg
                        ? tightCrest
                          ? crestOffsetY
                          : undefined
                        : team.fields.artImageOffsetY
                    }
                    imageClassName={
                      isPhotoBg
                        ? tightCrest
                          ? "object-center"
                          : "object-center scale-[1.4]"
                        : undefined
                    }
                    sizes="(max-width: 640px) 45vw, 240px"
                    className="h-full w-full"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="flex-none p-3 text-center">
                  <h3
                    className="text-md mb-1 line-clamp-2 font-bold text-foreground"
                    style={{ lineHeight: "1.2" }}
                    title={team.fields.name || ""}
                  >
                    {team.fields.name || ""}
                  </h3>
                </div>
              </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
