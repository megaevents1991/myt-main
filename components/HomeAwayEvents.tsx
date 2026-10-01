"use client";

import type { Event } from "@/lib/app.types";
import { ArtistEventsFilter } from "@/components/ArtistEventsFilter";
import { useSessionState } from "@/app/hooks/useSessionState";
import { cn } from "@/lib/utils";
import { oneOf } from "@/lib/viewState";

/** Green-cube heading, same look as TeamCmsPage's CubeHeading. */
const Cubes = () => (
  <>
    <div aria-hidden className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} />
  </>
);

const FIXTURE_KINDS = ["home", "away", "champions"] as const;
type FixtureKind = (typeof FIXTURE_KINDS)[number];
const parseKind = oneOf(FIXTURE_KINDS);

/**
 * Team-page fixtures with a home/away choice (creative 2026-08-20: "שיהיה
 * כאן בחירה בין בית לחוץ ואם זה בחור פה על בית אז למטה זה חוץ והפוך"),
 * extended with a ליגת האלופות pill (2026-08-28) for teams that have CL
 * fixtures: the toggle sits on the first block; the picked kind renders on
 * top and the other kinds right below it. With only one kind there is no
 * choice - the single list renders under its plain heading.
 */
export function HomeAwayEvents({
  homeEvents,
  awayEvents,
  championsEvents = [],
  title,
}: {
  homeEvents: Event[];
  awayEvents: Event[];
  championsEvents?: Event[];
  title: string;
}) {
  const blocks = (
    [
      { key: "home", label: "משחקי בית", events: homeEvents },
      { key: "away", label: "משחקי חוץ", events: awayEvents },
      { key: "champions", label: "ליגת האלופות", events: championsEvents },
    ] as { key: FixtureKind; label: string; events: Event[] }[]
  ).filter((b) => b.events.length > 0);

  // Remembered for this page in this tab (lib/viewState.ts) - a refresh keeps
  // the picked kind on top. A kind this team no longer has falls back to the first.
  const firstKind = blocks[0]?.key ?? "home";
  const [pickedKind, setPrimary] = useSessionState<FixtureKind>(
    "fixtures",
    firstKind,
    parseKind,
  );
  const primary = blocks.some((b) => b.key === pickedKind) ? pickedKind : firstKind;
  const hasChoice = blocks.length > 1;

  const ordered = [...blocks].sort((a, b) =>
    a.key === primary ? -1 : b.key === primary ? 1 : 0,
  );

  return (
    <div className="flex flex-col gap-10">
      {ordered.map((block, i) => (
        <div key={block.key}>
          <div className="mb-4 flex flex-row flex-wrap items-center justify-start gap-y-2 lg:mb-6">
            <Cubes />
            {hasChoice && i === 0 ? (
              // The choice lives on the top block: pills, picked = filled.
              <div
                className="mx-2 flex flex-wrap items-center gap-2"
                role="tablist"
                aria-label="סוג משחקים"
              >
                {blocks.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    role="tab"
                    aria-selected={b.key === primary}
                    onClick={() => setPrimary(b.key)}
                    className={cn(
                      "rounded-full px-4 py-2 font-display text-lg font-extrabold tracking-tight transition-colors sm:px-5 sm:text-2xl",
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
          <ArtistEventsFilter
            events={block.events}
            title={title}
            showName
            stateKey={`sort:${block.key}`}
          />
        </div>
      ))}
    </div>
  );
}
