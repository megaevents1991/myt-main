"use client";

import { useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he";
import { ChevronLeft, Circle, Plane, TrainFront, X } from "lucide-react";

import type { Event } from "@/lib/app.types";
import { cn } from "@/lib/utils";
import { cityName, eventCityName, placeLabel } from "@/lib/events/lodging";
import {
  dayMonth,
  dayMonthYear,
  routeCandidates,
  stayCityName,
  type Candidate,
  type CatalogKind,
} from "@/lib/itinerary/builder";
import { moves } from "@/lib/itinerary/dates";
import { dayDiff, eventDay, eventKind, eventPoint, haversineKm } from "@/lib/itinerary/geo";
import { estimateItinerary } from "@/lib/itinerary/price";
import { isAddable } from "@/lib/itinerary/rules";
import { TripEventArt } from "./TripEventArt";
import { DayPlanner } from "./DayPlanner";
import { useItinerary } from "./ItineraryProvider";
import { ADD_BUTTON, CompatChip, KindTabs, LIST_PAGE, PANEL, PanelTitle, ShowMore, daysLabel } from "./parts";

const km = (n: number) => n.toLocaleString("he-IL");
const weekday = (day: string) => `יום ${dayjs(day).locale("he").format("dddd")}`;

/** A line of the timeline: an icon on the dashed rail, then the text. */
function Leg({ icon, last = false, children }: { icon: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative ms-3.5 flex flex-wrap items-center gap-2 border-s-2 border-dashed py-2.5 ps-7 text-sm font-semibold text-muted-foreground",
        last ? "border-transparent" : "border-border",
      )}
    >
      <span className="absolute -start-[15px] flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground">
    {children}
  </span>
);

/** One event of the trip: its art, name, day, place, and × to take it out. */
function Stop({ event: e, n, onRemove }: { event: Event; n: number; onRemove: () => void }) {
  const day = eventDay(e);
  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-background p-2.5">
      <TripEventArt event={e} sizes="76px" className="size-[76px] shrink-0 rounded-xl" />
      <span className="absolute -start-2 -top-2 flex size-6 items-center justify-center rounded-full bg-primary font-display text-[13px] font-black text-primary-foreground">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[17px] font-bold leading-tight">{e.name}</div>
        <div className="mt-1 text-[13.5px] text-muted-foreground">
          <b className="tabular-nums text-foreground">{dayMonthYear(day)}</b> · {weekday(day)}
        </div>
        <div className="text-[13.5px] text-muted-foreground">{placeLabel(e)}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`הסרת ${e.name} מהמסלול`}
        className="ms-auto flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** The trip as a timeline: flight out, the stops and what lies between them, flight home. */
function Timeline() {
  const { state, removeEvent } = useItinerary();
  const { route, dates, train } = state;

  if (!route.length) {
    return (
      <div className="rounded-2xl border-[1.5px] border-dashed border-border p-6 text-center">
        <b>מאיפה מתחילים?</b>
        <p className="mt-1 text-sm text-muted-foreground">בחרו אירוע מהרשימה. אחריו נראה רק מה שאפשר באמת לשלב.</p>
      </div>
    );
  }

  const first = route[0];
  const last = route[route.length - 1];
  const moveByKey = new Map(moves(route).map((m) => [m.key, m]));

  return (
    <div>
      <Leg icon={<Plane className="size-3.5" aria-hidden />}>
        <span>
          טיסה מ<b className="text-foreground">תל אביב</b> ל<b className="text-foreground">{cityName(first, "flight")}</b>
        </span>
        <Chip>{dayMonth(dates.depart)}</Chip>
      </Leg>
      {route.map((e, i) => {
        const prev = route[i - 1];
        const key = prev ? `${prev.id}>${e.id}` : "";
        const move = prev ? moveByKey.get(key) : undefined;
        // A move between two stays that share a flight city has no flight: it is made on the ground.
        const byLand = !!move && (train.includes(key) || move.a.location.city_iata === move.b.location.city_iata);
        return (
          <div key={e.id}>
            {prev && move && (
              <Leg icon={byLand ? <TrainFront className="size-3.5" aria-hidden /> : <Plane className="size-3.5" aria-hidden />}>
                <span>
                  <b className="text-foreground">{eventCityName(prev)}</b> ← <b className="text-foreground">{eventCityName(e)}</b>
                </span>
                <Chip>{km(haversineKm(eventPoint(prev), eventPoint(e)))} ק״מ</Chip>
                {dates.moves[key] && <Chip>מעבר {dayMonth(dates.moves[key])}</Chip>}
              </Leg>
            )}
            {prev && !move && (
              <Leg icon={<Circle className="size-3" aria-hidden />}>
                <span>
                  נשארים ב<b className="text-foreground">{stayCityName(e)}</b>
                </span>
                <Chip>{daysLabel(dayDiff(eventDay(prev), eventDay(e)))}</Chip>
              </Leg>
            )}
            {/* The stop sits on the rail too, so the dashed line runs past it. */}
            <div className="ms-3.5 border-s-2 border-dashed border-border py-1 ps-4">
              <Stop event={e} n={i + 1} onRemove={() => removeEvent(e.id)} />
            </div>
          </div>
        );
      })}
      <Leg icon={<Plane className="size-3.5" aria-hidden />} last>
        <span>
          חזרה מ<b className="text-foreground">{cityName(last, "flight")}</b> ל<b className="text-foreground">תל אביב</b>
        </span>
        <Chip>{dayMonth(dates.ret)}</Chip>
      </Leg>
    </div>
  );
}

