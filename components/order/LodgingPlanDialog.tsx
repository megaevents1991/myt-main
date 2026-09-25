"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import dayjs from "dayjs";
import { AlertTriangle, Minus, Plus } from "lucide-react";
import type { Event } from "@/lib/app.types";
import RoomsAndGuestsInput from "@/components/ui/roomsAndGuestsInput";
import { NightStrip } from "@/components/order/SplitStayDialog";
import { getMinTravelDate } from "@/lib/getDefaultDateRange";
import {
  allNights,
  cityName,
  defaultCity,
  defaultSplit,
  LodgingCity,
  NightAssign,
  nightsBetween,
  offeredCities,
  refitNights,
  segmentsFromNights,
  splitOffered,
} from "@/lib/events/lodging";
import { cn } from "@/lib/utils";

export type RoomParams = { adults: number; children: number[] }[];

/** What the customer decided in the popup - the hotel step searches exactly this. */
export type LodgingPlan = {
  dateRange: [Date, Date];
  rooms: RoomParams;
  /** One entry per hotel night; 2+ cities in a row = a split stay. */
  nights: NightAssign[];
};

type Mode = "split" | LodgingCity;

const MAX_NIGHTS = 14;
const iso = (d: Date) => dayjs(d).format("YYYY-MM-DD");
const toDate = (s: string) => new Date(s + "T00:00:00");
const shift = (s: string, n: number) => dayjs(s).add(n, "day").format("YYYY-MM-DD");
const short = (s: string) => dayjs(s).format("DD.MM");
const weekday = (s: string) =>
  toDate(s).toLocaleDateString("he-IL", { weekday: "short" });
const sameNights = (a: NightAssign[], b: NightAssign[]) =>
  a.length === b.length && a.every((n, i) => n.date === b[i].date && n.city === b[i].city);

/**
 * "איפה ישנים?" - opens once on entering the hotel step of a two-city event
 * (Dor, 25.09). One decision before ONE search: hotel dates (± a night, with a
 * loud note when they leave the flight's dates - the flight never moves),
 * guests / rooms (collapsed - known from the flight), and where to sleep:
 * the recommended split preselected, or one city for the whole stay, with the
 * night squares for fine-tuning. Closing the popup = continuing with what is
 * selected. Everything stays changeable afterwards above the hotel list.
 */
