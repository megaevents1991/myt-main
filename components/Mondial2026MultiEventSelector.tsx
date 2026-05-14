"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import type { Event } from "@/lib/app.types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { getTotalMarkup, isEventSoldOut } from "@/lib/events/price";
import { Mondial2026EventCard } from "@/components/mondial/Mondial2026EventCard";
import { parseMondial2026EventName } from "@/lib/mondial2026Title";
import { ChevronDown } from "lucide-react";

type Mode = "single" | "multi";

const LOCATION_FILTER_ALL = "__all__";
const LOCATION_FILTER_GROUP_1 = "__group_1__";
const LOCATION_FILTER_GROUP_2 = "__group_2__";
const TEAM_FILTER_ALL = "__all_teams__";

// Leave empty for now; user can populate later.
// Map from group option value -> list of location names to include.
const LOCATION_FILTER_GROUPS: Record<string, string[]> = {
  [LOCATION_FILTER_GROUP_1]: [
    "אטלנטה, ארה\"ב",
    "בוסטון, ארה\"ב",
    "מיאמי, ארה\"ב",
    "ניו יורק, ארה\"ב",
    "פילדלפיה, ארה\"ב",
    // Shared (also in group 2)
    "ארלינגטון, ארה\"ב",
    "דאלאס, ארה\"ב",
    "יוסטון, ארה\"ב",
    // Some feeds combine Arlington + Dallas
    "ארלינגטון-דאלאס, ארה\"ב",
    "ארלינגטון–דאלאס, ארה\"ב",
  ],
  [LOCATION_FILTER_GROUP_2]: [
    "לוס אנג'לס, ארה\"ב",
    "לוס אנגלס, ארה\"ב",
    "לוס אנג׳לס, ארה\"ב",
    // Shared (also in group 1)
    "ארלינגטון, ארה\"ב",
    "דאלאס, ארה\"ב",
    "יוסטון, ארה\"ב",
    "ארלינגטון-דאלאס, ארה\"ב",
    "ארלינגטון–דאלאס, ארה\"ב",
  ],
};

function computeMondialPrice(event: Event): number {
  const available = (event.tickets_and_rates || []).filter(
    (t) => t?.available !== false
  );
  const minTicketPrice =
    available.length > 0 ? Math.min(...available.map((t) => t.price)) : 0;
  return event.base_flight_price + minTicketPrice + getTotalMarkup(event);
}

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTeamsFromMondialEventName(
  eventName?: string
): { team1: string; team2: string } | null {
  const parsed = parseMondial2026EventName(eventName);
  if (!parsed.isMondial2026 || !parsed.teamsTitle) return null;

  const parts = parsed.teamsTitle
    // Only split on the match separator (dash with surrounding whitespace)
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;
  return { team1: parts[0], team2: parts[1] };
}

