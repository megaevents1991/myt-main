"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import type { Event } from "@/lib/app.types";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { getMarkup, isEventSoldOut } from "@/lib/events/price";
import { Mondial2026EventCard } from "@/components/mondial/Mondial2026EventCard";
import { parseMondial2026EventName } from "@/lib/mondial2026Title";

type Mode = "single" | "multi";

function computeMondialPrice(event: Event): number {
  const available = (event.tickets_and_rates || []).filter(
    (t) => t?.available !== false
  );
  const minTicketPrice =
    available.length > 0 ? Math.min(...available.map((t) => t.price)) : 0;
  return event.base_flight_price + minTicketPrice + getMarkup();
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
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="רשימת משחקים קרובים"
      >
        {events.map((evt) => {
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
