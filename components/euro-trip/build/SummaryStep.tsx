"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BedDouble, CircleAlert, Lock, Plane, TrainFront } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Event, FlightSegment, ItineraryFlight, OrderHotel } from "@/lib/app.types";
import { eventCityName } from "@/lib/events/lodging";
import { roomsLabel } from "@/lib/events/readyPackage";
import { rateRoomName } from "@/lib/hotels/roomName";
import { dayMonth, dayMonthYear, stayCityName } from "@/lib/itinerary/builder";
import { moves, stays, trainLegs, tripLegs } from "@/lib/itinerary/dates";
import { cardRows } from "@/lib/itinerary/flightsView";
import { dayDiff, eventDay } from "@/lib/itinerary/geo";
import { estimateItinerary } from "@/lib/itinerary/price";
import { canContinue, livePrice } from "@/lib/itinerary/progress";
import { stayHotelReady, stayRanges } from "@/lib/itinerary/stayAdapter";
import {
  contactKey,
  fitTravellers,
  otherKey,
  validateTravellers,
  type TravellersInput,
  type TravellersMode,
} from "@/lib/itinerary/travellers";
import type { TrainLeg } from "@/lib/itinerary/types";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { TravellersForm, fieldId } from "./TravellersForm";
import { TripEventArt } from "./TripEventArt";
import { PANEL, PanelTitle, nightsLabel } from "./parts";