/** One "אפשר לשלב גם" row. */
function CandidateRow({ candidate: { event: e, compat }, onAdd }: { candidate: Candidate; onAdd: () => void }) {
  const blocked = !isAddable(compat);
  // Distance only on a fit between cities ("same" names a neighbour event's city, not the stay).
  const near =
    (compat.status === "best" || compat.status === "ok" || compat.status === "warn") && compat.km && compat.nearCity
      ? ` · ${km(compat.km)} ק״מ מ${compat.nearCity}`
      : "";
  return (
    <li className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
      <TripEventArt
        event={e}
        sizes="62px"
        className={cn("size-[62px] shrink-0 rounded-xl", blocked && "opacity-45")}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-base font-bold leading-tight", blocked && "opacity-45")}>{e.name}</div>
        <div className={cn("mt-0.5 text-[13px] text-muted-foreground", blocked && "opacity-45")}>
          <b className="tabular-nums text-foreground">{dayMonthYear(eventDay(e))}</b> • {placeLabel(e)}
          {near}
        </div>
        <CompatChip compat={compat} className="mt-1.5" />
      </div>
      <button type="button" className={cn(ADD_BUTTON, "shrink-0")} disabled={blocked} onClick={onAdd}>
        {blocked ? "לא מתאים" : "+ הוספה"}
      </button>
    </li>
  );
}

/**
 * The route step ("המסלול"), recommended mode: the trip as a timeline, the day planner, and
 * "אפשר לשלב גם" - every eligible event near the route's dates, labelled by the rules.
 */
export function RouteStep() {
  const { state, catalog, settings, addEvent, setMode } = useItinerary();
  const { route, dates } = state;
  const [kind, setKind] = useState<CatalogKind>("all");
  const [visible, setVisible] = useState(LIST_PAGE);

  const candidates = useMemo(
    () => routeCandidates(route, catalog, settings).filter((c) => kind === "all" || eventKind(c.event) === kind),
    [route, catalog, settings, kind],
  );
  const saving = route.length >= 2 ? estimateItinerary(route, dates, settings, null).saving : null;
  const full = route.length >= settings.maxEvents;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="m-0 text-lg leading-snug md:text-[19px]">
          בנו את המסלול: <b>עד {settings.maxEvents} אירועים</b>, טיסה לעיר הראשונה וחזרה מהאחרונה, מלון בכל עיר.
        </p>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className="mt-1 inline-flex items-center gap-0.5 text-sm font-bold text-forest underline decoration-forest/40 underline-offset-2 transition-opacity hover:opacity-80 dark:text-glow dark:decoration-glow/40"
        >
          מעדיפים לבחור לבד מכל האירועים?
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <section className={PANEL} aria-label="המסלול">
            {saving !== null && (
              <span className="mb-3 inline-flex items-center rounded-full border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-bold leading-none text-forest dark:text-primary">
                חוסכים ${saving.toLocaleString("en-US")} מול {route.length} חבילות נפרדות
              </span>
            )}
            <Timeline />
          </section>
          <DayPlanner />
        </div>

        <section className={cn(PANEL, "min-w-0")} aria-labelledby="trip-candidates-heading">
          <PanelTitle>
            <span id="trip-candidates-heading">{route.length ? "אפשר לשלב גם" : "בחרו אירוע ראשון"}</span>
          </PanelTitle>
          <p className="mb-3 mt-1 text-[13.5px] text-muted-foreground">
            {route.length
              ? `עד ${km(settings.maxKm)} ק״מ ועד ${settings.maxGapDays} ימים בין אירועים. מה שלא מתאים - מוצג עם הסיבה.`
              : "אירועים עם חבילה מלאה באירופה"}
          </p>
          {!full && (
            <KindTabs
              value={kind}
              onChange={(k) => {
                setKind(k);
                setVisible(LIST_PAGE);
              }}
            />
          )}
          {full ? (
            // A full route: every row would say "המסלול מלא" - say it once.
            <p className="mt-4 rounded-2xl border-[1.5px] border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              המסלול מלא - עד {settings.maxEvents} אירועים. כדי לשלב אירוע אחר, הסירו אחד מהמסלול.
            </p>
          ) : candidates.length ? (
            <>
              <ul className="mt-1">
                {candidates.slice(0, visible).map((c) => (
                  <CandidateRow key={c.event.id} candidate={c} onAdd={() => addEvent(c.event)} />
                ))}
              </ul>
              <ShowMore hidden={candidates.length - visible} onClick={() => setVisible((v) => v + LIST_PAGE)} />
            </>
          ) : (
            <p className="mt-4 text-center text-sm text-muted-foreground">אין עוד אירועים בטווח התאריכים של המסלול.</p>
          )}
        </section>
      </div>
    </div>
  );
}
