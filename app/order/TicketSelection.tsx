"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle, Loader2 } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { OrderIssueState } from "@/components/ui/OrderIssueState";
import { useMediaQuery } from "@mantine/hooks";
import type { Event, EventTicket, EventType, OrderTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";
import { supplierEventId, ticketSupplier } from "@/lib/suppliers";
import type { LiveTicketsOffer } from "@/lib/livetickets";
import {
  bestPriceTicketIds,
  orderTicketId,
  priceTicketsForQuantity,
  withoutTwins,
  zoneOffers,
  type PricedTicket,
  type SupplierLiveData,
  type SupplierStatus,
  type ZoneOffer,
} from "@/lib/supplier-offers";
import { TixstockDynamicMap } from "@/components/TixstockDynamicMap";
import {
  eventTicketToListing,
  type TixStockListing,
  type TixStockMatchableListing,
} from "@/lib/tixstock-map";

// Safety buffer applied to the static DB price ONLY when live TixStock pricing
// is unavailable, so an outage never makes us sell below the live price.
const TX_FALLBACK_BUFFER_PCT = Number(
  process.env.NEXT_PUBLIC_TX_FALLBACK_BUFFER_PCT ?? "15",
);
const TX_FALLBACK_MULTIPLIER =
  1 + (Number.isFinite(TX_FALLBACK_BUFFER_PCT) ? TX_FALLBACK_BUFFER_PCT : 15) / 100;

/**
 * The ticket as the order carries it. Besides what the customer sees it keeps
 * WHO we buy it from (supplier, that supplier's event id and category name) -
 * on a multi-supplier event ops can no longer infer that from the event.
 */
const toOrderTicket = (
  ticket: PricedTicket,
  eventType: EventType | undefined,
  quantity: number,
  seatingChoice?: OrderTicket["seatingChoice"],
): OrderTicket => ({
  // A together twin is the same ticket bought from a together listing - the
  // order names the real ticket; `seatingChoice` says "together".
  id: orderTicketId(ticket),
  vendor: ticket.vendor || "",
  category: ticket.category,
  price: ticket.price,
  description: ticket.description || "",
  quantity,
  eid: ticket.eid,
  supplier: ticketSupplier(ticket, eventType),
  supplierCategory: ticket.supplierCategory ?? ticket.category,
  zoneLabel: ticket.zoneLabel,
  // Internal: ops confirm this one with the supplier by hand.
  nonInstant: ticket.nonInstant || undefined,
  seatingChoice,
});

/** Short label of a split seating, for the together / split toggle. */
const splitLabel = (ticket: PricedTicket): string => {
  const split = ticket.seatingSplit ?? [];
  const pairs = split.filter((n) => n === 2).length;
  if (split.includes(3)) {
    return pairs === 0 ? "שלשה" : (pairs === 1 ? "זוג" : pairs + " זוגות") + " + שלשה";
  }
  if (pairs > 0) return pairs === 1 ? "זוג" : pairs + " זוגות";
  return "בזוגות/שלשות";
};

/** Customer-facing seating promise of a priced ticket (multi-supplier events). */
const seatingNote = (ticket: PricedTicket): string | undefined => {
  if (ticket.seating === "together") return "ישיבה ביחד מובטחת";
  // Say HOW the party sits, not just the group cap (QA 2026-09-18: five people
  // under "groups of up to 4" were left to guess 4+1). The promise is pairs,
  // plus one triple when the party is odd - never a lone seat.
  if (ticket.seating === "groups" && ticket.seatingSplit?.length) {
    const pairs = ticket.seatingSplit.filter((n) => n === 2).length;
    const triple = ticket.seatingSplit.includes(3);
    const pairsText = pairs === 1 ? "זוג" : pairs + " זוגות";
    return triple
      ? "ישיבה מובטחת: " + pairsText + " + שלשה"
      : "ישיבה בזוגות מובטחת (" + pairsText + ")";
  }
  if (ticket.seating === "groups" && ticket.seatingGroupMax) {
    return "ישיבה יחד בקבוצות של עד " + ticket.seatingGroupMax;
  }
  return undefined;
};

/**
 * Group-order rescue for the "can't supply N tickets together" dead-end:
 * WhatsApp (prefilled) or leave name+phone → lead email to the sales rep via
 * /api/more-events (same channel the homepage "more events" form uses) - we
 * come back with a tailored offer instead of losing a high-value group buyer.
 */
const GroupTicketsInquiry = ({
  eventName,
  eventId,
  quantity,
}: {
  eventName: string;
  eventId?: number;
  quantity: number;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const waText = encodeURIComponent(
    `היי, אני מעוניין ב-${quantity} כרטיסים לאירוע ${eventName} (הזמנה קבוצתית)`,
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.trim().length < 8) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/more-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group_tickets_request",
          event: eventName,
          eventId,
          requestedQuantity: quantity,
          name: name.trim(),
          phone: phone.trim(),
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <Text size="md" fw={700} c="green" role="status">
        קיבלנו את הפרטים! נציג יחזור אליכם בהקדם עם הצעה לקבוצה.
      </Text>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 text-right" dir="rtl">
      <Text size="md" fw={700} mb={4}>
        מזמינים לקבוצה גדולה?
      </Text>
      <Text size="sm" c="dimmed" mb={12}>
        השאירו פרטים ונחזור אליכם עם הצעה משתלמת לקבוצה, או דברו איתנו עכשיו.
      </Text>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם מלא"
          aria-label="שם מלא"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="טלפון"
          aria-label="טלפון"
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {status === "error" && (
          <Text size="xs" c="red" role="alert">
            נא למלא שם וטלפון תקינים ולנסות שוב.
          </Text>
        )}
        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={status === "sending"}
            className="flex-1 rounded-lg bg-main px-4 py-2 text-sm font-bold text-main-foreground transition-colors hover:bg-main/90 disabled:opacity-50"
          >
            {status === "sending" ? "שולח..." : "חזרו אליי עם הצעה"}
          </button>
          <a
            href={`https://wa.me/972542002722?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-forest px-4 py-2 text-center text-sm font-bold text-forest transition-colors hover:bg-forest/5 dark:border-glow dark:text-glow dark:hover:bg-glow/10"
          >
            WhatsApp עכשיו
          </a>
        </div>
      </form>
    </div>
  );
};


/**
 * A supplier that hangs must not hold the step on a spinner: past this the
 * call aborts, that supplier reads "down" and its tickets sell on the buffered
 * DB price (Dor 24.09: "שאם אין כרטיסים לא נישאר על טעינה ארוכה").
 */
const SUPPLIER_TIMEOUT_MS = 20_000;
const supplierTimeout = () =>
  typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(SUPPLIER_TIMEOUT_MS)
    : undefined;

export const TicketSelection = ({ initialEvent }: { initialEvent?: Event }) => {
  const { setEventTicket, event, setEvent, setCurrentMinTicketPrice, personLink, returnToSummary } = useContext(OrderContext);
  // Context `event` is only populated client-side (useEffect in OrderPageClient),
  // so it's empty during SSR. Fall back to the server-provided `initialEvent`
  // so the header - including the <h1> - renders real HTML in the initial
  // response (SEO). Same data, so no visual change or hydration mismatch.
  const headerEvent = event ?? initialEvent;
  const eventRef = useRef(event);
  const isDebugMode = useSearchParams().get("debug") === "true";
  const [errorMessage, setErrorMessage] = useState("");
  /** Quantity the customer ASKED for above MAX_TICKETS - shows the group form. */
  const [overMaxRequest, setOverMaxRequest] = useState<number | null>(null);
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

  const {
    numberOfEventTickets,
    setNumberOfEventTickets,
    setPlaneTickets,
    setFlight,
    setHotel,
  } = useContext(OrderContext);

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

  // Each supplier's own event id, read from THAT supplier's tickets - a mixed
  // event holds a TixStock eid and a LiveTickets eid side by side.
  const tixEventId = useMemo(
    () => supplierEventId(availableTickets, "tixstock", event?.type),
    [availableTickets, event?.type],
  );
  const liveTicketsEventId = useMemo(
    () => supplierEventId(availableTickets, "livetickets", event?.type),
    [availableTickets, event?.type],
  );

  /* ── LiveTickets live pricing (tickets with supplier "livetickets") ── */
  const [liveTicketsOffers, setLiveTicketsOffers] = useState<LiveTicketsOffer[]>([]);
  const [liveTicketsStatus, setLiveTicketsStatus] =
    useState<SupplierStatus>("none");

  // One call per event, not per quantity: the answer carries every category's
  // price and max-per-order, and the route caches it server-side.
  useEffect(() => {
    if (!liveTicketsEventId) {
      setLiveTicketsOffers([]);
      setLiveTicketsStatus("none");
      return;
    }
    let cancelled = false;
    setLiveTicketsStatus("loading");
    const run = async () => {
      try {
        const res = await fetch(
          `/api/livetickets/tickets?eid=${encodeURIComponent(liveTicketsEventId)}`,
          { cache: "no-store", signal: supplierTimeout() },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { offers?: LiveTicketsOffer[] } = await res.json();
        if (cancelled) return;
        setLiveTicketsOffers(json.offers ?? []);
        setLiveTicketsStatus("live");
      } catch (err) {
        console.error("[LiveTickets] Failed to fetch live offers:", err);
        if (cancelled) return;
        setLiveTicketsOffers([]);
        setLiveTicketsStatus("down");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [liveTicketsEventId]);

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
            signal: supplierTimeout(),
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
   * The map hides TixStock tickets it has no section for. Another supplier's
   * ticket is never hidden by it: it reaches the site only once the backoffice
   * mapped it to one of our zones, and a missing drawing must not unsell it.
   */
  const isShownWithMap = useCallback(
    (ticket: EventTicket, matched: Set<string>) =>
      ticketSupplier(ticket, event?.type) !== "tixstock" ||
      matched.has(ticket.id),
    [event?.type],
  );

  /** Does any ticket here get its price from a live supplier call? */
  const hasLiveSupplier = isTxEvent || liveTicketsEventId !== null;

  const supplierLive: SupplierLiveData = useMemo(
    () => ({
      tixstock: {
        status: !isTxEvent
          ? "none"
          : isLoadingLiveTickets
            ? "loading"
            : liveListings.length > 0
              ? "live"
              : "down",
        listings: liveListings,
      },
      livetickets: { status: liveTicketsStatus, offers: liveTicketsOffers },
    }),
    [
      isTxEvent,
      isLoadingLiveTickets,
      liveListings,
      liveTicketsStatus,
      liveTicketsOffers,
    ],
  );

  /**
   * What the customer can buy at the current quantity: every ticket priced by
   * ITS OWN supplier's live answer (lib/supplier-offers.ts). A supplier that is
   * down sells on the buffered DB price - the auto-select effect commits this
   * memo's price straight into the order context, so an unbuffered DB price
   * must never appear here. Tickets that can't fulfil the quantity drop out.
   * Events with no live supplier are returned untouched.
   */
  const effectiveTickets: PricedTicket[] = useMemo(
    () =>
      hasLiveSupplier
        ? priceTicketsForQuantity(
            availableTickets,
            event?.type,
            numberOfEventTickets,
            supplierLive,
            TX_FALLBACK_MULTIPLIER,
          )
        : availableTickets,
    [
      hasLiveSupplier,
      availableTickets,
      event?.type,
      numberOfEventTickets,
      supplierLive,
    ],
  );

  /**
   * Nearest quantity that at least one ticket - of ANY supplier - can still
   * supply. Powers the one-tap "change quantity" rescue when the requested
   * amount can't be fulfilled. Searches downward first (fewer tickets is the
   * cheaper ask), then upward to MAX_TICKETS - so a lone "1 ticket" request on
   * an event whose sellers only split into 2+ still gets a button instead of a
   * dead-end. null when nothing else works.
   */
  const nearestFeasibleQty: { qty: number; direction: "down" | "up" } | null =
    useMemo(() => {
      if (!hasLiveSupplier || effectiveTickets.length > 0) return null;
      const feasible = (q: number) =>
        priceTicketsForQuantity(
          availableTickets,
          event?.type,
          q,
          supplierLive,
          TX_FALLBACK_MULTIPLIER,
        ).length > 0;
      for (let q = numberOfEventTickets - 1; q >= 1; q--) {
        if (feasible(q)) return { qty: q, direction: "down" };
      }
      for (let q = numberOfEventTickets + 1; q <= MAX_TICKETS; q++) {
        if (feasible(q)) return { qty: q, direction: "up" };
      }
      return null;
    }, [
      hasLiveSupplier,
      effectiveTickets.length,
      numberOfEventTickets,
      availableTickets,
      event?.type,
      supplierLive,
    ]);

  /** True when selling on buffered DB price because live TX pricing is down. */
  const usingBufferedFallback =
    isTxEvent &&
    !isLoadingLiveTickets &&
    liveListings.length === 0 &&
    availableTickets.length > 0;

  useEffect(() => {
    if (usingBufferedFallback) {
      console.warn(
        `[TixStock] Live pricing unavailable for event ${event?.id} - selling on buffered DB price (×${TX_FALLBACK_MULTIPLIER}).`,
      );
    }
  }, [usingBufferedFallback, event?.id]);

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

  const handleQuantityChange = (value: number | string) => {
    if (+value > MAX_TICKETS) {
      // 10+ tickets = a group order - instead of just a red wall, offer the
      // group-lead form (details / WhatsApp) with a way back to the picker.
      setErrorMessage("ניתן לרכוש עד 9 כרטיסים באתר");
      setOverMaxRequest(+value);
      return;
    }
    setErrorMessage("");
    setOverMaxRequest(null);
    // Party size changed → any flight/hotel already picked (user navigated back
    // from a later step) was priced for the OLD pax count. Clear them so the
    // customer re-picks and can never pay a stale mismatched price.
    if (+value !== numberOfEventTickets) {
      setFlight(undefined);
      setHotel(undefined);
    }
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

  /** Stable callback - receives the set of ticket IDs that match the map.
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

  /**
   * Every supplier on the page is priced live (or absent). A supplier that is
   * down sells on a buffered DB estimate, and an estimate must neither crown a
   * winner nor hide a real offer.
   */
  const isLiveOrAbsent = (status: SupplierStatus) =>
    status === "none" || status === "live";
  const allSuppliersLive =
    isLiveOrAbsent(supplierLive.tixstock.status) &&
    isLiveOrAbsent(supplierLive.livetickets.status);

  /** Map the filtered TixStock listings back to EventTickets */
  const displayedTickets: ZoneOffer[] = useMemo(() => {
    // Remove tickets that don't match any section/category on the map
    const onMap =
      isTxEvent && matchedTicketIds
        ? effectiveTickets.filter((t) => isShownWithMap(t, matchedTicketIds))
        : effectiveTickets;
    // The same zone from two suppliers: only the cheaper supplier is shown -
    // unless one seats the party together and the other splits it; then one
    // card carries both, with a toggle (zoneOffers).
    return allSuppliersLive
      ? zoneOffers(onMap, event?.type, numberOfEventTickets)
      : withoutTwins(onMap);
  }, [
    isTxEvent,
    effectiveTickets,
    matchedTicketIds,
    isShownWithMap,
    allSuppliersLive,
    event?.type,
    numberOfEventTickets,
  ]);

  /** "together" / "split" when this ticket is one side of a card's toggle. */
  const seatingChoiceOf = useCallback(
    (ticketId: string): OrderTicket["seatingChoice"] => {
      for (const shown of displayedTickets) {
        const options = shown.seatingOptions;
        if (!options) continue;
        if (options.together.id === ticketId) return "together";
        if (options.split.id === ticketId) return "split";
      }
      return undefined;
    },
    [displayedTickets],
  );

  /** Several suppliers on one page - seating promises differ per ticket. */
  const isMultiSupplier = useMemo(
    () =>
      new Set(availableTickets.map((t) => ticketSupplier(t, event?.type)))
        .size > 1,
    [availableTickets, event?.type],
  );

  /**
   * Cheapest offer in every zone that more than one supplier sells. Since the
   * list shows one supplier per zone while everyone is live (above), this only
   * ever badges something if that rule is relaxed again - kept for that day.
   */
  const bestPriceIds = useMemo(
    () =>
      allSuppliersLive
        ? bestPriceTicketIds(displayedTickets, event?.type)
        : new Set<string>(),
    [allSuppliersLive, displayedTickets, event?.type],
  );

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

    // Always built from the effective list - the live-resolved price and the
    // ticket's supplier - never from the (possibly stale) values passed in.
    setEventTicket(
      toOrderTicket(
        ticketInList,
        event?.type,
        numberOfEventTickets,
        seatingChoiceOf(ticketInList.id),
      ),
    );
    setSelectedTicket(ticket.id);
  }, [effectiveTickets, event?.type, numberOfEventTickets, setEventTicket, seatingChoiceOf]);

  /** Stable callback for TixstockDynamicMap - clicking a section selects
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

    // Auto-select from the cards the customer actually SEES: map-matched
    // (picking a hidden, unmapped ticket left no card selected) and one per
    // zone - a together/split card counts as the option it opens on, so the
    // default of that card is what gets pre-selected (zoneOffers).
    const pool =
      displayedTickets.length > 0
        ? displayedTickets
        : withoutTwins(effectiveTickets);

    const cheapt = pool.reduce<PricedTicket>((min, ticket) =>
      ticket.price < min.price ? ticket : min,
      pool[0]
    );

    setCheapestTicket(cheapt);

    setCurrentMinTicketPrice(cheapt.price);
    setSelectedTicket(cheapt.id);
    setEventTicket(
      toOrderTicket(
        cheapt,
        event?.type,
        numberOfEventTickets,
        seatingChoiceOf(cheapt.id),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTickets, displayedTickets, numberOfEventTickets, setCurrentMinTicketPrice, setEventTicket]);

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
                    : l.restrictions_benefits?.other || "-";
                return (
                  <tr key={l.id} className="border-b border-yellow-200 even:bg-yellow-100">
                    <td className="pr-3 py-1 text-yellow-700">{l.id}</td>
                    <td className="pr-3 py-1">{l.seat_details?.category ?? "-"}</td>
                    <td className="pr-3 py-1">{l.seat_details?.section ?? "-"}</td>
                    <td className="pr-3 py-1">{l.seat_details?.row ?? "-"}</td>
                    <td className="pr-3 py-1 text-center">
                      {l.number_of_tickets_for_sale?.quantity_available ?? "-"}
                    </td>
                    <td className="pr-3 py-1 text-center">
                      {l.number_of_tickets_for_sale?.split_quantity ?? "-"}
                    </td>
                    <td className="pr-3 py-1 font-semibold">
                      {l.proceed_price?.amount ?? "-"} {l.proceed_price?.currency ?? ""}
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
              // Edit-from-summary is a focused task - no person-page links.
              artistHref={returnToSummary ? undefined : personLink?.href}
              artistLinkLabel={returnToSummary ? undefined : personLink?.label}
            />
          </div>
        </div>
      </div>
      {debugPanel}
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 text-lg">
          בחרו כמות כרטיסים וקטגוריה מועדפת,
          {/* Several suppliers = several seating promises - each card says its own. */}
          {isMultiSupplier ? null : isTxEvent ? <span className="font-bold"> ישיבה בזוגות/שלשות מובטחת.</span> : <span className="font-bold"> ישיבה בזוגות מובטחת.</span>}
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
              {overMaxRequest && (
                // Over-the-cap ask (10+): group-lead rescue + a way back.
                <div className="mb-4 flex flex-col items-center gap-3">
                  <GroupTicketsInquiry
                    eventName={headerEvent?.name || ""}
                    eventId={headerEvent?.id}
                    quantity={overMaxRequest}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setOverMaxRequest(null);
                    }}
                    className="text-sm font-bold text-forest underline underline-offset-4 hover:opacity-80 dark:text-glow"
                  >
                    חזרה לבחירת כרטיסים
                  </button>
                </div>
              )}
              <div
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="ticket-selection-heading"
              >
                <div id="ticket-selection-heading" className="sr-only">
                  קטגוריות כרטיסים זמינות
                </div>
                {!event ||
                (isTxEvent && isLoadingLiveTickets) ||
                liveTicketsStatus === "loading" ? (
                  // `event` reaches the context only after hydration (OrderPageClient's
                  // effect). On the server, and until the JS lands on a cold start, the
                  // step saw no tickets and no supplier and fell through to "sold out"
                  // for 20-40 s (Alon 24.09). An event that truly has no tickets never
                  // mounts this step at all (OrderPageClient / the server page), so the
                  // spinner here only ever waits for hydration or a live supplier.
                  <div className="flex items-center justify-center p-8 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <Text size="sm" c="dimmed">
                      {event ? "טוען מחירים עדכניים..." : "טוענים את הכרטיסים..."}
                    </Text>
                  </div>
                ) : effectiveTickets.length === 0 ? (
                  hasLiveSupplier && availableTickets.length > 0 ? (
                    // Quantity dead-end: the event HAS tickets, just not N together.
                    // Rescue instead of a wall - one-tap reduce to the max that
                    // works, or leave details / WhatsApp for a group offer.
                    <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
                      <Text size="xl" fw={700} c="red" aria-live="polite">
                        אין {numberOfEventTickets} כרטיסים ביחד כרגע
                      </Text>
                      {nearestFeasibleQty ? (
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(nearestFeasibleQty.qty)}
                          className="rounded-xl bg-main px-5 py-2.5 text-sm font-bold text-main-foreground transition-colors hover:bg-main/90"
                        >
                          {nearestFeasibleQty.direction === "down"
                            ? `יש עד ${nearestFeasibleQty.qty} כרטיסים ביחד - עדכנו את הכמות`
                            : `המוכרים מוכרים מינימום ${nearestFeasibleQty.qty} כרטיסים ביחד - עדכנו את הכמות`}
                        </button>
                      ) : (
                        <Text size="md" c="dimmed">
                          נסו לשנות את כמות הכרטיסים.
                        </Text>
                      )}
                      <GroupTicketsInquiry
                        eventName={headerEvent?.name || ""}
                        eventId={headerEvent?.id}
                        quantity={numberOfEventTickets}
                      />
                    </div>
                  ) : (
                    <OrderIssueState
                      className="border-0 bg-transparent"
                      title="הכרטיסים אזלו בינתיים"
                      subtitle="זה קורה באירועים מבוקשים - לפעמים חוזרים כרטיסים למכירה. דברו איתנו ונעדכן אתכם ברגע שיש, או שנמצא לכם אירוע אחר מדליק."
                      whatsAppText={`היי, רציתי כרטיסים לאירוע ${headerEvent?.name || ""} וראיתי שאזלו. אשמח לעדכון אם חוזרים כרטיסים :)`}
                    />
                  )
                ) : (
                  [...displayedTickets]
                    .sort((a: PricedTicket, b: PricedTicket) => a.price - b.price)
                    .filter((ticket: PricedTicket) => {
                      // Double-check: ensure ticket is still available before rendering
                      if (ticket.available === false) {
                        console.warn(`Attempted to render unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
                        return false;
                      }
                      return true;
                    })
                    .map((shown: ZoneOffer, index: number) => {
                      // A together/split card shows the option the customer
                      // picked, or the one it opens on.
                      const options = shown.seatingOptions;
                      const ticket: PricedTicket =
                        options && selectedTicket === options.together.id
                          ? options.together
                          : options && selectedTicket === options.split.id
                            ? options.split
                            : shown;
                      const selectTicket = (t: PricedTicket) =>
                        handleTicketSelect({
                          id: t.id,
                          price: t.price,
                          category: t.category,
                          vendor: t.vendor,
                          description: t.description,
                        });
                      return (
                        <EventTicketCard
                          index={index}
                          onClick={() => selectTicket(ticket)}
                          numberOfTickets={numberOfEventTickets}
                          onChangeNumberOfTickets={handleQuantityChange}
                          key={options ? `zone-${shown.zoneId}` : shown.id}
                          category={ticket.zoneLabel || ticket.category}
                          categoryDescription={ticket.description}
                          bestPrice={bestPriceIds.has(ticket.id)}
                          seatingNote={
                            isMultiSupplier ? seatingNote(ticket) : undefined
                          }
                          seatingToggle={
                            options
                              ? {
                                  value:
                                    ticket.id === options.together.id
                                      ? "together"
                                      : "split",
                                  splitLabel: splitLabel(options.split),
                                  togetherExtraUsd:
                                    options.together.price - options.split.price,
                                  onChange: (value) => selectTicket(options[value]),
                                }
                              : undefined
                          }
                          colorOnTheMap={ticket.colorOnTheMap || ""}
                          useMapColor={!isTxEvent}
                          isSelected={
                            selectedTicket === ticket.id
                          }
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
                      );
                    })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
