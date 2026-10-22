"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { Check, Loader2, Plane, TrainFront } from "lucide-react";

import { CardWrapper } from "@/components/ui/cardWrapper";
import { FlightMeta } from "@/components/ui/FlightCard";
import type { FlightSegment, ItineraryFlight } from "@/lib/app.types";
import { dayMonth } from "@/lib/itinerary/builder";
import { priceBadge, trainRowText, trainToggleLabel, type CardRow, type PriceBadge } from "@/lib/itinerary/flightsView";
import type { TrainLeg } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { ADD_BUTTON } from "./parts";

const usd = (n: number): string => `$${Math.ceil(n).toLocaleString("en-US")}`;

/** The live card's price pill copy, against the base offer, per traveller. */
function BadgeText({ badge }: { badge: PriceBadge }) {
  if (badge.kind === "included") return <>כלול במחיר החבילה</>;
  if (badge.kind === "less")
    return (
      <>
        הפחיתו <span dir="ltr">-{usd(badge.usd)}</span> לנוסע ממחיר החבילה
      </>
    );
  return (
    <>
      <span dir="ltr">+{usd(badge.usd)}</span> לנוסע
    </>
  );
}

/** "אגיע עצמאית" - a switch: the move leaves the flight search (or comes back to it). */
function TrainToggle({ on, km, onToggle }: { on: boolean; km: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e: MouseEvent) => {
        // The card selects on click - the switch must not.
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border bg-background py-1 pe-3 ps-1 text-xs font-bold text-foreground transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
        on ? "border-brand-aqua/60" : "border-border hover:border-forest dark:hover:border-glow",
      )}
    >
      <span
        aria-hidden
        className={cn("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors", on ? "bg-brand-aqua" : "bg-muted")}
      >
        <span
          className={cn(
            "absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-[inset-inline-start] duration-200",
            on ? "start-[14px]" : "start-[2px]",
          )}
        />
      </span>
      {trainToggleLabel(km)}
    </button>
  );
}

/** One flight of the trip: the live card's leg row (airline, day, flight number) around `FlightMeta`. */
function LegRow({ leg, flight }: { leg: FlightSegment; flight: ItineraryFlight }) {
  const { metadata } = flight;
  return (
    <div className="flex w-full flex-row items-center justify-between gap-2 py-3 lg:gap-1">
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
  );
}

/** A move made by train: who arranges it and roughly how long it takes. */
function TrainRow({ hop }: { hop: TrainLeg }) {
  const { title, detail } = trainRowText(hop);
  return (
    <div className="flex items-center gap-3 py-3 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-aqua text-black">
        <TrainFront className="size-4" aria-hidden />
      </span>
      <p className="m-0 min-w-0 text-muted-foreground">
        <b className="text-foreground">{title}</b> · <span className="tabular-nums">{detail}</span>
      </p>
    </div>
  );
}

/** Hand bag always; trolley and suitcase as the fare has them (the same on every leg of an offer). */
function Bags({ leg }: { leg: FlightSegment }) {
  const label = `מידע על מזוודות: תיק יד כלול, ${
    leg.cabinBagsIncluded ? "מזוודת תא נוסעים כלולה" : "מזוודת תא נוסעים לא כלולה"
  }, ${leg.checkBagsIncluded ? "מזוודה נרשמת כלולה" : "מזוודה נרשמת לא כלולה"}`;
  const items = [
    { src: "/icons/hand-bag.svg", size: 12, count: 1 },
    { src: "/icons/cabin-bag.svg", size: 14, count: leg.cabinBagsIncluded ? 1 : 0 },
    { src: "/icons/checked-bag.svg", size: 20, count: leg.checkBagsIncluded ? 1 : 0 },
  ];
  return (
    <div role="img" aria-label={label} className="flex items-end gap-2.5 text-xs font-bold">
      {items.map((b) => (
        <span key={b.src} className={cn("flex items-end gap-0.5", b.count === 0 && "opacity-40")}>
          <Image src={b.src} alt="" width={b.size} height={b.size} unoptimized className="dark:invert" />
          {b.count}
        </span>
      ))}
    </div>
  );
}

/**
 * "Build Your Euro Trip" - one multi-city offer: the live FlightTicketCard's chrome (CardWrapper,
 * selected border, price pill against the base offer, best / cheapest tags, bags) with a row per
 * leg of the trip. Under a between-cities flight, "אגיע עצמאית"; a move the customer makes on
 * their own shows as a "הגעה עצמאית" row in its place. The whole card selects (like the live
 * card); the button says so for keyboards and shows the pricing on its way - its label
 * ("בחירה" / "בודקים מחיר…" / "נבחרה") is the one signal of the state (no aria-pressed beside it).
 */
export function ItineraryFlightCard({
  flight,
  pax,
  rows,
  hops,
  basePrice,
  selected,
  pricing,
  failed,
  isBest,
  isCheapest,
  onSelect,
  onToggleTrain,
}: {
  flight: ItineraryFlight;
  pax: number;
  rows: CardRow[];
  /** Every move of the trip by key: the names and km a train between its stays would have. */
  hops: ReadonlyMap<string, TrainLeg>;
  /** The base offer's price per traveller. */
  basePrice: number;
  selected: boolean;
  /** Its price is being checked. */
  pricing: boolean;
  /** The pricing service could not confirm it (it never says the price moved). */
  failed: boolean;
  isBest: boolean;
  isCheapest: boolean;
  onSelect: (flight: ItineraryFlight) => void;
  onToggleTrain: (key: string) => void;
}) {
  const badge = priceBadge(flight.price, pax, basePrice);
  const select = () => {
    if (!pricing && !selected) onSelect(flight);
  };

  return (
    <CardWrapper isSelected={selected} onClick={select} className="mt-4 flex-col items-stretch p-0">
      {/* The price pill (the live card's mobile pill, here on every width). */}
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
        <div className="flex w-full flex-col divide-y divide-border px-3 lg:px-4">
          {rows.map((row, i) => {
            if (row.kind === "train") {
              const hop = hops.get(row.key);
              if (!hop) return null;
              return (
                <div key={`train-${row.key}`} className="flex flex-col gap-1 pb-3">
                  <TrainRow hop={hop} />
                  <TrainToggle on km={hop.km} onToggle={() => onToggleTrain(row.key)} />
                </div>
              );
            }
            const key = row.trip?.kind === "mid" ? row.trip.key : undefined;
            const hop = key ? hops.get(key) : undefined;
            return (
              <div key={`leg-${i}`} className={cn("flex flex-col", hop && "pb-3")}>
                <LegRow leg={row.leg} flight={flight} />
                {key && hop && <TrainToggle on={false} km={hop.km} onToggle={() => onToggleTrain(key)} />}
              </div>
            );
          })}
        </div>

        <div className="hidden w-px shrink-0 bg-border lg:my-3 lg:block" aria-hidden />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-3 py-2.5 lg:w-44 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:justify-center lg:border-t-0 lg:px-3 lg:py-4">
          <Bags leg={flight.legs[0]} />
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
