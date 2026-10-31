"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { Check, Loader2, Plane } from "lucide-react";

import { CardWrapper } from "@/components/ui/cardWrapper";
import { FlightMeta } from "@/components/ui/FlightCard";
import type { ItineraryFlight } from "@/lib/app.types";
import { dayMonth } from "@/lib/itinerary/builder";
import { priceBadge, type PriceBadge } from "@/lib/itinerary/flightsView";
import { cn } from "@/lib/utils";
import { ADD_BUTTON } from "./parts";

const usd = (n: number): string => `$${Math.ceil(n).toLocaleString("en-US")}`;

/** The live card's price pill copy, against the base offer, per traveller. */
function BadgeText({ badge }: { badge: PriceBadge }) {
  if (badge.kind === "included") return <>כלול במחיר</>;
  if (badge.kind === "less")
    return (
      <>
        הפחיתו <span dir="ltr">-{usd(badge.usd)}</span> לנוסע
      </>
    );
  return (
    <>
      <span dir="ltr">+{usd(badge.usd)}</span> לנוסע
    </>
  );
}

/**
 * One flight between two cities of the trip - the live FlightTicketCard draws an outbound and an
 * inbound, a move has one leg: its chrome (CardWrapper, selected border, the price pill against the
 * base offer, best / cheapest tags), its row (airline, day, flight number around `FlightMeta`) and
 * its bags. The whole card selects; the button says so for keyboards and shows the check of the
 * price on its way.
 */
export function MoveFlightCard({
  flight,
  pax,
  basePrice,
  selected,
  pricing,
  failed,
  isBest,
  isCheapest,
  onSelect,
}: {
  flight: ItineraryFlight;
  pax: number;
  /** The base offer's price per traveller. */
  basePrice: number;
  selected: boolean;
  pricing: boolean;
  failed: boolean;
  isBest: boolean;
  isCheapest: boolean;
  onSelect: (flight: ItineraryFlight) => void;
}) {
  const badge = priceBadge(flight.price, pax, basePrice);
  const leg = flight.legs[0];
  const { metadata } = flight;
  const select = () => {
    if (!pricing && !selected) onSelect(flight);
  };
  const bags = [
    { src: "/icons/hand-bag.svg", size: 12, count: 1 },
    { src: "/icons/cabin-bag.svg", size: 14, count: leg.cabinBagsIncluded ? 1 : 0 },
    { src: "/icons/checked-bag.svg", size: 20, count: leg.checkBagsIncluded ? 1 : 0 },
  ];
  const bagsLabel = `מידע על מזוודות: תיק יד כלול, ${
    leg.cabinBagsIncluded ? "מזוודת תא נוסעים כלולה" : "מזוודת תא נוסעים לא כלולה"
  }, ${leg.checkBagsIncluded ? "מזוודה נרשמת כלולה" : "מזוודה נרשמת לא כלולה"}`;

  return (
    <CardWrapper isSelected={selected} onClick={select} className="mt-4 flex-col items-stretch p-0">
      <div
        className={cn(
          "absolute start-3 top-0 z-10 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-forest bg-card px-3 py-1 text-sm font-bold text-forest dark:border-glow dark:text-glow",
          selected && "border-main bg-main text-main-foreground dark:border-foreground dark:bg-foreground dark:text-background",
        )}
      >
        <BadgeText badge={badge} />
      </div>
      {(isBest || isCheapest) && (
        <div className="absolute end-3 top-0 z-10 flex -translate-y-1/2 gap-1">
          {isBest && (
            <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              ★ הטוב ביותר
            </span>
          )}
          {isCheapest && (
            <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              ↓ הזול ביותר
            </span>
          )}
        </div>
      )}

      <div className="flex w-full flex-col pt-4 lg:flex-row lg:pt-2">
        <div className="flex w-full flex-row items-center justify-between gap-2 px-3 py-3 lg:gap-1 lg:px-4">
          <div className="flex w-[22%] shrink-0 flex-col items-center gap-0.5 text-center lg:w-[18%]">
            {/* Airline logos are dark-ink PNGs - on the dark card they sit on a white chip. */}
            <div className="rounded-md dark:bg-white/95 dark:p-1">
              {metadata.logo ? (
                <Image
                  src={metadata.logo}
                  alt={`${metadata.name} logo`}
                  width={100}
                  height={100}
                  className="h-auto w-full max-w-[88px] object-contain"
                />
              ) : (
                <Plane size={28} className="text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="text-xs font-bold tabular-nums text-muted-foreground">{dayMonth(leg.departureTime.slice(0, 10))}</div>
            {leg.flightNumber && <div className="hidden text-xs lg:block">{leg.flightNumber}</div>}
            {leg.operatedBy && (
              // Registry names run long ("KLM Royal Dutch Airlines (Koninklijke ...)"): the bracket
              // goes and two lines at most - the full name stays in the title.
              <div className="line-clamp-2 text-[10px] leading-tight text-forest dark:text-glow" dir="rtl" title={leg.operatedBy}>
                מופעל ע״י <span dir="ltr">{leg.operatedBy.replace(/\s*\(.*\)\s*$/, "")}</span>
              </div>
            )}
          </div>
          <div className="flex w-full justify-center">
            <FlightMeta {...leg} />
          </div>
        </div>

        <div className="hidden w-px shrink-0 bg-border lg:my-3 lg:block" aria-hidden />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-3 py-2.5 lg:w-44 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:justify-center lg:border-t-0 lg:px-3 lg:py-4">
          <div role="img" aria-label={bagsLabel} className="flex items-end gap-2.5 text-xs font-bold">
            {bags.map((b) => (
              <span key={b.src} className={cn("flex items-end gap-0.5", b.count === 0 && "opacity-40")}>
                <Image src={b.src} alt="" width={b.size} height={b.size} unoptimized className="dark:invert" />
                {b.count}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              select();
            }}
            aria-busy={pricing}
            disabled={pricing}
            className={cn(
              ADD_BUTTON,
              "inline-flex min-w-28 items-center justify-center gap-1.5 text-sm",
              selected &&
                "border border-forest bg-transparent text-forest hover:bg-transparent hover:text-forest dark:border-glow dark:bg-transparent dark:text-glow dark:hover:bg-transparent dark:hover:text-glow",
              pricing && "disabled:bg-main disabled:text-main-foreground dark:disabled:bg-foreground dark:disabled:text-background",
            )}
          >
            {pricing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                בודקים מחיר…
              </>
            ) : selected ? (
              <>
                <Check className="size-4" aria-hidden />
                נבחרה
              </>
            ) : (
              "בחירה"
            )}
          </button>
          {failed && (
            <p role="alert" className="m-0 w-full text-center text-xs font-bold text-destructive">
              לא הצלחנו לאמת את הטיסה - נסו שוב או בחרו טיסה אחרת
            </p>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}
