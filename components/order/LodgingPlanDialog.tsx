"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Popover } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import { AlertTriangle } from "lucide-react";
import type { Event } from "@/lib/app.types";
import RoomsAndGuestsInput from "@/components/ui/roomsAndGuestsInput";
import { DateRange } from "@/components/ui/dateInput";
import { NightStrip } from "@/components/order/NightStrip";
import { getMinTravelDate } from "@/lib/getDefaultDateRange";
import {
  allNights,
  cityName,
  defaultCity,
  defaultSplit,
  NightAssign,
  nightsBetween,
  refitNights,
  segmentsFromNights,
  splitOffered,
} from "@/lib/events/lodging";

export type RoomParams = { adults: number; children: number[] }[];

/** What the customer decided in the popup - the hotel step searches exactly this. */
export type LodgingPlan = {
  dateRange: [Date, Date];
  rooms: RoomParams;
  /** One entry per hotel night; 2+ cities in a row = a split stay. */
  nights: NightAssign[];
};

const MAX_NIGHTS = 14;
const iso = (d: Date) => dayjs(d).format("YYYY-MM-DD");
const toDate = (s: string) => new Date(s + "T00:00:00");
const short = (s: string) => dayjs(s).format("DD.MM");
const sameNights = (a: NightAssign[], b: NightAssign[]) =>
  a.length === b.length && a.every((n, i) => n.date === b[i].date && n.city === b[i].city);

/**
 * "איפה ישנים?" - opens once on entering the hotel step of a two-city event
 * (Dor, 25.09), and again from "שנה חלוקה" above the hotel list. One decision
 * before ONE search. The top row is the hotel step's own search bar ("כמה
 * תהיו? / ובאיזה תאריכים?" - Alon 25.09: the ± steppers ran away from our UI),
 * with a loud note when the hotel dates leave the flight's (the flight never
 * moves). Below, the night squares alone lay out the stay - a tap flips a
 * night's city (no split / one-city buttons any more). "מצא לי מלון" searches,
 * "לא צריך מלון" skips the hotel.
 */