export default function Mondial2026MultiEventSelector({
  events,
}: {
  events: Event[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>(
    LOCATION_FILTER_ALL
  );
  const [teamFilter, setTeamFilter] = useState<string>(TEAM_FILTER_ALL);

  const locationOptions = useMemo(() => {
    const uniq = new Set<string>();
    for (const evt of events) {
      const loc = evt.location?.name;
      if (loc) uniq.add(loc);
    }
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const teamOptions = useMemo(() => {
    const byNormalized = new Map<string, string>();
    for (const evt of events) {
      const teams = extractTeamsFromMondialEventName(evt.name);
      if (!teams) continue;

      const t1 = normalizeTeamName(teams.team1);
      const t2 = normalizeTeamName(teams.team2);

      const isUndecided = (t: string) => t === "טרם נקבע";

      if (t1 && !isUndecided(t1) && !byNormalized.has(t1)) {
        byNormalized.set(t1, teams.team1.trim());
      }
      if (t2 && !isUndecided(t2) && !byNormalized.has(t2)) {
        byNormalized.set(t2, teams.team2.trim());
      }
    }

    return Array.from(byNormalized.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "he", { sensitivity: "base" })
      );
  }, [events]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (locationFilter && locationFilter !== LOCATION_FILTER_ALL) {
      if (
        locationFilter === LOCATION_FILTER_GROUP_1 ||
        locationFilter === LOCATION_FILTER_GROUP_2
      ) {
        const groupLocations = LOCATION_FILTER_GROUPS[locationFilter] || [];
        if (groupLocations.length > 0) {
          const groupSet = new Set(groupLocations);
          result = result.filter((evt) => {
            const loc = evt.location?.name;
            return !!loc && groupSet.has(loc);
          });
        }
      } else {
        result = result.filter(
          (evt) => (evt.location?.name || "") === locationFilter
        );
      }
    }

    if (teamFilter && teamFilter !== TEAM_FILTER_ALL) {
      result = result.filter((evt) => {
        const teams = extractTeamsFromMondialEventName(evt.name);
        if (!teams) return false;

        const t1 = normalizeTeamName(teams.team1);
        const t2 = normalizeTeamName(teams.team2);
        return t1 === teamFilter || t2 === teamFilter;
      });
    }

    return result;
  }, [events, locationFilter, teamFilter]);

  useEffect(() => {
    // Avoid keeping selections that might not be visible after filtering.
    setSelectedIds([]);
    setShowPrompt(false);
  }, [locationFilter, teamFilter]);

  const selectedIdsDeduped = useMemo(() => {
    const uniq = Array.from(new Set(selectedIds));
    return uniq.slice(0, 3);
  }, [selectedIds]);

  const selectedEventsInfo = useMemo(() => {
    return selectedIdsDeduped.map((id) => {
      const evt = events.find((e) => e.id === id);
      if (!evt) return null;
      const parsed = parseMondial2026EventName(evt.name);
      return {
        name: parsed.teamsTitle || evt.name,
        date: evt.date ? dayjs(evt.date).format("DD/MM/YYYY") : "",
        location: evt.location?.name || "",
      };
    }).filter(Boolean) as { name: string; date: string; location: string }[];
  }, [selectedIdsDeduped, events]);

  // Get dates of selected events to disable same-date events in multi mode
  const selectedDates = useMemo(() => {
    return selectedIdsDeduped
      .map((id) => {
        const evt = events.find((e) => e.id === id);
        return evt?.date ? dayjs(evt.date).format("YYYY-MM-DD") : null;
      })
      .filter(Boolean) as string[];
  }, [selectedIdsDeduped, events]);

  const canContinue = selectedIdsDeduped.length > 0;

  const handleCardClick = (eventId: number, disabled: boolean) => {
    if (disabled) return;

    if (mode === "single") {
      if (selectedIds.includes(eventId)) {
        setSelectedIds([]);
        setShowPrompt(false);
      } else {
        setSelectedIds([eventId]);
        setShowPrompt(true);
      }
      return;
    }

    setSelectedIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, eventId];
    });
  };

  const continueSingle = () => {
    if (!selectedIdsDeduped[0]) return;
    router.push(`/order/${selectedIdsDeduped[0]}`);
  };

  const continueMulti = () => {
    if (!selectedIdsDeduped[0]) return;
    const primaryId = selectedIdsDeduped[0];
    router.push(
      `/order/${primaryId}?bundleEventIds=${selectedIdsDeduped.join(",")}`
    );
  };

  return (
    <>
      <Modal
        opened={showPrompt && mode === "single"}
        title="יש לכם עוד משחקים על הכוונת?"
        description="למה לבחור רק אחד?"
        iconType="Plane"
        action={
          <div className="flex flex-col gap-3 w-full">
            <Button
              type="button"
              variant="secondary"
              className="font-bold text-lg py-5 w-full"
              onClick={() => {
                setMode("multi");
                setShowPrompt(false);
              }}
            >
              כן, לבחור עד 3 אירועים ולחסוך
            </Button>
            <Button
              type="button"
              variant="outline"
              className="font-bold text-lg py-5 w-full"
              onClick={continueSingle}
            >
              המשך להזמנה
            </Button>
          </div>
        }
      />

      <div
        className="mb-4 sm:mb-6 flex flex-wrap gap-4 justify-start"
        dir="ltr"
      >
        <label
          htmlFor="mondial-2026-location-filter"
          className="flex items-center gap-3 sm:gap-4"
        >
          <span className="relative w-[220px] sm:w-[260px] max-w-full">
            <select
              id="mondial-2026-location-filter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              dir="rtl"
              className="block w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 text-base sm:text-lg font-semibold text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value={LOCATION_FILTER_ALL}>כל המיקומים</option>
              <option value={LOCATION_FILTER_GROUP_1}>חוף מזרחי</option>
              <option value={LOCATION_FILTER_GROUP_2}>חוף מערבי</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-500" />
          </span>
          <span
            className="text-base sm:text-lg font-semibold text-gray-700"
            dir="rtl"
          >
            סננו לפי מיקום
          </span>
        </label>

        <label
          htmlFor="mondial-2026-team-filter"
          className="flex items-center gap-3 sm:gap-4"
        >
          <span className="relative w-[220px] sm:w-[260px] max-w-full">
            <select
              id="mondial-2026-team-filter"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              dir="rtl"
              className="block w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 pl-10 sm:pl-12 text-base sm:text-lg font-semibold text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value={TEAM_FILTER_ALL}>כל הנבחרות</option>
              {teamOptions.map((team) => (
                <option key={team.value} value={team.value}>
                  {team.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 sm:left-4 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-500" />
          </span>
          <span
            className="text-base sm:text-lg font-semibold text-gray-700"
            dir="rtl"
          >
            סננו לפי נבחרת
          </span>
        </label>
      </div>

      <div
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="רשימת משחקים קרובים"
      >
        {filteredEvents.map((evt) => {
          const isSoldOut = isEventSoldOut(evt);
          const isSelected = selectedIdsDeduped.includes(evt.id);
          const displayedPrice = computeMondialPrice(evt);
          const hidePrice = mode === "multi";
          
          // In multi mode, disable events on the same date as already selected events
          const evtDateKey = evt.date ? dayjs(evt.date).format("YYYY-MM-DD") : null;
          const isSameDateAsSelected = mode === "multi" && !isSelected && !!evtDateKey && selectedDates.includes(evtDateKey);
          const isDisabled = isSoldOut || isSameDateAsSelected;

          return (
            <Mondial2026EventCard
              key={evt.id}
              event={evt}
              isSelected={isSelected}
              isSoldOut={isSoldOut}
              isSameDateDisabled={isSameDateAsSelected}
              displayedPrice={displayedPrice}
              hidePrice={hidePrice}
              onClick={() => handleCardClick(evt.id, !!isDisabled)}
            />
          );
        })}
      </div>

      {mode === "multi" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-4"
              dir="rtl"
            >
              <div className="text-center sm:text-right">
                {selectedEventsInfo.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedEventsInfo.map((info, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-black font-bold text-lg">
                          {info.name}
                        </span>
                        <span className="text-primary text-md">
                          {info.date} | {info.location}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500">בחרו עד 3 אירועים</span>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="font-bold text-lg px-8 py-6 whitespace-nowrap"
                disabled={!canContinue}
                onClick={continueMulti}
              >
                קחו אותי לשם
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