export const LodgingPlanDialog = ({
  opened,
  event,
  flightDates,
  hasFlight,
  initialDateRange,
  initialRooms,
  onConfirm,
}: {
  opened: boolean;
  event: Event;
  /** The hotel dates the flight implies (getDefaultDateRange) - the reference. */
  flightDates: [Date, Date];
  hasFlight: boolean;
  initialDateRange: [Date | null, Date | null];
  initialRooms: RoomParams;
  onConfirm: (plan: LodgingPlan) => void;
}) => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const cities = offeredCities(event);
  const canSplit = splitOffered(event);
  const flightCity = cityName(event, "flight");
  const eventCity = cityName(event, "event");
  const flightIn = iso(flightDates[0]);
  const flightOut = iso(flightDates[1]);
  const minIn = iso(getMinTravelDate());

  const [checkin, setCheckin] = useState(flightIn);
  const [checkout, setCheckout] = useState(flightOut);
  const [rooms, setRooms] = useState<RoomParams>(initialRooms);
  const [mode, setMode] = useState<Mode>("split");
  const [nights, setNights] = useState<NightAssign[]>([]);
  const [guestsOpen, setGuestsOpen] = useState(false);

  // Re-seed on every open: the step's current dates and rooms, the recommended
  // split when the event offers one, else the event's default city.
  useEffect(() => {
    if (!opened) return;
    const ci = initialDateRange[0] ? iso(initialDateRange[0]) : flightIn;
    const co = initialDateRange[1] ? iso(initialDateRange[1]) : flightOut;
    const m: Mode = canSplit ? "split" : defaultCity(event);
    setCheckin(ci);
    setCheckout(co);
    setRooms(initialRooms);
    setMode(m);
    setNights(
      m === "split"
        ? defaultSplit(event, ci, co)
        : allNights(refitNights([], ci, co), m)
    );
    setGuestsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const nightCount = nightsBetween(checkin, checkout).length;
  const datesDiffer = checkin !== flightIn || checkout !== flightOut;
  const recommended = useMemo(
    () => defaultSplit(event, checkin, checkout),
    [event, checkin, checkout]
  );
  const isRecommended = mode === "split" && sameNights(nights, recommended);
  const segments = segmentsFromNights(nights);
  const guests = rooms.reduce((n, r) => n + r.adults + r.children.length, 0);

  const setDates = (ci: string, co: string) => {
    const count = nightsBetween(ci, co).length;
    if (count < 1 || count > MAX_NIGHTS || ci < minIn) return;
    setCheckin(ci);
    setCheckout(co);
    const refit = refitNights(nights, ci, co);
    setNights(mode === "split" ? refit : allNights(refit, mode));
  };

  const pickMode = (m: Mode) => {
    setMode(m);
    setNights(m === "split" ? recommended : allNights(nights, m));
  };

  const confirm = () => {
    if (!nights.length) return;
    onConfirm({ dateRange: [toDate(checkin), toDate(checkout)], rooms, nights });
  };

  const stepBtn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-forest disabled:opacity-40 dark:hover:border-glow";
  const modeBtn = (active: boolean) =>
    cn(
      "rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-bold transition-colors",
      active
        ? "border-forest bg-forest/10 text-forest dark:border-glow dark:bg-glow/10 dark:text-glow"
        : "border-border bg-card text-foreground hover:border-forest dark:hover:border-glow"
    );

  const DateStepper = ({
    label,
    value,
    onShift,
    minusDisabled,
    plusDisabled,
  }: {
    label: string;
    value: string;
    onShift: (n: number) => void;
    minusDisabled?: boolean;
    plusDisabled?: boolean;
  }) => (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-[15px] font-bold tabular-nums">
          <span dir="ltr">{short(value)}</span>
          <span className="mr-1.5 whitespace-nowrap text-[12px] font-semibold text-muted-foreground">
            {weekday(value)}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className={stepBtn}
          disabled={minusDisabled}
          onClick={() => onShift(-1)}
          aria-label={`${label} - יום קודם`}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className={stepBtn}
          disabled={plusDisabled}
          onClick={() => onShift(1)}
          aria-label={`${label} - יום אחרי`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      opened={opened}
      onClose={confirm}
      title="איפה ישנים?"
      centered
      size="lg"
      fullScreen={!isDesktop}
      closeOnClickOutside={false}
      styles={{ title: { fontWeight: 700, fontSize: 18 } }}
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <p className="text-[13px] text-muted-foreground">
          {`המשחק ב${eventCity}, הטיסה ל${flightCity}. בחרו איפה לישון ונמצא לכם את המלונות. אפשר לשנות הכול גם אחר כך, מעל רשימת המלונות.`}
        </p>

        {/* Dates */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <DateStepper
              label="צ'ק-אין"
              value={checkin}
              onShift={(n) => setDates(shift(checkin, n), checkout)}
              minusDisabled={shift(checkin, -1) < minIn || nightCount >= MAX_NIGHTS}
              plusDisabled={nightCount <= 1}
            />
            <DateStepper
              label="צ'ק-אאוט"
              value={checkout}
              onShift={(n) => setDates(checkin, shift(checkout, n))}
              minusDisabled={nightCount <= 1}
              plusDisabled={nightCount >= MAX_NIGHTS}
            />
          </div>
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
              {`${nightCount} לילות · ${hasFlight ? "לפי הטיסה שבחרתם" : "לפי תאריכי החבילה"}. לשינוי הטיסה חוזרים לשלב הטיסה.`}
            </p>
          )}
        </div>

        {/* Guests - collapsed, known from the flight */}
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold">
              {`${guests} אורחים · ${rooms.length === 1 ? "חדר אחד" : `${rooms.length} חדרים`}`}
            </span>
            <button
              type="button"
              onClick={() => setGuestsOpen((v) => !v)}
              className="text-[13px] font-bold text-forest underline underline-offset-2 dark:text-glow"
            >
              {guestsOpen ? "סגירה" : "שינוי"}
            </button>
          </div>
          {guestsOpen && (
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              {rooms.map((r, i) => (
                <div key={`${i}_${r.adults}_${r.children.length}`}>
                  {i > 0 && (
                    <button
                      type="button"
                      className="w-full px-2 text-right text-[12px] text-destructive"
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
                className="px-2 text-left text-[13px] font-semibold text-success"
                onClick={() => setRooms((prev) => [...prev, { adults: 1, children: [] }])}
                aria-label="הוסף חדר נוסף"
              >
                +הוסף חדר
              </button>
            </div>
          )}
        </div>

        {/* Where to sleep */}
        <div className="flex flex-col gap-2">
          <div className="text-[14px] font-bold">הלינה:</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="הלינה">
            {canSplit && (
              <button
                type="button"
                role="radio"
                aria-checked={mode === "split"}
                onClick={() => pickMode("split")}
                className={modeBtn(mode === "split")}
              >
                מפוצל · מומלץ
              </button>
            )}
            {cities.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={mode === c}
                onClick={() => pickMode(c)}
                className={modeBtn(mode === c)}
              >
                {`רק ${cityName(event, c)}`}
              </button>
            ))}
          </div>
          {mode === "split" && (
            <>
              <p className="text-[12px] text-muted-foreground">
                {`${Number(event.split_default_nights) === 1 ? "לילה אחד" : "שני לילות"} ב${eventCity} סביב המשחק, השאר ב${flightCity}. לחיצה על לילה מחליפה לו עיר.`}
              </p>
              <NightStrip event={event} nights={nights} onChange={setNights} />
              <div className="flex flex-wrap gap-1.5">
                {segments.map((s) => (
                  <span
                    key={s.checkin}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-semibold"
                  >
                    {`${cityName(event, s.city)} · ${s.nights} לילות`}
                  </span>
                ))}
              </div>
            </>
          )}
          {event.lodging_note && (
            <p className="text-[12px] text-muted-foreground">{event.lodging_note}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            disabled={!nights.length}
            onClick={confirm}
            className="rounded-xl bg-main px-5 py-2.5 text-[14px] font-bold text-main-foreground disabled:opacity-50"
          >
            {isRecommended && !datesDiffer ? "המשך עם ההמלצה" : "המשך"}
          </button>
        </div>
      </div>
    </Modal>
  );
};
