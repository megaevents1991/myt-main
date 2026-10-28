"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import dayjs from "dayjs";
import { isMobile } from "react-device-detect";
import { Accordion } from "@mantine/core";
import { FaHotel, FaPlane, FaTicketAlt } from "react-icons/fa";
import { Check, CircleAlert, Loader2, Lock, Plane, TrainFront } from "lucide-react";

import { EventSummary } from "@/app/order/OrderSummary/EventSummary";
import { HotelSummary } from "@/app/order/OrderSummary/HotelSummary";
import { MobileHeader } from "@/app/order/OrderSummary/MobileHeader";
import { PriceSummary } from "@/app/order/OrderSummary/PriceSummary";
import { PaymentLogos } from "@/components/order/PaymentLogos";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FlightMeta } from "@/components/ui/FlightCard";
import { Label } from "@/components/ui/label";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import { Timer } from "@/components/ui/Timer";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel } from "@/lib/app.types";
import { lodgingLocation } from "@/lib/events/lodging";
import { ticketReady } from "@/lib/itinerary/adapter";
import { dayMonth, stayCityName, tripCities } from "@/lib/itinerary/builder";
import type { HeldAnswer } from "@/lib/itinerary/confirm";
import { stays, trainLegs, tripLegs } from "@/lib/itinerary/dates";
import { cardRows, trainRowText } from "@/lib/itinerary/flightsView";
import { dayDiff } from "@/lib/itinerary/geo";
import { SUMMARY_HOLD_SECONDS, canContinue, livePrice, progressivePrice } from "@/lib/itinerary/progress";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import { cleanSuggestTitle, type TripSuggestion } from "@/lib/itinerary/suggestion";
import { summaryAdditions, type SummaryAdditions } from "@/lib/itinerary/summaryRows";
import {
  contactKey,
  fitTravellers,
  otherKey,
  validateTravellers,
  type TravellersInput,
  type TravellersMode,
} from "@/lib/itinerary/travellers";
import type { TrainLeg } from "@/lib/itinerary/types";
import { formatPrice } from "@/lib/price.utils";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { TravellersForm, fieldId } from "./TravellersForm";
import { PANEL, nightsLabel } from "./parts";
import { SuggestTripCard } from "./SuggestTripCard";
import { TripRoute } from "./TripRoute";
import { useTripHold } from "./useTripHold";

