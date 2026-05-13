"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle, Loader2 } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";
import type { EventTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";
import { MONDIAL_2026_MAIN_TITLE, parseMondial2026EventName } from "@/lib/mondial2026Title";
import { TixstockDynamicMap } from "@/components/TixstockDynamicMap";
import {
  eventTicketToListing,
  type TixStockListing,
  type TixStockMatchableListing,
} from "@/lib/tixstock-map";

export const TicketSelection = () => {
  const {
    setEventTicket,
    setEvent,
    event,
    eventTicket,
    selectedEvents,
    setSelectedEvents,
    activeTicketEventIndex,
    setActiveTicketEventIndex,
    selectedEventTickets,
    setSelectedEventTickets,
  } = useContext(OrderContext);
  const eventRef = useRef(event);
  const selectedEventsRef = useRef(selectedEvents);
  const activeEventRef = useRef<typeof event>(undefined);
  //const searchParams = useSearchParams();
  const isDebugMode = false; //searchParams.get("debug") === "1";
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );
  const [hoveredTicket, setHoveredTicket] = useState<TixStockMatchableListing | null>(null);
  /** IDs of tickets whose category+section match something on the SVG map */
  const [matchedTicketIds, setMatchedTicketIds] = useState<Set<string> | null>(null);

  const effectiveEvents = selectedEvents && selectedEvents.length > 0
    ? selectedEvents
    : (event ? [event] : []);
  const activeEvent = effectiveEvents[activeTicketEventIndex];
  const activeEventId = activeEvent?.id;

  const MAX_TICKETS = 9;

  /** Is this a TixStock dynamic-map event? */
  const isTxEvent = activeEvent?.type === "tx_event";

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  useEffect(() => {
    selectedEventsRef.current = selectedEvents;
  }, [selectedEvents]);

  useEffect(() => {
    activeEventRef.current = activeEvent;
  }, [activeEvent]);

  // Consider only tickets that are available (t.available !== false). If "available" is undefined, treat as available.
  const availableTickets: EventTicket[] = useMemo(
    () => {
      const tickets = getAvailableTickets(activeEvent);
      const filteredOut = (activeEvent?.tickets_and_rates || []).length - tickets.length;
      
      if (filteredOut > 0) {
        console.log(`[TicketSelection] Filtered out ${filteredOut} unavailable ticket(s) for event ${activeEvent?.id}`);
      }
      
      return tickets;
    },
    [activeEvent]
  );

  // Always compute base ticket price from the CURRENT active event.
  // This prevents stale or cross-event basePrice when switching between bundled events.
  const baseTicketPrice = useMemo(() => {
    if (!availableTickets || availableTickets.length === 0) return 0;
    return availableTickets.reduce(
      (min, ticket) => (ticket.price < min ? ticket.price : min),
      availableTickets[0].price
    );
  }, [availableTickets]);

  /* ── TixStock live pricing (tx_event only) ────────────────── */
  const [liveListings, setLiveListings] = useState<TixStockListing[]>([]);
  const [isLoadingLiveTickets, setIsLoadingLiveTickets] = useState(false);

  // Resolve the TixStock event id from the first ticket carrying an `eid`.
  const tixEventId = useMemo(
    () => availableTickets.find((t) => t.eid)?.eid ?? null,
    [availableTickets],
  );

  // Fetch live listings once we know the TixStock event id.
  useEffect(() => {
    if (!isTxEvent || !tixEventId) {
      setLiveListings([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setIsLoadingLiveTickets(true);
      try {
        const currentActiveEvent = activeEventRef.current;
        const params = new URLSearchParams({
          event_id: tixEventId,
          _: String(Date.now()),
        });
        if (currentActiveEvent?.id) {
          params.set("db_event_id", String(currentActiveEvent.id));
        }
        if (currentActiveEvent?.tx_excluded_sections?.length) {
          params.set("excluded_sections", currentActiveEvent.tx_excluded_sections.join(","));
        }
        const res = await fetch(`/api/tixstock/tickets?${params.toString()}`, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const listings: TixStockListing[] = json?.data?.data ?? [];
        const updatedTicketsAndRates: EventTicket[] | null =
          json?.tickets_and_rates ?? null;
        if (!cancelled) {
          console.log(
            `[TixStock] Fetched ${listings.length} live listings for event ${tixEventId}`,
          );
          setLiveListings(listings);
          if (currentActiveEvent && updatedTicketsAndRates?.length) {
            const updatedEvent = {
              ...currentActiveEvent,
              tickets_and_rates: updatedTicketsAndRates,
            };

            if (eventRef.current?.id === currentActiveEvent.id) {
              setEvent({
                ...eventRef.current,
                tickets_and_rates: updatedTicketsAndRates,
              });
            }

            if (selectedEventsRef.current?.length) {
              setSelectedEvents((prev) =>
                prev.map((selectedEvent) =>
                  selectedEvent.id === currentActiveEvent.id
                    ? updatedEvent
                    : selectedEvent,
                ),
              );
            }
          }
        }
      } catch (err) {
        console.error("[TixStock] Failed to fetch live listings:", err);
        if (!cancelled) setLiveListings([]);
      } finally {
        if (!cancelled) setIsLoadingLiveTickets(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isTxEvent, tixEventId, activeEventId, setEvent, setSelectedEvents]);

  /**
   * Find the cheapest live listing in `category` that can satisfy `qty`.
   * For a single ticket, allow only true singles or fully splittable listings.
   * Returns the rounded-up USD price, or null when no listing qualifies.
   */
  const getLivePriceForCategory = useMemo(() => {
    if (!isTxEvent || liveListings.length === 0) {
      return (): number | null => null;
    }
    return (category: string, qty: number): number | null => {
      const norm = category.trim().toLowerCase();
      const qualifying = liveListings.filter((l) => {
        const listingCat = l.seat_details?.category?.trim().toLowerCase();
        if (listingCat !== norm) return false;
        const qtyAvail = l.number_of_tickets_for_sale?.quantity_available ?? 0;
        const splitQty = l.number_of_tickets_for_sale?.split_quantity ?? 0;
        if (qty === 1) return qtyAvail === 1 || qtyAvail === splitQty;
        return qtyAvail >= qty || splitQty >= qty;
      });
      if (qualifying.length === 0) return null;
      const cheapest = qualifying.reduce((min, l) => {
        const a = parseFloat(l.proceed_price?.amount ?? "Infinity");
        const b = parseFloat(min.proceed_price?.amount ?? "Infinity");
        return a < b ? l : min;
      }, qualifying[0]);
      const amount = parseFloat(cheapest.proceed_price?.amount ?? "NaN");
      return Number.isFinite(amount) ? Math.ceil(amount) : null;
    };
  }, [isTxEvent, liveListings]);

  /**
   * `availableTickets` with prices overridden by the live API for the
   * current quantity.  Categories that cannot satisfy the requested
   * quantity are filtered out entirely.
   */
  const ticketsWithLivePrices: EventTicket[] = useMemo(() => {
    if (!isTxEvent || liveListings.length === 0) return availableTickets;
    return availableTickets.reduce<EventTicket[]>((acc, ticket) => {
      const livePrice = getLivePriceForCategory(
        ticket.category,
        numberOfEventTickets,
      );
      if (livePrice === null) return acc; // hide categories that can't fulfil qty
      acc.push({ ...ticket, price: livePrice });
      return acc;
    }, []);
  }, [
    isTxEvent,
    liveListings,
    availableTickets,
    numberOfEventTickets,
    getLivePriceForCategory,
  ]);

  /** Effective ticket list: live-priced for tx_event, raw otherwise. */
  const effectiveTickets: EventTicket[] = isTxEvent
    ? ticketsWithLivePrices
    : availableTickets;

  useEffect(() => {
    if (!activeEvent) return;

    const existingSelection = selectedEventTickets?.[activeEvent.id];
    if (existingSelection?.id) {
      const refreshedTicket = effectiveTickets.find(
        (ticket) => ticket.id === existingSelection.id,
      );
      const updatedSelection = refreshedTicket
        ? {
            ...existingSelection,
            vendor: refreshedTicket.vendor,
            category: refreshedTicket.category,
            price: refreshedTicket.price,
            description: refreshedTicket.description,
          }
        : existingSelection;

      setSelectedTicket(updatedSelection.id);
      setEventTicket({
        ...updatedSelection,
        quantity: numberOfEventTickets,
      });

      if (refreshedTicket && refreshedTicket.price !== existingSelection.price) {
        setSelectedEventTickets((prev) => ({
          ...prev,
          [activeEvent.id]: {
            ...updatedSelection,
            quantity: numberOfEventTickets,
          },
        }));
      }
      return;
    }

    if (!effectiveTickets || effectiveTickets.length === 0) {
      // No tickets available; clear selection, cheapest ticket, AND the event ticket in context
      console.log('No available tickets found - clearing all ticket state');
      setSelectedTicket(undefined);
      // CRITICAL FIX: Clear the eventTicket in context to prevent stale data
      setEventTicket({
        id: "",
        vendor: "",
        category: "",
        price: 0,
        description: "",
        quantity: 0,
      });
      return;
    }

    const cheapt = effectiveTickets.reduce<EventTicket>((min, ticket) =>
      ticket.price < min.price ? ticket : min,
      effectiveTickets[0]
    );

    console.log(`Auto-selecting cheapest ticket: ${cheapt.category} (ID: ${cheapt.id}, available: ${cheapt.available})`);

    // If the currently-selected ticket is still in the effective (live-priced) list,
    // keep it selected and refresh price/qty. Otherwise auto-select the cheapest.
    const stillSelected = effectiveTickets.find((t) => t.id === selectedTicket);
    const chosen = stillSelected ?? cheapt;
    const ticketPayload = {
      id: chosen?.id || "",
      vendor: chosen?.vendor || "",
      category: chosen?.category || "",
      price: chosen?.price || 0,
      description: chosen?.description || "",
      quantity: numberOfEventTickets,
    };

    if (!stillSelected) {
      setSelectedTicket(chosen?.id);
    }
    setEventTicket(stillSelected ? { ...eventTicket, ...ticketPayload } : ticketPayload);

    if (activeEvent?.id) {
      setSelectedEventTickets((prev) => ({
        ...prev,
        [activeEvent.id]: {
          ...ticketPayload,
          quantity: numberOfEventTickets,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent, effectiveTickets, numberOfEventTickets, setEventTicket, setSelectedEventTickets]);

  useEffect(() => {
    if (matches) return; // Don't scroll on desktop (1024px+)
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth",
      });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, [matches]); // Add matches as dependency

  const handleTicketSelect = useCallback((ticket: {
    id: string;
    category: string;
    price: number;
    vendor?: string;
    description?: string;
  }) => {
    // Defensive: ensure the selected ticket is still in the effective list
    // (i.e. available AND, for tx_events, satisfies the current quantity).
    const ticketInList = effectiveTickets.find((t) => t.id === ticket.id);
    if (!ticketInList) {
      console.warn(`Attempted to select unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }

    if (ticketInList.available === false) {
      console.warn(`Ticket is marked as unavailable: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }

    setEventTicket({
      ...ticket,
      // Always use the live-resolved price from the effective list, not the
      // (possibly stale) price the caller passed in.
      price: ticketInList.price,
      description: ticket.description || "",
      quantity: numberOfEventTickets,
    });
    if (activeEvent?.id) {
      setSelectedEventTickets((prev) => ({
        ...prev,
        [activeEvent.id]: {
          ...ticket,
          price: ticketInList.price,
          description: ticket.description || "",
          quantity: numberOfEventTickets,
        },
      }));
    }
    setSelectedTicket(ticket.id);
  }, [activeEvent?.id, effectiveTickets, numberOfEventTickets, setEventTicket, setSelectedEventTickets]);

  const handleQuantityChange = (value: number | string) => {
    if (+value > MAX_TICKETS) {
      setErrorMessage("ניתן לרכוש עד 9 כרטיס בשלב זה");
      return;
    }
    setErrorMessage("");
    setNumberOfEventTickets(+value);
  };

  // ── TixStock helpers ──────────────────────────────────────────

  /** Convert EventTickets → TixStockListings for map consumption */
  const tixStockListings: TixStockMatchableListing[] = useMemo(
    () => effectiveTickets.map(eventTicketToListing),
    [effectiveTickets],
  );

  /** Stable callback for TixstockDynamicMap — clicking a section selects
   *  the best matching ticket, just like clicking it in the list. */
  const handleMapTicketSelect = useCallback(
    (ticketId: string) => {
      const ticket = effectiveTickets.find((t) => t.id === ticketId);
      if (ticket) {
        handleTicketSelect({
          id: ticket.id,
          price: ticket.price,
          category: ticket.category,
          vendor: ticket.vendor,
          description: ticket.description,
        });
      }
    },
    [effectiveTickets, handleTicketSelect],
  );

  /** Stable callback — receives the set of ticket IDs that match the map.
   *  Only triggers a state update if the actual IDs changed. */
  const handleMatchedTicketIds = useCallback(
    (ids: Set<string>) => {
      setMatchedTicketIds((prev) => {
        if (prev && prev.size === ids.size && [...ids].every((id) => prev.has(id))) {
          return prev; // identical content → keep old reference, skip re-render
        }
        return ids;
      });
    },
    [],
  );

  /** Map the filtered TixStock listings back to EventTickets */
  const displayedTickets: EventTicket[] = useMemo(() => {
    if (!isTxEvent) return effectiveTickets;

    // Remove tickets that don't match any section/category on the map
    if (matchedTicketIds) {
      return effectiveTickets.filter((t) => matchedTicketIds.has(t.id));
    }

    return effectiveTickets;
  }, [isTxEvent, effectiveTickets, matchedTicketIds]);

  /* ── Debug panel ──────────────────────────────────────────────── */
  const debugPanel = isDebugMode && isTxEvent && (
    <details
      open
      className="mt-4 rounded-lg border border-yellow-400 bg-yellow-50 p-3 text-xs font-mono"
      dir="ltr"
    >
      <summary className="cursor-pointer font-bold text-yellow-800 text-sm mb-2">
        🐛 Debug: Live TixStock listings ({liveListings.length})
      </summary>
      {isLoadingLiveTickets ? (
        <p className="text-yellow-700">Loading…</p>
      ) : liveListings.length === 0 ? (
        <p className="text-yellow-700">No live listings fetched.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-yellow-300 text-yellow-900">
                <th className="pr-3 py-1">ID</th>
                <th className="pr-3 py-1">Category</th>
                <th className="pr-3 py-1">Section</th>
                <th className="pr-3 py-1">Row</th>
                <th className="pr-3 py-1">Qty avail</th>
                <th className="pr-3 py-1">Split qty</th>
                <th className="pr-3 py-1">Price</th>
                <th className="pr-3 py-1">Restrictions / benefits</th>
              </tr>
            </thead>
            <tbody>
              {liveListings.map((l) => {
                const restrictionOptions = l.restrictions_benefits?.options ?? [];
                const restrictionText =
                  restrictionOptions.length > 0
                    ? restrictionOptions
                        .map((opt) =>
                          typeof opt === "string"
                            ? opt
                            : `${(opt as { name?: string })?.name ?? ""}: ${(opt as { value?: string })?.value ?? ""}`
                        )
                        .join(", ")
                    : l.restrictions_benefits?.other || "—";
                return (
                  <tr key={l.id} className="border-b border-yellow-200 even:bg-yellow-100">
                    <td className="pr-3 py-1 text-yellow-700">{l.id}</td>
                    <td className="pr-3 py-1">{l.seat_details?.category ?? "—"}</td>
                    <td className="pr-3 py-1">{l.seat_details?.section ?? "—"}</td>
                    <td className="pr-3 py-1">{l.seat_details?.row ?? "—"}</td>
                    <td className="pr-3 py-1 text-center">
                      {l.number_of_tickets_for_sale?.quantity_available ?? "—"}
                    </td>
                    <td className="pr-3 py-1 text-center">
                      {l.number_of_tickets_for_sale?.split_quantity ?? "—"}
                    </td>
                    <td className="pr-3 py-1 font-semibold">
                      {l.proceed_price?.amount ?? "—"} {l.proceed_price?.currency ?? ""}
                    </td>
                    <td className="pr-3 py-1 max-w-[220px] break-words">{restrictionText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );

  return (
    <div>
      <div className="sr-only">
        <h1>בחירת כרטיסים לאירוע {activeEvent?.name || event?.name}</h1>
        <p>
          בחר כמות וקטגוריית כרטיסים עבור האירוע ב{activeEvent?.location?.name || event?.location?.name}
        </p>
      </div>

      {effectiveEvents.length > 1 && activeEvent && (
        <div dir="rtl" className="mb-3">
          <div className="text-sm font-semibold text-secondary">
            בחירת כרטיסים: אירוע {activeTicketEventIndex + 1} מתוך {effectiveEvents.length}
          </div>
          <div className="flex flex-wrap gap-2 mt-2" dir="rtl">
            {effectiveEvents.map((e, idx) => {
              const parsed = parseMondial2026EventName(e.name);
              const buttonLabel = parsed.isMondial2026
                ? (parsed.teamsTitle || e.name)
                : e.name;

              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setActiveTicketEventIndex(idx)}
                  className={
                    idx === activeTicketEventIndex
                      ? "bg-main text-white px-3 py-1 rounded-lg text-sm font-bold"
                      : "bg-gray-200 text-secondary px-3 py-1 rounded-lg text-sm font-semibold"
                  }
                  aria-label={`בחירת אירוע ${e.name}`}
                >
                  {buttonLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            {(() => {
              const headerEvent = activeEvent || event;
              const parsed = parseMondial2026EventName(headerEvent?.name);
              return parsed.isMondial2026 ? (
                <EventDataHeader
                  event={headerEvent}
                  titleOverride={MONDIAL_2026_MAIN_TITLE}
                  subtitleOverride={parsed.teamsTitle}
                />
              ) : (
                <EventDataHeader event={headerEvent} />
              );
            })()}
          </div>
        </div>
      </div>
      {debugPanel}
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 text-lg">
          בחרו כמות כרטיסים וקטגוריה מועדפת,
          {isTxEvent ? <span className="font-bold"> ישיבה בזוגות/שלשות מובטחת.</span> : <span className="font-bold"> ישיבה בזוגות מובטחת.</span>}
        </div>
        <div className="flex gap-4 flex-col lg:flex-row-reverse mt-4">
          {isTxEvent ? (
            /* ── TixStock dynamic SVG map ──────────────────────── */
            <>
              <div className="w-full lg:hidden">
                <TixstockDynamicMap
                  mapUrl={event?.map_image_url || ""}
                  tickets={tixStockListings}
                  hoveredTicket={hoveredTicket}
                  selectedTicketId={selectedTicket ?? null}
                  onTicketSelect={handleMapTicketSelect}
                  onMatchedTicketIds={handleMatchedTicketIds}
                  excludedSections={event?.tx_excluded_sections}
                />
              </div>
              <div className="lg:w-[45%] hidden lg:block">
                <TixstockDynamicMap
                  mapUrl={event?.map_image_url || ""}
                  tickets={tixStockListings}
                  hoveredTicket={hoveredTicket}
                  selectedTicketId={selectedTicket ?? null}
                  onTicketSelect={handleMapTicketSelect}
                  onMatchedTicketIds={handleMatchedTicketIds}
                  excludedSections={event?.tx_excluded_sections}
                />
              </div>
            </>
          ) : (
            /* ── Legacy static image map (mondial: use activeEvent for multi-event bundles) ── */
            <>
              <Spoiler
                className="w-full lg:hidden flex justify-center"
                style={{ margin: 0 }}
                maxHeight={90}
                showLabel={<ChevronDownCircle fill="black" width={"100%"} aria-label="הרחב מפת האירוע" />}
                controlRef={(ref) => {
                  ref?.setAttribute(
                    "style",
                    "left: 50%; transform: translate(-50%, -120%); color: white;"
                  );
                  ref?.setAttribute("aria-label", "הרחב מפת האירוע");
                }}
                hideLabel={<ChevronUpCircle fill="black" width={"100%"} aria-label="כווץ מפת האירוע" />}
              >
                <Image
                  className="rounded-lg"
                  width={600}
                  height={600}
                  priority={true}
                  src={activeEvent?.map_image_url || event?.map_image_url || ""}
                  alt={`מפת אירוע ${activeEvent?.name || event?.name || "לא ידוע"} - מיקומי הישיבה`}
                />
              </Spoiler>
              <div className="lg:w-[45%] hidden lg:block">
                <Image
                  className="rounded-lg w-auto h-auto w-full"
                  width={600}
                  height={600}
                  priority={true}
                  src={activeEvent?.map_image_url || event?.map_image_url || ""}
                  alt={`מפת אירוע ${activeEvent?.name || event?.name || "לא ידוע"} - מיקומי הישיבה ובלוקים`}
                />
              </div>
            </>
          )}
          <div className="w-full lg:w-[55%]" dir="ltr">
            <ScrollArea h={"60vh"}>
              {errorMessage && (
                <Text c="red" ta="right" mb="xs" role="alert" aria-live="polite">
                  {errorMessage}
                </Text>
              )}
              <div
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="ticket-selection-heading"
              >
                <div id="ticket-selection-heading" className="sr-only">
                  קטגוריות כרטיסים זמינות
                </div>
                {isTxEvent && isLoadingLiveTickets ? (
                  <div className="flex items-center justify-center p-8 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <Text size="sm" c="dimmed">
                      טוען מחירים עדכניים...
                    </Text>
                  </div>
                ) : effectiveTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                    <Text size="xl" fw={700} c="red" aria-live="polite">
                      אין כרטיסים זמינים כרגע
                    </Text>
                    <Text size="md" c="dimmed">
                      {isTxEvent && availableTickets.length > 0
                        ? `אין קטגוריות שיכולות לספק ${numberOfEventTickets} כרטיסים יחד. נסו להפחית את הכמות.`
                        : "כל הכרטיסים לאירוע זה אזלו או אינם זמינים למכירה."}
                    </Text>
                    <Text size="sm" c="dimmed">
                      אנא נסו אירוע אחר או צרו קשר עם שירות הלקוחות לקבלת עזרה.
                    </Text>
                  </div>
                ) : (
                  [...displayedTickets]
                    .sort((a: EventTicket, b: EventTicket) => a.price - b.price)
                    .filter((ticket: EventTicket) => {
                      // Double-check: ensure ticket is still available before rendering
                      if (ticket.available === false) {
                        console.warn(`Attempted to render unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
                        return false;
                      }
                      return true;
                    })
                    .map((ticket: EventTicket, index: number) => (
                      <EventTicketCard
                        index={index}
                        onClick={() =>
                            handleTicketSelect({
                              id: ticket.id,
                              price: ticket.price,
                              category: ticket.category,
                              vendor: ticket.vendor,
                              description: ticket.description,
                            })
                        }
                        numberOfTickets={numberOfEventTickets}
                        onChangeNumberOfTickets={handleQuantityChange}
                        key={ticket.id}
                        category={ticket.category}
                        categoryDescription={ticket.description}
                        colorOnTheMap={ticket.colorOnTheMap || ""}
                        isSelected={selectedTicket === ticket.id}
                        price={ticket.price}
                        basePrice={baseTicketPrice}
                        vip={ticket.vip}
                        onMouseEnter={
                          isTxEvent
                            ? () =>
                                setHoveredTicket(
                                  eventTicketToListing(ticket)
                                )
                            : undefined
                        }
                        onMouseLeave={
                          isTxEvent
                            ? () => setHoveredTicket(null)
                            : undefined
                        }
                      />
                    ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