/** "$2,133" / "$617.50" - whole dollars unless there are cents. */
const money = (n: number): string => {
  const v = Math.round(n * 100) / 100;
  const cents = Number.isInteger(v) ? 0 : 2;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: 2 })}`;
};

/** "05:40" from a segment's local time. */
const hhmm = (iso: string): string => iso.slice(11, 16);

const legStops = (leg: FlightSegment): string => {
  const n = leg.stops?.length ?? 0;
  return n === 0 ? "ישירה" : n === 1 ? "עצירה אחת" : `${n} עצירות`;
};

/** The words of a hold attempt's terms error - the regular summary's. */
const TERMS_ERROR = "יש לאשר את פרטי ההזמנה ותנאי השימוש";
/** Task A15 builds the hold; until then the button says so. */
const HOLD_PENDING = "שמירה תתווסף בשלב הבא";

/** A quiet "שינוי" that takes the customer back to the step. */
function EditLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 text-sm font-semibold text-forest underline decoration-forest/40 underline-offset-2 transition-opacity hover:opacity-80 dark:text-glow dark:decoration-glow/40"
    >
      שינוי
    </button>
  );
}

/** A panel's row: an icon (or art), a title and a muted line. */
function Row({ lead, title, detail, extra }: { lead: ReactNode; title: ReactNode; detail: ReactNode; extra?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-1">
      {lead}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold leading-snug">{title}</span>
        <span className="text-[13.5px] tabular-nums text-muted-foreground">{detail}</span>
        {extra}
      </div>
    </li>
  );
}

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "train" }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        tone === "train" ? "bg-brand-aqua text-black" : "bg-muted text-foreground",
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

function PanelHead({ title, edit }: { title: string; edit?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <PanelTitle>{title}</PanelTitle>
      {edit}
    </div>
  );
}

/** The route's events: art, "1. name", the day, the city, the category × the party. */
function EventsPanel({ route, onEdit }: { route: Event[]; onEdit: (i: number) => void }) {
  const { state } = useItinerary();
  return (
    <section className={PANEL} aria-label="האירועים">
      <PanelHead title="האירועים" />
      <ol className="m-0 list-none p-0">
        {route.map((e, i) => {
          const t = state.tickets[e.id];
          return (
            <Row
              key={e.id}
              lead={
                <TripEventArt
                  event={e}
                  sizes="48px"
                  className="size-12 shrink-0 rounded-full border-2 border-white shadow-sm"
                />
              }
              title={`${i + 1}. ${e.name}`}
              detail={
                <>
                  {dayMonthYear(eventDay(e))} · {eventCityName(e)} ·{" "}
                  {t?.id ? `${t.zoneLabel || t.category} × ${t.quantity}` : "עוד לא נבחר כרטיס"}
                </>
              }
              extra={
                <span className="mt-0.5">
                  <EditLink onClick={() => onEdit(i)} label={`שינוי הכרטיסים ל${e.name}`} />
                </span>
              }
            />
          );
        })}
      </ol>
    </section>
  );
}

/** Every leg in trip order: a flight row, or a move by train - the customer's own, not included. */
function FlightsPanel({ flight, onEdit }: { flight: ItineraryFlight | null; onEdit: () => void }) {
  const { state } = useItinerary();
  const { route, dates, train } = state;
  const trainSet = useMemo(() => new Set(train), [train]);
  const rows = useMemo(
    () => (flight ? cardRows(tripLegs(route, dates, new Set()), flight.legs ?? [], trainSet) : []),
    [flight, route, dates, trainSet],
  );
  const hops = useMemo(
    () => new Map(trainLegs(route, dates, trainSet).map((t): [string, TrainLeg] => [t.key, t])),
    [route, dates, trainSet],
  );
  const airline = flight?.metadata?.name || flight?.airline || "";

  return (
    <section className={PANEL} aria-label="טיסות">
      <PanelHead title="טיסות" edit={<EditLink onClick={onEdit} label="שינוי הטיסה" />} />
      {!flight ? (
        <p className="m-0 py-2 text-sm text-muted-foreground">עוד לא נבחרה טיסה.</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {rows.map((row, i) => {
            if (row.kind === "train") {
              const hop = hops.get(row.key);
              if (!hop) return null;
              return (
                <Row
                  key={`train-${row.key}`}
                  lead={
                    <Chip tone="train">
                      <TrainFront className="size-5" />
                    </Chip>
                  }
                  title={`${hop.fromName} ← ${hop.toName}`}
                  detail={`${dayMonth(hop.date)} · ברכבת - בכוחות עצמכם, לא כלול`}
                />
              );
            }
            const leg = row.leg;
            return (
              <Row
                key={`leg-${i}`}
                lead={
                  <Chip>
                    <Plane className="size-5" />
                  </Chip>
                }
                title={
                  <>
                    {/* Drawn left to right so the arrow points at the destination, as the
                        Hebrew rows read; said in words to a screen reader. */}
                    <span dir="ltr" className="inline-block" aria-hidden>
                      {leg.arrivalAirport} ← {leg.departureAirport}
                    </span>
                    <span className="sr-only">
                      מ-{leg.departureAirport} ל-{leg.arrivalAirport}
                    </span>
                  </>
                }
                detail={
                  <>
                    {dayMonth(leg.departureTime.slice(0, 10))} ·{" "}
                    <span dir="ltr">
                      {hhmm(leg.departureTime)}–{hhmm(leg.arrivalTime)}
                    </span>{" "}
                    · {legStops(leg)}
                    {airline ? ` · ${airline}` : ""}
                    {leg.flightNumber ? (
                      <>
                        {" "}
                        · <span dir="ltr">{leg.flightNumber}</span>
                      </>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** The room the order bought: an own-stock hotel names it, a live rate carries it. */
const roomOf = (h: OrderHotel): string =>
  h.isOffline ? h.hotelInformation?.roomName ?? "" : rateRoomName(h.rate, h.hotelInformation?.roomName ?? "");

/** One hotel per stay: its name, the city, its own dates and nights, stars, its rooms. */
function HotelsPanel({ onEdit }: { onEdit: (i: number) => void }) {
  const { state } = useItinerary();
  const { route, dates, flight, pax } = state;
  const list = useMemo(() => stays(route, dates), [route, dates]);
  const ranges = useMemo(() => stayRanges(route, dates, flight, new Set(state.train)), [route, dates, flight, state.train]);

  return (
    <section className={PANEL} aria-label="מלונות">
      <PanelHead title="מלונות" />
      <ol className="m-0 list-none p-0">
        {list.map((stay, i) => {
          const h = state.hotels[stay.key];
          const city = stayCityName(stay.events[0]);
          const ready = stayHotelReady(h, ranges[i], pax);
          if (!h || !ready) {
            return (
              <Row
                key={stay.key}
                lead={
                  <Chip>
                    <BedDouble className="size-5" />
                  </Chip>
                }
                title={`מלון ב${city}`}
                detail="עוד לא נבחר מלון ללינה הזו"
                extra={
                  <span className="mt-0.5">
                    <EditLink onClick={() => onEdit(i)} label={`בחירת מלון ב${city}`} />
                  </span>
                }
              />
            );
          }
          const nights = dayDiff(h.checkin.slice(0, 10), h.checkout.slice(0, 10));
          const stars = Math.max(0, Math.min(5, Math.round(Number(h.hotelInformation?.stars) || 0)));
          const room = roomOf(h);
          const rooms = roomsLabel(h.guests);
          return (
            <Row
              key={stay.key}
              lead={
                <Chip>
                  <BedDouble className="size-5" />
                </Chip>
              }
              title={
                <bdi dir="ltr" className="inline-block">
                  {h.name}
                </bdi>
              }
              detail={
                <>
                  {city} · {dayMonth(h.checkin.slice(0, 10))}–{dayMonth(h.checkout.slice(0, 10))} ·{" "}
                  {Number.isFinite(nights) ? nightsLabel(nights) : ""}
                  {stars > 0 && (
                    <>
                      {" · "}
                      <span aria-label={`${stars} כוכבים`}>{"★".repeat(stars)}</span>
                    </>
                  )}
                </>
              }
              extra={
                <span className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted-foreground">
                  {(room || rooms) && (
                    <span>
                      {room && <bdi dir="ltr">{room}</bdi>}
                      {room && rooms ? " · " : ""}
                      {rooms}
                    </span>
                  )}
                  <EditLink onClick={() => onEdit(i)} label={`שינוי המלון ב${city}`} />
                </span>
              }
            />
          );
        })}
      </ol>
    </section>
  );
}

function PriceLine({ label, value, tone }: { label: ReactNode; value: string; tone?: "save" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-[15px]", tone === "save" && "font-extrabold text-forest dark:text-glow")}>
      <span>{label}</span>
      <span dir="ltr" className="font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * "Build Your Euro Trip" - the summary: the route's events, its flights (a move by train
 * marked as the customer's own), a hotel per stay, the travellers' form and terms, and the
 * price box - the live price per traveller (`livePrice`: tickets, flight, hotels, the full
 * service and the trip's "הנחת מסלול") and for the party. Until every piece is picked the box
 * shows the estimate, said to be one.
 *
 * "שמרו לי ל-24 שעות" checks the form with the regular summary's hold rules (the main contact)
 * and the terms, then hands the travellers to `onHold` (the hold itself is Task A15). "לתשלום
 * מאובטח" stays off - "בקרוב" - while payments are off (`settings.paymentsEnabled`) or there is
 * no `onPay` yet.
 */
export function SummaryStep({
  onHold,
  onPay,
}: {
  onHold?: (travellers: TravellersInput) => void | Promise<void>;
  onPay?: (travellers: TravellersInput) => void | Promise<void>;
} = {}) {
  const { state, settings, travellers, setTravellers, termsAccepted, setTermsAccepted, goStep, setActiveEvent, setActiveStay } =
    useItinerary();
  const { route, dates, pax, flight } = state;

  const form = useMemo(() => fitTravellers(travellers, pax), [travellers, pax]);
  const progress = canContinue(state);
  const price = livePrice(state, settings);
  const estimate = useMemo(() => estimateItinerary(route, dates, settings, null), [route, dates, settings]);

  // The live rule for messages: a field's error shows once it was left, or the form was sent.
  // Typing checks the main contact fully and another traveller only where typed (hold); a pay
  // attempt asks for every name.
  const [mode, setMode] = useState<TravellersMode>("hold");
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [termsTouched, setTermsTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errors = useMemo(() => validateTravellers(form, pax, mode), [form, pax, mode]);
  const formRef = useRef<HTMLElement>(null);

  const touch = (key: string) =>
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  const flown = flight?.legs?.length ?? 0;
  const hotelNights = stays(route, dates).reduce((sum, stay) => {
    const h = state.hotels[stay.key];
    const n = h ? dayDiff(h.checkin.slice(0, 10), h.checkout.slice(0, 10)) : Number.NaN;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const trainCount = state.train.filter((k) => moves(route).some((m) => m.key === k)).length;

  const missing = [
    !progress.tickets && { label: "כרטיסים לכל האירועים", go: () => goStep("tickets") },
    !progress.flights && { label: "טיסה לכל המסלול", go: () => goStep("flights") },
    progress.flights && !progress.hotels && { label: "מלון בכל עיר", go: () => goStep("hotels") },
  ].filter((m): m is { label: string; go: () => void } => !!m);

  const payOpen = settings.paymentsEnabled && !!onPay;

  /** Sends the form for `next`: every message on screen, the first wrong field focused. */
  const attempt = async (next: TravellersMode, run?: (t: TravellersInput) => void | Promise<void>) => {
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
      setStatus(HOLD_PENDING);
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
    setActiveStay(i);
    goStep("hotels");
  };
  const openEvent = (i: number) => {
    setActiveEvent(i);
    goStep("tickets");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[15px]">
          כמעט שם. <b>בדקו את המסלול</b> ומלאו את פרטי הנוסעים.
        </p>
        {/* On a phone the price box comes after the form - its figure up here too. */}
        <p className="m-0 text-sm font-bold lg:hidden">
          {price ? "סה״כ לנוסע" : "הערכה לנוסע"}{" "}
          <span dir="ltr" className="tabular-nums text-forest dark:text-glow">
            {money(price ? price.perTraveller : estimate.perTraveller)}
          </span>
        </p>
      </div>

      {missing.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-badge-vip/60 bg-badge-vip/20 px-4 py-3 text-sm font-semibold text-foreground"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span>חסר כדי לסיים:</span>
          {missing.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={m.go}
              className="text-forest underline decoration-forest/40 underline-offset-2 dark:text-glow dark:decoration-glow/40"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <EventsPanel route={route} onEdit={openEvent} />
          <FlightsPanel flight={flight} onEdit={() => goStep("flights")} />
          <HotelsPanel onEdit={openStay} />
          <div className={PANEL}>
            <TravellersForm
              value={form}
              errors={errors}
              touched={touched}
              onChange={setTravellers}
              onTouch={touch}
              formRef={formRef}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="המחיר">
          <section className={PANEL} aria-labelledby="trip-price-title">
            <h2 id="trip-price-title" className="sr-only">
              המחיר
            </h2>
            {price ? (
              <>
                <PriceLine
                  label={`כרטיסים · ${route.length === 1 ? "אירוע אחד" : `${route.length} אירועים`}`}
                  value={money(price.tickets)}
                />
                <PriceLine label={`טיסות · ${flown === 1 ? "טיסה אחת" : `${flown} טיסות`}`} value={money(price.flight)} />
                <PriceLine label={`מלונות · ${nightsLabel(hotelNights)}`} value={money(price.hotels)} />
                <PriceLine label="שירות" value={money(price.service)} />
                {price.discount > 0 && <PriceLine label="הנחת מסלול" value={`−${money(price.discount)}`} tone="save" />}
                <div className="mt-2 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <span className="text-[15px] font-bold">סה״כ לנוסע</span>
                  <span dir="ltr" className="text-3xl font-extrabold tabular-nums text-forest dark:text-glow">
                    {money(price.perTraveller)}
                  </span>
                </div>
                <PriceLine
                  label={<span className="text-muted-foreground">{pax === 1 ? "סה״כ לנוסע אחד" : `סה״כ ל-${pax} נוסעים`}</span>}
                  value={money(price.total)}
                />
                {trainCount > 0 && (
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    {trainCount === 1 ? "הרכבת" : "הרכבות"} בין הערים לא {trainCount === 1 ? "כלולה" : "כלולות"} במחיר.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[15px] font-bold">
                    סה״כ לנוסע{" "}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">הערכה</span>
                  </span>
                  <span dir="ltr" className="text-3xl font-extrabold tabular-nums text-muted-foreground">
                    {money(estimate.perTraveller)}
                  </span>
                </div>
                <PriceLine
                  label={<span className="text-muted-foreground">{pax === 1 ? "סה״כ לנוסע אחד" : `סה״כ ל-${pax} נוסעים`}</span>}
                  value={money(estimate.perTraveller * pax)}
                />
                <p className="m-0 mt-1 text-xs text-muted-foreground">המחיר המדויק יופיע כשכל רכיבי הטיול ייבחרו.</p>
              </>
            )}
          </section>

          <section className={cn(PANEL, "flex flex-col gap-3")} aria-label="אישור ושמירה">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
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
                <Label htmlFor="trip-terms" className="text-sm leading-snug">
                  אני מאשר/ת שקראתי את{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener"
                    className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    התנאים ומדיניות הביטולים
                  </Link>
                </Label>
              </div>
              {termsTouched && !termsAccepted && (
                <p id="trip-terms-error" role="alert" className="m-0 text-sm text-red-500">
                  {TERMS_ERROR}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!payOpen || busy}
              onClick={() => attempt("pay", onPay)}
              className="relative flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-main text-[17px] font-bold text-main-foreground transition-colors hover:bg-main/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground dark:bg-glow dark:text-forest dark:hover:bg-glow/90 dark:disabled:bg-muted dark:disabled:text-muted-foreground"
            >
              <Lock className="size-4" aria-hidden />
              לתשלום מאובטח
              {!payOpen && (
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-bold text-foreground">בקרוב</span>
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => attempt("hold", onHold)}
              className="flex h-[52px] w-full items-center justify-center rounded-md border border-primary text-[15px] font-bold text-success transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              שמרו לי ל-24 שעות
            </button>
            <p className="m-0 text-center text-xs text-muted-foreground">
              {payOpen ? "שומרים את המחיר ל-24 שעות, נציג יחזור אליכם." : "התשלום באתר ייפתח בקרוב. בינתיים שומרים את הטיול ל-24 שעות ונציג יחזור אליכם."}
            </p>
            <p role="status" aria-live="polite" className={cn("m-0 text-center text-sm font-semibold", !status && "sr-only")}>
              {status ?? ""}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
