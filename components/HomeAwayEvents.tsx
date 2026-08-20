"use client";

import { useState } from "react";

import type { Event } from "@/lib/app.types";
import { ArtistEventsFilter } from "@/components/ArtistEventsFilter";
import { cn } from "@/lib/utils";

/** Green-cube heading, same look as TeamCmsPage's CubeHeading. */
const Cubes = () => (
  <>
    <div aria-hidden className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} />
  </>
);

/**
 * Team-page fixtures with a home/away choice (creative 2026-08-20: "שיהיה
 * כאן בחירה בין בית לחוץ ואם זה בחור פה על בית אז למטה זה חוץ והפוך"):
 * a toggle sits on the first block; the picked kind renders on top and the
 * other kind right below it. With only one kind there is no choice - the
 * single list renders under its plain heading.
 */
export function HomeAwayEvents({
  homeEvents,
  awayEvents,
  title,
}: {
  homeEvents: Event[];
  awayEvents: Event[];
  title: string;
}) {
  const [primary, setPrimary] = useState<"home" | "away">(
    homeEvents.length > 0 ? "home" : "away",
  );
  const both = homeEvents.length > 0 && awayEvents.length > 0;

  const blocks = (
    [
      { key: "home", label: "משחקי בית", events: homeEvents },
      { key: "away", label: "משחקי חוץ", events: awayEvents },
    ] as const
  )
    .map((b) => ({ ...b }))
    .filter((b) => b.events.length > 0);
  const ordered = [...blocks].sort((a, b) =>
    a.key === primary ? -1 : b.key === primary ? 1 : 0,
  );

  return (
    <div className="flex flex-col gap-10">
      {ordered.map((block, i) => (
        <div key={block.key}>
          <div className="mb-4 flex flex-row items-center justify-start lg:mb-6">
            <Cubes />
            {both && i === 0 ? (
              // The choice lives on the top block: two pills, picked = filled.
              <div
                className="mx-2 flex items-center gap-2"
                role="tablist"
                aria-label="בית או חוץ"
              >
                {blocks.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="tab"
                    aria-selected={b.key === primary}
                    onClick={() => setPrimary(b.key)}
                    className={cn(
                      "rounded-full px-5 py-2 font-display text-lg font-extrabold tracking-tight transition-colors sm:text-2xl",
                      b.key === primary
                        ? "bg-main text-main-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : (
              <h3 className="mx-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {block.label}
              </h3>
            )}
          </div>
          <ArtistEventsFilter events={block.events} title={title} showName />
        </div>
      ))}
    </div>
  );
}
