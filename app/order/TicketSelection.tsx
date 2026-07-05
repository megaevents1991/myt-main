"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle, Loader2 } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";
import type { Event, EventTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";
import { TixstockDynamicMap } from "@/components/TixstockDynamicMap";
import {
  eventTicketToListing,
  type TixStockListing,
  type TixStockMatchableListing,
} from "@/lib/tixstock-map";


export const TicketSelection = ({ initialEvent }: { initialEvent?: Event }) => {
  const { setEventTicket, event, setEvent, setCurrentMinTicketPrice, artistSlug } = useContext(OrderContext);
  // Context `event` is only populated client-side (useEffect in OrderPageClient),
  // so it's empty during SSR. Fall back to the server-provided `initialEvent`
  // so the header — including the <h1> — renders real HTML in the initial
  // response (SEO). Same data, so no visual change or hydration mismatch.
  const headerEvent = event ?? initialEvent;
  const eventRef = useRef(event);
  const isDebugMode = useSearchParams().get("debug") === "true";
  const [errorMessage, setErrorMessage] = useState("");
  const [cheapestTicket, setCheapestTicket] = useState<EventTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );
  const [hoveredTicket, setHoveredTicket] = useState<TixStockMatchableListing | null>(null);
  /** IDs of tickets whose category+section match something on the SVG map */
  const [matchedTicketIds, setMatchedTicketIds] = useState<Set<string> | null>(null);

  const MAX_TICKETS = 9;

  /** Is this a TixStock dynamic-map event? */
  const isTxEvent = event?.type === "tx_event";

  const { numberOfEventTickets, setNumberOfEventTickets, setPlaneTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  // Consider only tickets that are available (t.available !== false). If "available" is undefined, treat as available.
  const availableTickets: EventTicket[] = useMemo(
    () => {
      const tickets = getAvailableTickets(event);
      const filteredOut = (event?.tickets_and_rates || []).length - tickets.length;
      
      if (filteredOut > 0) {
        console.log(`[TicketSelection] Filtered out ${filteredOut} unavailable ticket(s) for event ${event?.id}`);
      }
      
      return tickets;
    },
    [event]
  );

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
        const currentEvent = eventRef.current;
        const params = new URLSearchParams({
          event_id: tixEventId,
          ticket_quantity: String(numberOfEventTickets),
          _: String(Date.now()),
        });
        if (currentEvent?.id) {
          params.set("db_event_id", String(currentEvent.id));
        }
        if (event?.tx_excluded_sections?.length) {
          params.set("excluded_sections", event.tx_excluded_sections.join(","));
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
          if (currentEvent && updatedTicketsAndRates?.length) {
            setEvent({
              ...currentEvent,
              tickets_and_rates: updatedTicketsAndRates,
            });
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
  }, [isTxEvent, tixEventId, event?.tx_excluded_sections, numberOfEventTickets, setEvent]);

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
    if (!effectiveTickets || effectiveTickets.length === 0) {
      // No tickets available; clear selection, cheapest ticket, AND the event ticket in context
      console.log('No available tickets found - clearing all ticket state');
      setCheapestTicket(null);
      setSelectedTicket(undefined);
      setCurrentMinTicketPrice(0);
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

    setCheapestTicket(cheapt);

    setCurrentMinTicketPrice(cheapt.price);
    setSelectedTicket(cheapt.id);
    setEventTicket({
      id: cheapt.id,
      vendor: cheapt.vendor || "",
      category: cheapt.category,
      price: cheapt.price,
      description: cheapt.description || "",
      quantity: numberOfEventTickets,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTickets, numberOfEventTickets, setCurrentMinTicketPrice, setEventTicket]);

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
    setSelectedTicket(ticket.id);
  }, [effectiveTickets, numberOfEventTickets, setEventTicket]);

  const handleQuantityChange = (value: number | string) => {
    if (+value > MAX_TICKETS) {
      setErrorMessage("ניתן לרכוש עד 9 כרטיס בשלב זה");
      return;
    }
    setErrorMessage("");
    setNumberOfEventTickets(+value);
    // Keep traveler count (flights + hotel) in sync with the chosen party size.
    // Without this, the hotel search defaults to 2 guests when the flight step
    // is skipped (skip-flight events), under-booking the room.
    setPlaneTickets({ adults: +value, children: 0 });
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
        <p>בחר כמות וקטגוריית כרטיסים עבור האירוע ב{headerEvent?.location?.name}</p>
      </div>
      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-muted ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader
              event={headerEvent}
              artistHref={artistSlug ? `/artists/${artistSlug}` : undefined}
            />
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
            /* ── Legacy static image map ──────────────────────── */
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
                  className="rounded-lg w-full h-auto max-h-[45svh] lg:max-h-[calc(100vh-10rem)] object-contain"
                  width={600}
                  height={600}
                  priority={true}
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה`}
                />
              </Spoiler>
              <div className="lg:w-[45%] hidden lg:block">
                <Image
                  className="rounded-lg w-full h-auto max-h-[calc(100vh-10rem)] object-contain"
                  width={600}
                  height={600}
                  priority={true}
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה ובלוקים`}
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
                        useMapColor={!isTxEvent}
                        isSelected={selectedTicket === ticket.id}
                        price={ticket.price}
                        basePrice={cheapestTicket?.price ?? 0}
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
