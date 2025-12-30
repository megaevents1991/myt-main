"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/app.types";
import { Button } from "@/components/ui/button";
import { Modal } from "@mantine/core";
import { getMarkup, isEventSoldOut } from "@/lib/events/price";
import { Mondial2026EventCard } from "@/components/mondial/Mondial2026EventCard";

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
        onClose={() => {}}
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
        centered
        dir="rtl"
        overlayProps={{ backgroundOpacity: 0.7 }}
        title={
          <span className="text-secondary font-semibold">
            רוצים להוזיל את המחיר וליהנות משני אירועים?
          </span>
        }
      >
        <div className="flex flex-row-reverse gap-3 mt-4">
          <Button
            type="button"
            onClick={() => {
              setMode("multi");
              setShowPrompt(false);
            }}
          >
            כן, לבחור עד 3 אירועים
          </Button>
          <Button type="button" variant="outline" onClick={continueSingle}>
            לא, להמשיך להזמנה
          </Button>
        </div>
      </Modal>

      <div
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="רשימת משחקים קרובים"
      >
        {events.map((evt) => {
          const isSoldOut = isEventSoldOut(evt);
          const isSelected = selectedIdsDeduped.includes(evt.id);
          const displayedPrice = computeMondialPrice(evt);

          return (
            <Mondial2026EventCard
              key={evt.id}
              event={evt}
              isSelected={isSelected}
              isSoldOut={isSoldOut}
              displayedPrice={displayedPrice}
              onClick={() => handleCardClick(evt.id, isSoldOut)}
            />
          );
        })}
      </div>

      {mode === "multi" && (
        <div className="flex w-full flex-col items-center bottom-0 sticky z-40">
          <div className="mt-4 w-screen bg-white border-t border-gray-200">
            <div
              className="flex p-4 m-auto max-w-7xl justify-between items-center gap-4"
              dir="rtl"
            >
              <div className="text-secondary font-semibold">
                בחרו עד 3 אירועים (ניתן לבחור/לבטל בחירה)
              </div>
              <Button
                type="button"
                disabled={!canContinue}
                onClick={continueMulti}
              >
                המשך להזמנה
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
