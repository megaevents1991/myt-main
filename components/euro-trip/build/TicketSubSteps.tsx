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

/** One event: the numbered circle, "אירוע n" and the event's name (cut to fit, full in `title`). */
function SubStep({ item, onOpen }: { item: TicketSubStep; onOpen: () => void }) {
  const body = (
    <>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-bold tabular-nums",
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
        {item.done ? <Check className="size-4" strokeWidth={3} /> : item.index + 1}
      </span>
      <span className="flex min-w-0 flex-col text-start">
        <span
          className={cn(
            "whitespace-nowrap text-[13px] font-bold leading-tight",
            !item.enabled && !item.current && "text-muted-foreground",
          )}
        >
          {item.label}
        </span>
        <span
          title={item.name}
          className={cn(
            "max-w-[7.5rem] truncate text-xs leading-tight sm:max-w-[15rem]",
            item.current ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {item.name}
        </span>
      </span>
      {item.done && <span className="sr-only">כרטיסים נבחרו</span>}
    </>
  );
  const box = "flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1";

  // The open event is where the customer stands - not a button. A later event past one still
  // without its ticket cannot be skipped to: not a button either (the continue bar walks them).
  if (item.enabled && !item.current) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          box,
          "transition-colors hover:bg-foreground/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest dark:focus-visible:outline-glow",
        )}
      >
        {body}
      </button>
    );
  }
  return (
    <span aria-current={item.current ? "step" : undefined} className={box}>
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
        <ol ref={strip} className="-mx-1 flex items-center overflow-x-auto p-1 [scrollbar-width:none]">
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