export const LodgingPlanDialog = ({
  opened,
  event,
  flightDates,
  hasFlight,
  initialDateRange,
  initialRooms,
  initialNights,
  onConfirm,
  onCancel,
  onSkipHotel,
}: {
  opened: boolean;
  event: Event;
  /** The hotel dates the flight implies (getDefaultDateRange) - the reference. */
  flightDates: [Date, Date];
  hasFlight: boolean;
  initialDateRange: [Date | null, Date | null];
  initialRooms: RoomParams;
  /** Reopened from "שנה חלוקה": the stay as it is laid out now. */
  initialNights?: NightAssign[] | null;
  onConfirm: (plan: LodgingPlan) => void;
  /** Set when reopened: closing then changes nothing. First open: closing = continuing. */
  onCancel?: () => void;
  onSkipHotel?: () => void;
}) => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const canSplit = splitOffered(event);
  const flightCity = cityName(event, "flight");
  const eventCity = cityName(event, "event");
  const flightIn = iso(flightDates[0]);
  const flightOut = iso(flightDates[1]);
  const minIn = iso(getMinTravelDate());

  const [checkin, setCheckin] = useState(flightIn);
  const [checkout, setCheckout] = useState(flightOut);
  // The picker's own value - half a range while the customer is choosing.
  const [range, setRange] = useState<[Date | null, Date | null]>([
    toDate(flightIn),
    toDate(flightOut),
  ]);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomParams>(initialRooms);
  const [nights, setNights] = useState<NightAssign[]>([]);

  // Re-seed on every open: the step's current dates and rooms; the stay as
  // laid out now when reopened, else the recommended split (or the default city).
  useEffect(() => {
    if (!opened) return;
    const ci = initialDateRange[0] ? iso(initialDateRange[0]) : flightIn;
    const co = initialDateRange[1] ? iso(initialDateRange[1]) : flightOut;
    setCheckin(ci);
    setCheckout(co);
    setRange([toDate(ci), toDate(co)]);
    setRangeNote(null);
    setRooms(initialRooms);
    setNights(
      initialNights?.length
        ? refitNights(initialNights, ci, co)
        : canSplit
          ? defaultSplit(event, ci, co)
          : allNights(refitNights([], ci, co), defaultCity(event))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const nightCount = nightsBetween(checkin, checkout).length;
  const datesDiffer = checkin !== flightIn || checkout !== flightOut;
  const recommended = useMemo(
    () => defaultSplit(event, checkin, checkout),
    [event, checkin, checkout]
  );
  const isRecommended = canSplit && sameNights(nights, recommended);
  const segments = segmentsFromNights(nights);
  const guests = rooms.reduce((n, r) => n + r.adults + r.children.length, 0);

  // A stay still laid out as recommended follows the recommendation to the
  // new dates; one the customer shaped keeps each night's city (refit).
  const setDates = (ci: string, co: string) => {
    setCheckin(ci);
    setCheckout(co);
    setRange([toDate(ci), toDate(co)]);
    setNights(
      isRecommended ? defaultSplit(event, ci, co) : refitNights(nights, ci, co)
    );
  };

  // A full range from the picker lands at once; half a range waits for the
  // popover to close, then snaps back to the last whole one.
  const onPick = (value: [Date | null, Date | null]) => {
    setRange(value);
    if (!value[0] || !value[1]) return;
    const ci = iso(value[0]);
    const co = iso(value[1]);
    const count = nightsBetween(ci, co).length;
    if (ci < minIn || count < 1) return;
    if (count > MAX_NIGHTS) {
      setRangeNote(`אפשר עד ${MAX_NIGHTS} לילות.`);
      setRange([toDate(checkin), toDate(checkout)]);
      return;
    }
    setRangeNote(null);
    setDates(ci, co);
  };
  const onPickerClose = () => {
    if (!range[0] || !range[1] || iso(range[0]) !== checkin || iso(range[1]) !== checkout) {
      setRange([toDate(checkin), toDate(checkout)]);
    }
  };

  // One-city events (lodging "choice"): a tap moves the whole stay.
  const onNights = (next: NightAssign[]) => {
    if (canSplit) {
      setNights(next);
      return;
    }
    const flipped = next.find((n, i) => n.city !== nights[i]?.city)?.city;
    setNights(flipped ? allNights(next, flipped) : next);
  };

  const confirm = () => {
    if (!nights.length) return;
    onConfirm({ dateRange: [toDate(checkin), toDate(checkout)], rooms, nights });
  };

  const label = "whitespace-nowrap text-[15px]";

  return (
    <Modal
      opened={opened}
      onClose={onCancel ?? confirm}
      title="איפה ישנים?"
      centered
      size="lg"
      fullScreen={!isDesktop}
      closeOnClickOutside={false}
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <p className="text-[13px] text-muted-foreground">
          {`המשחק ב${eventCity}, הטיסה ל${flightCity}. בחרו איפה לישון ונמצא לכם את המלונות.`}
        </p>

        {/* Guests + dates - the hotel step's own search bar */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-3">
            <span className={label}>כמה תהיו?</span>
            <Popover width={300} trapFocus position="bottom" shadow="md" keepMounted={false}>
              <Popover.Target>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-[1rem]"
                >
                  {`${guests} אורחים`}
                  {rooms.length > 1 && ` | ${rooms.length} חדרים`}
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="flex flex-col gap-2" dir="rtl">
                  {rooms.map((r, i) => (
                    <div key={`${i}_${r.adults}_${r.children.length}`}>
                      {i > 0 && (
                        <button
                          type="button"
                          className="w-full px-2 text-right text-destructive"
                          onClick={() =>
                            setRooms((prev) =>
                              prev.length === 1 ? prev : prev.filter((_, j) => j !== i)
                            )
                          }
                          aria-label={`מחק חדר ${i + 1}`}
                        >
                          מחק חדר
                        </button>
                      )}
                      <RoomsAndGuestsInput
                        initialAdults={r.adults}
                        initialChildren={r.children}
                        onChange={({ adults, children }) =>
                          setRooms((prev) =>
                            prev.map((room, j) => (j === i ? { adults, children } : room))
                          )
                        }
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="px-2 text-left text-success"
                    onClick={() => setRooms((prev) => [...prev, { adults: 1, children: [] }])}
                    aria-label="הוסף חדר נוסף"
                  >
                    +הוסף חדר
                  </button>
                </div>
              </Popover.Dropdown>
            </Popover>
            <span className={`${label} lg:mr-3`}>ובאיזה תאריכים?</span>
            <div className="w-[190px]">
              <DateRange
                disabled={false}
                attached={false}
                dateRange={range}
                setDateRange={onPick}
                onPopoverClose={onPickerClose}
                eventDay={event?.date}
                showTooltip={opened}
                tooltipText="רוצים תאריכים אחרים? בחרו כאן"
              />
            </div>
          </div>
          {rangeNote && <p className="text-[12px] text-destructive">{rangeNote}</p>}
          {datesDiffer ? (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border-[1.5px] border-amber-500 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div className="flex flex-col gap-1">
                <b>
                  {hasFlight
                    ? "שימו לב: תאריכי המלון שונים מתאריכי הטיסה"
                    : "שימו לב: תאריכי המלון שונים מתאריכי החבילה"}
                </b>
                <span dir="ltr" className="tabular-nums text-right">
                  {`${hasFlight ? "טיסה" : "חבילה"}: ${short(flightIn)}–${short(flightOut)} · מלון: ${short(checkin)}–${short(checkout)}`}
                </span>
                <span>
                  {hasFlight
                    ? "הטיסה לא משתנה. ודאו שיש לכם לינה לכל לילה בין הנחיתה לחזרה."
                    : "החבילה לא משתנה."}
                </span>
                <button
                  type="button"
                  onClick={() => setDates(flightIn, flightOut)}
                  className="self-start text-[12px] font-bold underline underline-offset-2"
                >
                  {hasFlight ? "חזרה לתאריכי הטיסה" : "חזרה לתאריכי החבילה"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              {`${nightCount} לילות · ${hasFlight ? "לפי הטיסה שבחרתם" : "לפי תאריכי החבילה"}.`}
            </p>
          )}
        </div>

        {/* Where to sleep - the night squares alone */}
        <div className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">איפה ישנים בכל לילה?</div>
          <p className="text-[12px] text-muted-foreground">
            {canSplit
              ? `${isRecommended ? "ההמלצה שלנו: " : ""}${Number(event.split_default_nights) === 1 ? "לילה אחד" : "שני לילות"} ב${eventCity} סביב המשחק, השאר ב${flightCity}. לחיצה על לילה מחליפה לו עיר.`
              : "לחיצה על לילה מעבירה את כל השהות לעיר האחרת."}
          </p>
          <NightStrip event={event} nights={nights} onChange={onNights} />
          <div className="flex flex-wrap gap-1.5">
            {segments.map((s) => (
              <span
                key={s.checkin}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-semibold"
              >
                {`${cityName(event, s.city)} · ${s.nights === 1 ? "לילה אחד" : `${s.nights} לילות`}`}
              </span>
            ))}
          </div>
          {event.lodging_note && (
            <p className="text-[12px] text-muted-foreground">{event.lodging_note}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            disabled={!nights.length}
            onClick={confirm}
            className="rounded-xl bg-main px-5 py-2.5 text-[14px] font-bold text-main-foreground disabled:opacity-50"
          >
            מצא לי מלון
          </button>
          {onSkipHotel && (
            <button
              type="button"
              onClick={onSkipHotel}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-[14px] font-bold text-foreground transition-colors hover:border-forest dark:hover:border-glow"
            >
              לא צריך מלון
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
