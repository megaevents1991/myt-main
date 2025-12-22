"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/app.types";
import EventButton from "@/components/EventButton";
import Image from "next/image";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import {
  getMondial2026MatchPrefix,
  parseMondial2026EventName,
} from "@/lib/mondial2026Title";

type Mode = "single" | "multi";

export default function Mondial2026MultiEventSelector({
  events,
}: {
  events: Event[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const promptRef = useRef<HTMLDivElement | null>(null);

  const selectedIdsDeduped = useMemo(() => {
    const uniq = Array.from(new Set(selectedIds));
    return uniq.slice(0, 3);
  }, [selectedIds]);

  const canContinue = selectedIdsDeduped.length > 0;

  useEffect(() => {
    if (!showPrompt) return;
    promptRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showPrompt]);

  const handleCardClick = (eventId: number, disabled: boolean) => {
    if (disabled) return;

    if (mode === "single") {
      setSelectedIds([eventId]);
      setShowPrompt(true);
      return;
    }

    // multi
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
    router.push(`/order/${primaryId}?bundleEventIds=${selectedIdsDeduped.join(",")}`);
  };

  return (
    <>
      {showPrompt && mode === "single" && (
        <div
          ref={promptRef}
          className="mb-6 p-4 bg-gray-100 rounded-lg sticky top-2 z-20"
          dir="rtl"
        >
          <div className="font-bold text-secondary">
            רוצים להוזיל את המחיר וליהנות משני אירועים?
          </div>
          <div className="mt-3 flex gap-3 flex-row-reverse flex-wrap">
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
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="רשימת משחקים קרובים">
        {events.map((evt) => {
          const hasAvailableTickets = (evt.tickets_and_rates || []).some(
            (t) => t?.available !== false
          );
          const computedSold = !hasAvailableTickets || evt.tags === "Sold";
          const isSelected = selectedIdsDeduped.includes(evt.id);

          // Mondial bundles are flight + ticket (no hotel)
          const minAvailableTicketPrice = (() => {
            const available = (evt.tickets_and_rates || []).filter(
              (t) => t?.available !== false
            );
            return available.length > 0
              ? Math.min(...available.map((t) => t.price))
              : 0;
          })();
          const displayedPricePerPerson =
            evt.base_flight_price +
            minAvailableTicketPrice +
            Number(process.env.NEXT_PUBLIC_MARKUP || "175");

          return (
            <div key={evt.id} role="listitem" aria-label={computedSold ? "משחק - אזל מהמלאי" : "בחירת משחק"}>
              <EventButton event={evt} eventPriceOverride={displayedPricePerPerson}>
                <button
                  type="button"
                  disabled={computedSold}
                  onClick={() => handleCardClick(evt.id, computedSold)}
                  className={
                    computedSold
                      ? "cursor-default w-full text-left"
                      : "cursor-pointer w-full text-left"
                  }
                >
                  <div
                    className={
                      "rounded-lg shadow-lg flex flex-row-reverse sm:flex-col hover:shadow-xl hover:outline hover:outline-main" +
                      (isSelected ? " outline outline-main" : "")
                    }
                  >
                    <div
                      className="relative group overflow-hidden rounded-l-lg sm:rounded-t-lg sm:rounded-b-none w-[48%] sm:w-auto"
                      dir="rtl"
                    >
                      {evt.tags === "LastTickets" && !computedSold && (
                        <div
                          className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5"
                          aria-label="כרטיסים אחרונים"
                        >
                          כרטיסים אחרונים!
                        </div>
                      )}
                      {evt.tags === "Popular" && !computedSold && (
                        <div
                          className="absolute top-0 left-0 w-64 h-10 bg-secondary text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5"
                          aria-label="אירוע פופולרי"
                        >
                          נמכר במהירות!
                        </div>
                      )}
                      {evt.tags === "Restock" && !computedSold && (
                        <div
                          className="absolute top-0 left-0 w-64 h-10 bg-[#52C4A3] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5"
                          aria-label="חזר למלאי"
                        >
                          חזר למלאי!
                        </div>
                      )}
                      {evt.tags === "VIPevent" && !computedSold && (
                        <div
                          className="absolute top-0 left-0 w-64 h-10 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5"
                          aria-label="חבילת VIP זמינה"
                        >
                          אירוח VIP
                        </div>
                      )}
                      {evt.tags === "VIPavailable" && !computedSold && (
                        <div
                          className="absolute top-0 left-0 w-64 h-10 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5"
                          aria-label="אופציית VIP זמינה"
                        >
                          אופציית VIP
                        </div>
                      )}
                      {computedSold && (
                        <div className="absolute top-0 left-0 w-64 h-10 bg-[#d63a59] text-white font-bold text-lg transform -translate-x-16 translate-y-7 rotate-[-45deg] flex items-center justify-center z-10 pr-5">
                          אזלו הכרטיסים
                        </div>
                      )}
                      <Image
                        src={evt.card_image_url}
                        alt={evt.name}
                        priority={true}
                        width={400}
                        height={300}
                        style={{ objectPosition: "center top" }}
                        className="object-cover w-full h-72 transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-col text-center w-[52%] sm:w-auto">
                      <div className="p-2" style={{ lineHeight: "1.1" }}>
                        {(() => {
                          const prefix = getMondial2026MatchPrefix(evt.name);
                          const parsed = parseMondial2026EventName(evt.name);
                          const title = parsed.isMondial2026
                            ? (parsed.teamsTitle || evt.name)
                            : evt.name;
                          return prefix ? (
                            <>
                              <div className="text-sm font-medium text-muted-foreground">{prefix}</div>
                              <div className="text-2xl font-bold">{title}</div>
                            </>
                          ) : (
                            <div className="text-2xl font-bold">{title}</div>
                          );
                        })()}
                      </div>
                      <div className="py-1 px-2 bg-secondary font-semibold text-white flex flex-wrap justify-center items-center">
                        <span>
                          {evt.date ? dayjs(evt.date).format("DD/MM/YYYY") : "תאריך יפורסם בקרוב"}
                        </span>
                        <span className="sm:inline hidden mx-2">|</span>
                        <span className="w-full sm:w-auto whitespace-nowrap">{evt.location.name}</span>
                      </div>
                      <div className="p-2 text-center flex flex-col flex-grow">
                        <div className="text-sm sm:text-base">מחיר חבילה ממוצע לאדם</div>
                        <div className="text-2xl font-extrabold">
                          $
                          {displayedPricePerPerson.toLocaleString("en-US")}
                        </div>
                        <div className="flex-grow min-h-[4px]"></div>
                        <div className="text-[14px]" style={{ lineHeight: "1.1" }}>
                          לנוסע, עבור טיסה וכרטיס לאירוע
                        </div>
                        {evt.tags === "Sold" ? (
                          <div className="my-2 py-2 flex-shrink-0 h-[22px] sm:h-[40px]"></div>
                        ) : (
                          <>
                            <div className="bg-[#002240] text-[14px] font-bold mx-1 my-2 justify-center text-white rounded-lg px-4 py-2 flex items-center sm:hidden">
                              הוזילו או שדרגו כאן {"  >"}
                            </div>
                            <u className="my-2 flex justify-center text-[#178189] text-[14px] font-bold hidden sm:flex">
                              הוזילו או שדרגו כאן {"  >"}
                            </u>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </EventButton>
            </div>
          );
        })}
      </div>

      {showPrompt && mode === "single" && (
        <div />
      )}

      {mode === "multi" && (
        <div className="mt-6 flex flex-col gap-3" dir="rtl">
          <div className="text-secondary font-semibold">
            בחרו עד 3 אירועים (ניתן לבחור/לבטל בחירה)
          </div>
          <div>
            <Button type="button" disabled={!canContinue} onClick={continueMulti}>
              המשך להזמנה
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
