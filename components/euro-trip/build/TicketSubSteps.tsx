"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { ticketSubSteps, type TicketSubStep } from "@/lib/itinerary/flowSteps";
import { cn } from "@/lib/utils";
import { useItinerary } from "./ItineraryProvider";
import { EditRouteLink } from "./TripHeader";

/**
 * The live Stepper's three states, in its colours (components/ui/Stepper.tsx: Mantine's
 * `myColor.4` mint, the check in `--brand-forest`): done = mint fill + check, current = mint
 * ring, open = grey. Mantine's own variable, so the two can never drift apart.
 */
const MINT_RING = "border-[color:var(--mantine-color-myColor-4)]";
const MINT_FILL = "bg-[color:var(--mantine-color-myColor-4)]";
/** The stepper's grey (Mantine gray-2 / dark-5): a tint of the text, so it reads in both themes. */
const GREY = "bg-foreground/[0.08]";

/**
 * One event. The open one is BIG - a large circle, "אירוע n" and the event's name; every other
 * event is a small circle alone (number or check), its name in `title` and for screen readers
 * (Alon 28.10: "עיגולים של אירוע אחד אירוע שתיים - הנוכחי בגדול והשאר עיגול קטן").
 */
function SubStep({ item, onOpen }: { item: TicketSubStep; onOpen: () => void }) {
  const body = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums",
          item.current ? "size-10 text-base" : "size-6 text-[11px]",
          item.done
            ? cn(
                MINT_RING,
                MINT_FILL,
                "text-forest",
                // Back on a done event: still marked as the open one (the stepper has no such state).
                item.current && "ring-2 ring-[color:var(--mantine-color-myColor-4)] ring-offset-2 ring-offset-background",
              )
            : item.current
              ? cn(MINT_RING, GREY, "text-foreground")
              : cn("border-transparent", GREY, "text-muted-foreground"),
        )}
        aria-hidden
      >
        {item.done ? <Check className={item.current ? "size-5" : "size-3.5"} strokeWidth={3} /> : item.index + 1}
      </span>
      {item.current ? (
        <span className="flex min-w-0 flex-col text-start">
          <span className="whitespace-nowrap text-xs font-semibold leading-tight text-muted-foreground">{item.label}</span>
          <span title={item.name} className="max-w-[13rem] truncate text-base font-bold leading-tight sm:max-w-[26rem]">
            {item.name}
          </span>
        </span>
      ) : (
        <span className="sr-only">
          {item.label}: {item.name}
        </span>
      )}
      {item.done && <span className="sr-only">כרטיסים נבחרו</span>}
      {!item.enabled && !item.current && <span className="sr-only">זמין אחרי בחירת כרטיסים לאירוע הקודם</span>}
    </>
  );
  const box = "flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1";
  const focus =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow";

  // The open event is where the customer stands: a button that does nothing, so the keyboard
  // focus stays on it when the event a customer opened (or the continue bar moved to) becomes
  // the open one - a plain span there would drop the focus to the page.
  if (item.current) {
    return (
      <button type="button" aria-current="step" className={cn(box, "cursor-default", focus)}>
        {body}
      </button>
    );
  }
  if (item.enabled) {
    return (
      <button
        type="button"
        onClick={onOpen}
        title={`${item.label}: ${item.name}`}
        className={cn(box, "transition-colors hover:bg-foreground/[0.04]", focus)}
      >
        {body}
      </button>
    );
  }
  // A later event past one still without its ticket cannot be skipped to: not a button (the
  // continue bar walks the events in order); the sr-only line above says why.
  return (
    <span className={box} title={`${item.label}: ${item.name}`}>
      {body}
    </span>
  );
}

/**
 * The tickets step's sub-steps - one per event of the trip - in a slim row under the stepper,
 * with "עריכת המסלול" at its inline end (Dor, 22.10: the events are sub-steps of "כרטיסים", not
 * steps of their own). A done event or the first one still open may be opened; nothing an event
 * holds is cleared by the visit (`setActiveEvent` moves the view only).
 * Phone: the events scroll sideways in their own strip, the edit link on its own line under it.
 */
export function TicketSubSteps() {
  const { state, setActiveEvent } = useItinerary();
  const items = ticketSubSteps(state);
  const strip = useRef<HTMLOListElement>(null);
  const currentIndex = items.find((s) => s.current)?.index ?? 0;

  // On a phone the strip is narrower than the events: bring the open one into it. Sideways only
  // and at once - the page itself is being scrolled to the top (ItineraryFlow) at that moment.
  useEffect(() => {
    const ol = strip.current;
    const open = ol?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!ol || !open || ol.scrollWidth <= ol.clientWidth) return;
    const view = ol.getBoundingClientRect();
    const at = open.getBoundingClientRect();
    const pad = 16;
    if (at.left < view.left) ol.scrollBy({ left: at.left - view.left - pad });
    else if (at.right > view.right) ol.scrollBy({ left: at.right - view.right + pad });
  }, [currentIndex]);

  if (!items.length) return null;

  return (
    <div
      dir="rtl"
      className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 pt-3 sm:flex-row sm:items-center sm:gap-6 lg:px-6"
    >
      <nav aria-label="האירועים בטיול" className="min-w-0 sm:flex-1">
        {/* A scroller clips both ways: `p-1` keeps the focus outline and the open event's ring
            (4px out) inside it, `-mx-1` keeps the items on the page's edge. */}
        <ol
          ref={strip}
          // `role="list"`: Safari drops the list role of a list styled without its markers.
          role="list"
          className="-mx-1 flex items-center overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <li key={item.index} className="flex shrink-0 items-center sm:min-w-0 sm:shrink">
              {item.index > 0 && (
                // The live Stepper's separator: mint once the event before it is done.
                <span
                  aria-hidden
                  className={cn(
                    "mx-1.5 h-0.5 w-5 shrink-0 rounded-full sm:mx-3 sm:w-8",
                    items[item.index - 1].done ? MINT_FILL : GREY,
                  )}
                />
              )}
              <SubStep item={item} onOpen={() => setActiveEvent(item.index)} />
            </li>
          ))}
        </ol>
      </nav>
      <EditRouteLink className="shrink-0 self-end whitespace-nowrap sm:self-auto" />
    </div>
  );
}