/** "$2,133" / "$617.50" - whole dollars unless there are cents. */
const money = (n: number): string => {
  const v = Math.round(n * 100) / 100;
  const cents = Number.isInteger(v) ? 0 : 2;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: 2 })}`;
};

/** The live summary's dates: `DD/MM/YYYY`. */
const fullDate = (iso: string): string => dayjs(iso).format("DD/MM/YYYY");

/** The words of a hold attempt's terms error - the regular summary's. */
const TERMS_ERROR = "יש לאשר את פרטי ההזמנה ותנאי השימוש";
/** Paying on the site is not open yet (no `onPay`): said if the button is reached anyway. */
const PAY_PENDING = "התשלום באתר ייפתח בקרוב.";
/** The hold's promise - the confirmation panel and the customer's email say the same. */
const HELD_TEXT = "קיבלנו את הבקשה. נציג יחזור אליכם תוך 24 שעות.";
/** The live summary's kill switch for the customer's 24-hour hold (app/order/OrderReview.tsx `isHoldAllowed`). */
const HOLD_ENABLED = process.env.NEXT_PUBLIC_DISABLE_24H_HOLD !== "true";

/** The live summary's three promises (app/order/OrderReview.tsx `TRUST_ITEMS`, module-private there). */
const TRUST_ITEMS = [
  {
    title: "100% אחריות",
    description:
      "מגה תיירות היא אחת מקבוצות התיירות המובילות בישראל, עם מעל ל- 30 שנות ניסיון ואלפי לקוחות מרוצים.",
  },
  {
    title: "כרטיסים מובטחים",
    description:
      "הכרטיסים הינם מספקים רשמיים בלבד והם 100% בטוחים - אנחנו מתחייבים שתקבלו את מה ששילמתם עליו, בראש שקט",
  },
  {
    title: "שירות אישי ואנושי",
    description: "הצוות שלנו זמין עבורכם לפני, בזמן ואחרי החופשה בטל. 03-768-4800 (גם בווטסאפ!)",
  },
];

/** The live summary's main button (app/order/OrderReview.tsx "המשך לתשלום מאובטח"). */
const MAIN_BUTTON =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-main text-[18px] font-bold text-main-foreground transition-colors hover:bg-main/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-glow dark:text-forest dark:hover:bg-glow/90";
/** The live summary's quiet second button ("הבטיחו מחיר ל-24 שעות"). */
const SECOND_BUTTON =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-md border border-primary text-[15px] font-bold text-success transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5";

/** The live Review's "עריכה" (a section's way back to its step); off while the hold is on its way. */
const EDIT_BUTTON =
  "shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:border-forest hover:text-forest disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground dark:hover:border-glow dark:hover:text-glow";

/** The event's own place, as the live summary names it ("לונדון, בריטניה"; a two-city event: its match city). */
const placeOf = (e: Event): string => lodgingLocation(e, "event").name;

/** One section of the summary: what it says, and the way back to its step. */
type ReviewItem = {
  id: string;
  /** The phone's accordion line (the live Review's `primary` / `secondary`). */
  primary: string;
  secondary: ReactNode;
  icon: ReactNode;
  /** The live piece (EventSummary / the flights / HotelSummary), or what is still missing. */
  content: ReactNode;
  onEdit: () => void;
  editLabel: string;
};

/** A piece not picked yet: said in the section's place (the live pieces need a picked one). */
function NotPicked({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="hidden text-lg font-bold md:block">{title}</h3>
      <p className="m-0 text-[14px] text-muted-foreground">{text}</p>
    </div>
  );
}

/** A move the customer makes alone: "X ← Y · הגעה עצמאית", its day, "בכוחות עצמכם, לא כלול". */
function MoveLine({ hop }: { hop: TrainLeg }) {
  const { title, detail } = trainRowText(hop);
  return (
    <p className="m-0 flex items-center gap-2 py-1 text-[12px] text-muted-foreground">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-aqua text-black" aria-hidden>
        <TrainFront className="size-3.5" />
      </span>
      <span>
        <b className="text-foreground">{title}</b> · <span className="tabular-nums">{detail}</span>
      </span>
    </p>
  );
}

/** One flown leg: its day (and number, operator), then the live `FlightMeta`. */
function LegLine({ leg }: { leg: FlightSegment }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-1 text-[11px] font-semibold text-muted-foreground">
        <span className="tabular-nums">{fullDate(leg.departureTime)}</span>
        {leg.flightNumber && (
          <>
            · <span dir="ltr">{leg.flightNumber}</span>
          </>
        )}
      </div>
      {leg.operatedBy && (
        <div className="text-[11px] text-forest dark:text-glow">
          מופעל ע״י <span dir="ltr">{leg.operatedBy}</span>
        </div>
      )}
      <FlightMeta {...leg} />
    </div>
  );
}

/**
 * The trip's flights in the live `FlightSummary`'s markup (it reads only outbound / inbound, so
 * it cannot draw a trip): heading, airline, first-to-last dates, the row figure; then every leg
 * in trip order - a flown one with the live `FlightMeta`, a move the customer makes alone as a line.
 */
function TripFlights({ flight, addition }: { flight: ItineraryFlight; addition: number | null }) {
  const { state } = useItinerary();
  const { route, dates, train, pax } = state;
  const trainSet = useMemo(() => new Set(train), [train]);
  const rows = useMemo(
    () => cardRows(tripLegs(route, dates, new Set()), flight.legs ?? [], trainSet),
    [flight, route, dates, trainSet],
  );
  const hops = useMemo(
    () => new Map(trainLegs(route, dates, trainSet).map((t): [string, TrainLeg] => [t.key, t])),
    [route, dates, trainSet],
  );
  const legs = flight.legs?.length ? flight.legs : [flight.outbound, flight.inbound];
  const airline = flight.metadata?.name || flight.airline || "";

  return (
    <div>
      <h3 className="hidden text-lg font-bold md:block">
        טיסות <span>({pax} נוסעים)</span>
      </h3>
      <div className="flex w-full justify-between" dir="rtl">
        <div>
          {airline && (
            <div className="hidden text-[16px] md:block">
              <div className="font-bold" dir="ltr">
                {airline}
              </div>
            </div>
          )}
          <div className="flex text-[14px]" dir="rtl">
            <div>מ-</div>
            <div>{fullDate(legs[0].departureTime)}</div>
            <div className="w-1" />
            <div>עד-</div>
            <div>{fullDate(legs[legs.length - 1].departureTime)}</div>
          </div>
        </div>
        {addition !== null && (
          <div>{addition ? formatPrice(addition, { factor: pax, applyColor: false, bold: false }) : "כלול במחיר"}</div>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2 px-2 text-[12px]" dir="rtl">
        {rows.map((row, i) => {
          if (row.kind === "train") {
            const hop = hops.get(row.key);
            return hop ? <MoveLine key={`move-${row.key}`} hop={hop} /> : null;
          }
          return <LegLine key={`leg-${i}`} leg={row.leg} />;
        })}
      </div>
    </div>
  );
}

/**
 * The summary's sections in trip order, from the live summary's pieces: per event its name, place
 * and date, then the live `EventSummary`; the flights; per stay the live `HotelSummary` (its
 * single-hotel path). Each with its "עריכה". The live Review's two looks: a list with the edit
 * beside each section, and on a phone an accordion (the pieces hide their headings there).
 * `locked`: a hold is on its way - every "עריכה" is off until it answers.
 */
function TripReview({
  additions,
  locked,
  onEditEvent,
  onEditFlights,
  onEditStay,
}: {
  additions: SummaryAdditions | null;
  locked: boolean;
  onEditEvent: (i: number) => void;
  onEditFlights: () => void;
  onEditStay: (i: number) => void;
}) {
  const { state } = useItinerary();
  const { route, dates, pax, flight } = state;
  const list = useMemo(() => stays(route, dates), [route, dates]);
  const ranges = useMemo(() => stayRanges(route, dates, flight, new Set(state.train)), [route, dates, flight, state.train]);
  const [opened, setOpened] = useState<string[]>([]);
  // Until every piece is in there is no row figure: the pieces' own switch hides the column
  // (`isAgent` - the live pieces show no per-item figure to an agent) instead of a false "כלול במחיר".
  const hideFigures = additions === null;

  const ticketItems: ReviewItem[] = route.map((e, i) => {
    const t = state.tickets[e.id];
    const ready = !!t && ticketReady(t, pax);
    return {
      id: `tickets-${e.id}`,
      primary: `כרטיסים (${pax})`,
      // The event's own name under "כרטיסים (n)" (Alon 28.10 - the red box): the row says which event.
      secondary: (
        <>
          <span className="block font-semibold text-main dark:text-foreground">{e.name}</span>
          {ready ? `קטגוריה: ${t.zoneLabel || t.category}` : "עוד לא נבחר כרטיס"}
        </>
      ),
      icon: <FaTicketAlt />,
      content: ready ? (
        <div>
          {/* Desktop: the event in the hotel row's small line (place | date), not a big heading. */}
          <p className="m-0 hidden text-[13px] font-bold text-forest md:block dark:text-glow">
            {e.name} · {placeOf(e)} | {fullDate(e.date)}
          </p>
          <EventSummary
            numberOfEventTickets={pax}
            eventTicket={{ category: t.category, zoneLabel: t.zoneLabel, description: t.description }}
            agentCommission={0}
            isAgent={hideFigures}
            eventTicketPriceAddition={additions?.tickets[e.id] ?? 0}
          />
        </div>
      ) : (
        <NotPicked title="כרטיסים" text="עוד לא נבחר כרטיס" />
      ),
      onEdit: () => onEditEvent(i),
      editLabel: `עריכת הכרטיסים ל${e.name}`,
    };
  });

  const flightItem: ReviewItem = {
    id: "flights",
    primary: `טיסות (${pax} נוסעים)`,
    secondary: flight ? flight.metadata?.name || flight.airline : "עוד לא נבחרה טיסה",
    icon: <FaPlane />,
    content: flight ? (
      <TripFlights flight={flight} addition={additions?.flight ?? null} />
    ) : (
      <NotPicked title="טיסות" text="עוד לא נבחרה טיסה" />
    ),
    onEdit: onEditFlights,
    editLabel: "עריכת הטיסות",
  };

  const hotelItems: ReviewItem[] = list.map((stay, i) => {
    const h: OrderHotel | undefined = state.hotels[stay.key];
    const city = stayCityName(stay.events[0]);
    const ready = !!h && stayHotelReady(h, ranges[i], pax);
    const nights = h ? dayDiff(h.checkin.slice(0, 10), h.checkout.slice(0, 10)) : Number.NaN;
    return {
      id: `hotel-${stay.key}`,
      primary: `לינה ב${city} (${pax} אורחים)`,
      secondary: ready ? <bdi dir="ltr">{h.name}</bdi> : "עוד לא נבחר מלון",
      icon: <FaHotel />,
      content: ready ? (
        <div>
          <p className="m-0 hidden text-[13px] font-bold text-forest md:block dark:text-glow">
            {city}
            {Number.isFinite(nights) ? ` · ${nightsLabel(nights)}` : ""}
          </p>
          <HotelSummary
            selectedHotel={h}
            hotelSegments={null}
            agentCommission={0}
            isAgent={hideFigures}
            hotelPriceAddition={additions?.hotels[stay.key] ?? 0}
            totalGuests={pax}
          />
        </div>
      ) : (
        <NotPicked
          title={`לינה ב${city}`}
          text={
            h
              ? "המלון שבחרתם לא מתאים לתאריכי הלינה או למספר הנוסעים - בחרו שוב"
              : "עוד לא נבחר מלון ללינה הזו"
          }
        />
      ),
      onEdit: () => onEditStay(i),
      editLabel: `עריכת המלון ב${city}`,
    };
  });

  if (isMobile) {
    const accordion = (items: ReviewItem[]) => (
      <Accordion
        dir="rtl"
        multiple
        value={opened}
        onChange={setOpened}
        styles={{ item: { borderBottom: "none" }, label: { padding: "0" }, control: { padding: "8px 0" } }}
      >
        {items.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            {/* The edit sits BESIDE the control (Accordion.Control is a <button>). */}
            <div className="flex items-center gap-1" dir="rtl">
              <Accordion.Control>
                <div className="flex w-full items-center gap-3 text-start" dir="rtl">
                  <div
                    className="flex shrink-0 items-center justify-center text-[18px] leading-none text-main dark:text-foreground"
                    aria-hidden
                  >
                    {item.icon}
                  </div>
                  <div className="flex flex-1 flex-col gap-[2px]">
                    <div className="text-[18px] font-bold leading-[18px] text-main dark:text-foreground">{item.primary}</div>
                    <div className="text-[14px] text-[#5A6475] dark:text-muted-foreground">{item.secondary}</div>
                  </div>
                </div>
              </Accordion.Control>
              <button
                type="button"
                onClick={item.onEdit}
                disabled={locked}
                aria-disabled={locked}
                aria-label={item.editLabel}
                className={EDIT_BUTTON}
              >
                עריכה
              </button>
            </div>
            <Accordion.Panel>
              <div className="space-y-2 text-[14px] leading-[20px]">{item.content}</div>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );
    return (
      <div className="space-y-3 px-4 py-4 text-right">
        {/* Alon 28.10: no big title per event ("גדולה מדי ועושה בלאגן") - each tickets row names its event. */}
        {accordion(ticketItems)}
        <div className="h-1 w-full border-b" />
        {accordion([flightItem, ...hotelItems])}
      </div>
    );
  }

  const section = (item: ReviewItem) => (
    <div key={item.id} className="relative">
      <button
        type="button"
        onClick={item.onEdit}
        disabled={locked}
        aria-disabled={locked}
        aria-label={item.editLabel}
        className={cn("absolute end-0 top-0", EDIT_BUTTON)}
      >
        עריכה
      </button>
      {item.content}
    </div>
  );

  // `text-right` is the live Review's: its pieces print hotel / airline names left to right and
  // lean on the inherited right alignment (a logical `text-start` would resolve to left in them).
  return (
    <div className="space-y-3 px-6 py-4 text-right">
      {ticketItems.map((item, i) => (
        <div key={item.id} className={cn(i > 0 && "border-t border-border pt-3")}>
          {section(item)}
        </div>
      ))}
      <div className="space-y-3 border-t border-border pt-3">
        {section(flightItem)}
        {hotelItems.map(section)}
      </div>
    </div>
  );
}

/** Where the price strip stands until every piece is picked: the running estimate, said to be one. */
function EstimateStrip({ total, perTraveller }: { total: number; perTraveller: number }) {
  return (
    <div dir="rtl" className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
      <div className="flex flex-col items-start font-bold">
        <span className="text-[22px]">סה&quot;כ</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">הערכה</span>
      </div>
      <div className="text-end">
        <div className="text-xl font-bold tabular-nums text-muted-foreground" dir="ltr">
          ${total.toLocaleString("en-US")}
        </div>
        <div className="text-lg font-semibold text-muted-foreground">
          (לאדם{" "}
          <span className="tabular-nums" dir="ltr">
            ${perTraveller.toLocaleString("en-US")}
          </span>
          )
        </div>
        <p className="m-0 text-xs text-muted-foreground">המחיר המדויק יופיע כשכל רכיבי הטיול ייבחרו.</p>
      </div>
    </div>
  );
}

/** The live summary's trust card: three promises, beside the travellers on a wider screen. */
function TrustCard() {
  return (
    <Card className="hidden overflow-hidden bg-card text-card-foreground shadow-lg md:block" dir="rtl">
      <div className="mx-auto space-y-6 bg-card p-4 text-start md:p-8">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex">
            <Image
              src="/icons/checkmark-wavey-circle.svg"
              alt=""
              width={24}
              height={24}
              className="mt-1 h-7 w-7"
              unoptimized
            />
            <div className="flex-1 ps-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground">{item.title}</h3>
              <p className="m-0 text-sm text-gray-500 dark:text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * The hold went through: the promise, the request's reference, the trip in one line. Replaces the
 * summary (its clock is gone with it - nothing is held by the page any more).
 */
function HoldConfirmation({ held }: { held: HeldAnswer }) {
  const { state, settings, travellers } = useItinerary();
  const { route, dates, pax } = state;
  const price = livePrice(state, settings);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      className={cn(PANEL, "mx-auto flex w-full max-w-xl flex-col items-center gap-3 py-10 text-center")}
      aria-labelledby="trip-held-title"
    >
      <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-primary" aria-hidden>
        <Check className="size-8" />
      </span>
      <h2 id="trip-held-title" ref={titleRef} tabIndex={-1} className="m-0 font-display text-2xl font-extrabold outline-none">
        קיבלנו את הבקשה
      </h2>
      <p className="m-0 text-base">{HELD_TEXT}</p>
      {held.reference && (
        <p className="m-0 text-sm text-muted-foreground">
          מספר הבקשה:{" "}
          <b dir="ltr" className="text-foreground">
            {held.reference}
          </b>
        </p>
      )}
      <p className="m-0 text-sm tabular-nums text-muted-foreground">
        {tripCities(route).join(" ← ")} · {dayMonth(dates.depart)}–{dayMonth(dates.ret)} ·{" "}
        {pax === 1 ? "נוסע אחד" : `${pax} נוסעים`}
        {price && (
          <>
            {" · "}
            <span dir="ltr">{money(price.total)}</span>
          </>
        )}
      </p>
      {/* Only when the server says the customer's email went out (`emailed`); otherwise - not sent,
          failed, or a retry's answer that cannot tell - the promise above is all that is said. */}
      {held.emailed === true && travellers.contact.email && (
        <p className="m-0 text-sm text-muted-foreground">
          פרטי הבקשה נשלחו גם למייל{" "}
          <bdi dir="ltr" className="text-foreground">
            {travellers.contact.email.trim()}
          </bdi>
          .
        </p>
      )}
      <Link
        href="/"
        className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-main px-6 text-sm font-bold text-main-foreground transition-colors hover:bg-main/90 dark:bg-glow dark:text-forest"
      >
        לדף הבית
      </Link>
    </section>
  );
}

/**
 * "Build Your Euro Trip" - the summary, in the live order summary's structure
 * (app/order/OrderReview.tsx, Alon: "לשמור על אותו מבנה שלנו"), built from its own pieces: the
 * summary card - the `bg-main` header "סיכום הזמנה" with the hold's clock, the live
 * `PriceSummary` (the party's total, per person, the trip's markup discount for the party), then
 * per event the live `EventSummary`, the flights (every leg with the live `FlightMeta`, a move the
 * customer makes alone as "הגעה עצמאית"), per stay the live `HotelSummary` - each with its
 * "עריכה"; the terms, the card logos and the buttons. Beside it the travellers' card and the
 * trust card. A row's figure is the picked piece against its estimate (`summaryAdditions`), so
 * the trip's estimate + the rows = the total. Until every piece is picked the strip shows the
 * running estimate, said to be one, and the rows no figure.
 *
 * "שמרו לי ל-24 שעות" checks the form with the regular summary's hold rules (the main contact)
 * and the terms, then sends the trip (`useTripHold` -> POST /api/itinerary/confirm, one group of
 * reservations): the buttons are off while it is on its way - and so is every way off the
 * summary (its "עריכה", the stepper, "עריכת המסלול") - a double click sends one request and a
 * retry the same group, even after the summary was left and opened again. Done: the
 * confirmation replaces the summary (`HoldConfirmation`) and the clock stops. Refused for something an earlier step fixes: that step, with the reason
 * as the notice. A server error: said here, with "נסו שוב" and the WhatsApp contact. Not offered
 * while the live kill switch is on (`NEXT_PUBLIC_DISABLE_24H_HOLD`). "לתשלום מאובטח" is drawn
 * only while payments are on (`settings.paymentsEnabled`) and there is an `onPay`. With neither,
 * the order flow's own contact card (WhatsApp) takes their place.
 *
 * The regular summary's 15-minute hold: the clock starts when the summary opens (not kept over a
 * refresh) - in the header, on a phone in the live `MobileHeader` band (one clock either way);
 * when it runs out every priced piece is released (`releaseHold` - tickets, flight, hotels; the
 * trip's shape, the travellers and the terms stay), nothing can be sent, and the live "הזמן אזל"
 * message offers "שננסה מחדש?" - back to the tickets, from event 1.
 */
export function SummaryStep({
  onPay,
}: {
  onPay?: (travellers: TravellersInput) => void | Promise<void>;
} = {}) {
  const api = useItinerary();
  const hold = useTripHold();
  const { state, settings, travellers, setTravellers, termsAccepted, setTermsAccepted, goStep, setActiveEvent, setActiveStay } =
    api;
  const { route, dates, pax, flight } = state;

  // The hold's clock (the live Timer, read only). Its effect lists the callback, so the callback
  // keeps its identity and reads the provider through a ref: the release changes the state,
  // and a new callback would run the elapsed check - and the release - again.
  const latest = useRef(api);
  useLayoutEffect(() => {
    latest.current = api;
  });
  const [expired, setExpired] = useState(false);
  const onElapsed = useCallback(() => {
    setExpired(true);
    latest.current.releaseHold();
  }, []);

  const form = useMemo(() => fitTravellers(travellers, pax), [travellers, pax]);
  const progress = canContinue(state);
  const price = livePrice(state, settings);
  // Until every piece is in: the running price - what is picked at its own price, the rest estimated.
  const estimate = progressivePrice(state, settings);
  const additions = summaryAdditions(state, settings);

  // The live rule for messages: a field's error shows once it was left, or the form was sent.
  // Typing checks the main contact fully and another traveller only where typed (hold); a pay
  // attempt asks for every name.
  const [mode, setMode] = useState<TravellersMode>(HOLD_ENABLED ? "hold" : "pay");
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [termsTouched, setTermsTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errors = useMemo(() => validateTravellers(form, pax, mode), [form, pax, mode]);
  const formRef = useRef<HTMLElement>(null);
  // A request is on its way: the buttons are off, and so is every way off the summary (its
  // "עריכה", "חסר כדי לסיים", "שננסה מחדש?" - the stepper and "עריכת המסלול" read the provider's
  // `holdSending`). The hold writes real reservations; its answer is read here.
  const sending = busy || hold.sending;

  // "Offer my trip to others" - only on a trip the customer built; it rides on the hold.
  const canSuggest = HOLD_ENABLED && state.mode === "custom";
  const [suggestOn, setSuggestOn] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const suggestion: TripSuggestion | null =
    canSuggest && suggestOn ? { title: cleanSuggestTitle(suggestTitle) || null } : null;
  const sendHold = (t: TravellersInput) => hold.submit(t, suggestion);
  // The regular summary's "רוצים לפצל תשלום? דברו עם נציג" (Alon's "פיצול הזמנה", Dor 28.10): the same
  // 24-hour hold, flagged so the rep arranges the split on the call.
  const sendSplitHold = (t: TravellersInput) => hold.submit(t, suggestion, true);

  const touch = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  // Moves the customer makes alone (no flight on them): the price leaves them out.
  const trainCount = useMemo(() => trainLegs(route, dates, new Set(state.train)).length, [route, dates, state.train]);

  const missing = [
    !progress.tickets && { label: "כרטיסים לכל האירועים", go: () => goStep("tickets") },
    !progress.flights && { label: "טיסה לכל המסלול", go: () => goStep("flights") },
    progress.flights && !progress.hotels && { label: "מלון בכל עיר", go: () => goStep("hotels") },
  ].filter((m): m is { label: string; go: () => void } => !!m);

  const payOpen = settings.paymentsEnabled && !!onPay;
  const contactOnly = !payOpen && !HOLD_ENABLED;
  const whatsAppText = `היי, אשמח להזמין טיול ${tripCities(route).join(" - ")} (${dayMonth(dates.depart)}-${dayMonth(
    dates.ret,
  )}) ל-${pax === 1 ? "נוסע אחד" : `${pax} נוסעים`}`;

  /** Sends the form for `next`: every message on screen, the first wrong field focused. */
  const attempt = async (next: TravellersMode, run?: (t: TravellersInput) => void | Promise<void>) => {
    if (expired) return;
    setStatus(null);
    setMode(next);
    const found = validateTravellers(form, pax, next);
    const keys = [
      ...(["firstName", "lastName", "email", "phone"] as const).map(contactKey),
      ...form.others.flatMap((_, row) => [otherKey(row, "firstName"), otherKey(row, "lastName")]),
    ];
    setTouched((prev) => new Set([...prev, ...keys.filter((k) => next === "pay" || k.startsWith("contact.") || k in found)]));
    setTermsTouched(true);
    const firstWrong = keys.find((k) => k in found);
    if (firstWrong) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(fieldId(firstWrong))?.focus({ preventScroll: true });
      return;
    }
    if (!termsAccepted) {
      document.getElementById("trip-terms")?.focus();
      return;
    }
    if (!price) {
      setStatus("השלימו קודם את כל רכיבי הטיול.");
      return;
    }
    if (!run) {
      setStatus(PAY_PENDING);
      return;
    }
    setBusy(true);
    try {
      await run(form);
    } finally {
      setBusy(false);
    }
  };

  const openStay = (i: number) => {
    if (sending) return;
    setActiveStay(i);
    goStep("hotels");
  };
  const openEvent = (i: number) => {
    if (sending) return;
    setActiveEvent(i);
    goStep("tickets");
  };
  const openFlights = () => {
    if (!sending) goStep("flights");
  };

  // Held: the request is with sales - the confirmation, no form, no clock.
  if (api.held) return <HoldConfirmation held={api.held} />;

  // The trip's first and last flight (the live header prints them on a phone in place of the clock).
  const firstLeg = flight?.legs?.[0] ?? flight?.outbound;
  const lastLeg = flight?.legs?.length ? flight.legs[flight.legs.length - 1] : flight?.inbound;

  const holdButton = HOLD_ENABLED && (
    <button
      type="button"
      disabled={sending || expired}
      aria-busy={hold.sending}
      onClick={() => attempt("hold", sendHold)}
      className={payOpen ? SECOND_BUTTON : MAIN_BUTTON}
    >
      {hold.sending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          שומרים את הטיול...
        </>
      ) : (
        "שמרו לי ל-24 שעות"
      )}
    </button>
  );

  // The live summary's outline look (app/order/OrderReview.tsx): two short lines, the question first.
  const splitButton = HOLD_ENABLED && (
    <button
      type="button"
      disabled={sending || expired}
      onClick={() => attempt("hold", sendSplitHold)}
      aria-label="רוצים לפצל תשלום? דברו עם נציג - שמירת הטיול ל-24 שעות ונציג יחזור אליכם"
      className="flex min-h-[52px] w-full flex-col items-center justify-center rounded-md border border-primary px-3 py-1.5 text-[14px] font-semibold leading-tight text-success transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
    >
      <span>רוצים לפצל תשלום?</span>
      <span>דברו עם נציג</span>
    </button>
  );

  // Terms, card logos, the buttons and what they answer. Under the summary on a wider screen; on a
  // phone after the travellers (the live summary's order: the form is filled before the button).
  const actions = (
    <div className="flex flex-col gap-3">
      <div className="mb-2 ms-2 mt-4 flex flex-col text-start" dir="rtl">
        <div className="flex items-center justify-center gap-2">
          <Checkbox
            id="trip-terms"
            checked={termsAccepted}
            aria-invalid={termsTouched && !termsAccepted}
            aria-describedby={termsTouched && !termsAccepted ? "trip-terms-error" : undefined}
            onCheckedChange={(checked) => {
              setTermsAccepted(checked === true);
              setTermsTouched(true);
            }}
          />
          <div className="flex flex-wrap items-center">
            <Label htmlFor="trip-terms" className="text-base">
              אני מאשר/ת שקראתי את
            </Label>
            <Link
              href="/cancellation"
              target="_blank"
              rel="noopener"
              className="ms-1 text-base font-semibold text-foreground underline underline-offset-2 hover:text-primary"
            >
              התנאים ומדיניות הביטולים
            </Link>
          </div>
        </div>
        {termsTouched && !termsAccepted && (
          <p id="trip-terms-error" role="alert" className="m-0 mt-1 text-center text-sm text-red-500">
            {TERMS_ERROR}
          </p>
        )}
      </div>

      <PaymentLogos className="my-4" />

      {payOpen && (
        <button type="button" disabled={sending || expired} onClick={() => attempt("pay", onPay)} className={MAIN_BUTTON}>
          <Lock className="size-4" aria-hidden />
          לתשלום מאובטח
        </button>
      )}
      {holdButton}
      {splitButton}
      {HOLD_ENABLED && (
        <p className="m-0 text-center text-xs text-muted-foreground">
          {payOpen
            ? "שומרים את המחיר ל-24 שעות, נציג יחזור אליכם."
            : "התשלום באתר ייפתח בקרוב. בינתיים שומרים את הטיול ל-24 שעות ונציג יחזור אליכם."}
        </p>
      )}
      {contactOnly && (
        <OrderIssueState
          className="py-6"
          title="רוצים לסגור את הטיול?"
          subtitle="התשלום באתר ייפתח בקרוב. כתבו לנו ונציג ישלים איתכם את ההזמנה."
          whatsAppText={whatsAppText}
        />
      )}
      <p role="status" aria-live="polite" className={cn("m-0 text-center text-sm font-semibold", !status && "sr-only")}>
        {status ?? ""}
      </p>
      {/* The hold was not saved (the server's error, no answer): try again - the same group - or write to us. */}
      {hold.failure?.code === "SERVER_ERROR" ? (
        <OrderIssueState
          variant="error"
          className="py-6"
          title="לא הצלחנו לשמור את הטיול"
          subtitle="נסו שוב בעוד רגע, או כתבו לנו ונשמור אותו עבורכם."
          onRetry={sending ? undefined : () => attempt("hold", sendHold)}
          whatsAppText={whatsAppText}
        />
      ) : hold.failure?.code === "PRICE_CHANGED" ? (
        // The price changed again after a re-price on fresh rows: a refresh (the page's
        // settings are read at render) or the WhatsApp contact - no second bounce.
        <OrderIssueState
          variant="error"
          className="py-6"
          title={hold.failure.message}
          onRetry={() => window.location.reload()}
          retryLabel="רענון הדף"
          whatsAppText={whatsAppText}
        />
      ) : (
        hold.failure && (
          <p
            role="alert"
            className="m-0 rounded-xl border border-badge-urgent/40 bg-badge-urgent/10 px-4 py-3 text-sm font-semibold text-foreground"
          >
            {hold.failure.message}
          </p>
        )
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* The live phone band (MobileHeader): the hold's clock. One clock on the page - the
          header's is not drawn on a phone. */}
      {isMobile && (
        <div className="-mx-4 -mt-1 lg:-mx-6">
          <MobileHeader handleTimeout={onElapsed} saving={0} skipHotel={false} />
        </div>
      )}

      {/* "הזמן אזל" - the live summary's words. Not dismissable: the pieces are already released. */}
      <Dialog open={expired}>
        <DialogContent
          dir="rtl"
          className="max-w-sm rounded-2xl text-center [&>button]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="mx-auto mt-2 flex size-16 items-center justify-center rounded-2xl bg-accent text-primary" aria-hidden>
            <Plane className="size-8" />
          </div>
          <DialogTitle className="text-center font-display text-lg font-bold">הזמן אזל</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            לצערנו היינו חייבים לשחרר את ההזמנה
          </DialogDescription>
          {/* Wrapped: the dialog's own close button (a direct child) is hidden by `[&>button]`. */}
          <div>
            <button
              type="button"
              disabled={sending}
              aria-disabled={sending}
              onClick={() => {
                if (sending) return;
                // From event 1 (the release already opened it - said here too, whatever came after).
                setActiveEvent(0);
                goStep("tickets");
              }}
              className="h-11 w-full rounded-md bg-secondary text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              שננסה מחדש?
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto w-full max-w-[1200px] py-3 lg:px-6">
        {missing.length > 0 && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-badge-vip/60 bg-badge-vip/20 px-4 py-3 text-sm font-semibold text-foreground"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            <span>חסר כדי לסיים:</span>
            {missing.map((m) => (
              <button
                key={m.label}
                type="button"
                disabled={sending}
                aria-disabled={sending}
                onClick={m.go}
                className="text-forest underline decoration-forest/40 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-glow dark:decoration-glow/40"
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid items-start gap-4 md:grid-cols-2">
          {/* The summary: first on a phone, the left column (RTL) from md. */}
          <div className="order-1 space-y-4 md:order-2">
            <Card className="overflow-hidden bg-card text-card-foreground shadow-lg">
              <div dir="rtl" className="flex flex-row items-center justify-between bg-main px-6 py-4 text-main-foreground">
                <h2 className="text-start text-2xl font-bold">סיכום הזמנה</h2>
                {!isMobile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">ההזמנה שמורה עבורך למשך</span>
                    <span dir="ltr">
                      <Timer onTimeElapsed={onElapsed} duration={SUMMARY_HOLD_SECONDS} />
                    </span>
                    <span className="text-sm">דקות</span>
                  </div>
                ) : (
                  <div className="mt-[4px] flex items-center gap-1 text-sm" dir="ltr">
                    <div>{fullDate(firstLeg?.departureTime ?? dates.depart)}</div>
                    <div>-</div>
                    <div>{fullDate(lastLeg?.departureTime ?? dates.ret)}</div>
                  </div>
                )}
              </div>
              {price ? (
                <PriceSummary
                  finalPurchasePrice={price.total}
                  finalPurchasePriceILS={0}
                  recommendedPriceAllPax={0}
                  numberOfPersons={pax}
                  agentCommission={0}
                  affDiscount={Math.round(price.discount * pax)}
                  isNumberOfPersonsEqual={false}
                />
              ) : (
                <EstimateStrip total={estimate.total} perTraveller={estimate.perTraveller} />
              )}
              {trainCount > 0 && (
                <p className="m-0 border-b border-border px-6 py-2 text-xs text-muted-foreground">
                  הגעה עצמאית בין הערים לא כלולה במחיר.
                </p>
              )}
              {/* Alon 28.10: the route first, every edit under it. */}
              <TripRoute />
              <TripReview
                additions={additions}
                locked={sending}
                onEditEvent={openEvent}
                onEditFlights={openFlights}
                onEditStay={openStay}
              />
            </Card>
            {!isMobile && actions}
          </div>

          {/* The travellers: the right column (RTL) from md, under the summary on a phone. */}
          <div className="order-2 space-y-6 md:order-1">
            <Card className="overflow-hidden bg-card text-card-foreground shadow-lg">
              <div className="px-8 pb-8 pt-6">
                <TravellersForm
                  value={form}
                  errors={errors}
                  touched={touched}
                  othersRequired={mode === "pay"}
                  onChange={setTravellers}
                  onTouch={touch}
                  formRef={formRef}
                />
              </div>
            </Card>
            {canSuggest && (
              <SuggestTripCard
                on={suggestOn}
                title={suggestTitle}
                disabled={sending || expired}
                onToggle={setSuggestOn}
                onTitle={setSuggestTitle}
              />
            )}
            {isMobile && actions}
            <TrustCard />
          </div>
        </div>
      </div>
    </div>
  );
}
