"use client";

// The ticket step of the hidden SANDBOX checkout - TixStock's health check. `OrderForm` mounts it in place of
// `TicketSelection` ONLY for an `is_test` event that carries `tixstock_booking` (`isSandboxBookingEvent`); every
// real event keeps `TicketSelection`, which this file never imports or changes.
//
// One card per category, read from TixStock's sandbox feed (`/api/tixstock/sandbox-tickets`), each priced by ONE
// listing and showing that listing's own details. The ticket it hands the order carries the listing's id
// (`eventTicket.tixstock`), which the pay click holds. The rules are pure and tested:
// lib/tixstock-booking/sandbox-ticket.ts.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { OrderContext } from "../../app.context";
import { TixstockDynamicMap } from "@/components/TixstockDynamicMap";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { CardWrapper } from "@/components/ui/cardWrapper";
import type { Event, OrderTicket } from "@/lib/app.types";
import type { SandboxCard } from "@/lib/tixstock-booking/sandbox-cards";
import {
  cardToKeep,
  deliveryDay,
  sandboxOrderTicket,
  shownSandboxCards,
  type ShownSandboxCard,
} from "@/lib/tixstock-booking/sandbox-ticket";
import { eventTicketToListing, type TixStockMatchableListing } from "@/lib/tixstock-map";

/** The real ticket step's ceiling (`MAX_TICKETS` in TicketSelection). */
const MAX_TICKETS = 9;

/** "No ticket picked": the same empty ticket the real step sets, so the continue bar stays closed. */
const NO_TICKET: OrderTicket = { id: "", vendor: "", category: "", price: 0, description: "", quantity: 0 };

/** What `/api/tixstock/sandbox-tickets` answers with a 200. */
type SandboxTicketsAnswer = {
  cards?: SandboxCard[];
  venueCountryCode?: string | null;
  tixEventId?: string;
};

type Loaded = { shown: ShownSandboxCard[]; tixEventId: string; venueCountryCode: string | null };
type View = { state: "loading" } | { state: "unavailable" } | { state: "ready"; data: Loaded };

/** A shown card as the seat map reads a ticket: known by the event row's id, matched by its category or zone. */
const toMapTicket = ({ card, row }: ShownSandboxCard): TixStockMatchableListing =>
  eventTicketToListing({
    id: row.id,
    category: card.category,
    description: "",
    price: card.pricePerTicketUsd,
    zoneId: row.zoneId,
  });

export function SandboxTicketStep({ initialEvent }: { initialEvent?: Event }) {
  const {
    event,
    eventTicket,
    setEventTicket,
    setCurrentMinTicketPrice,
    numberOfEventTickets,
    setNumberOfEventTickets,
    setPlaneTickets,
    setFlight,
    setHotel,
    orderResume,
    personLink,
    returnToSummary,
  } = useContext(OrderContext);

  // The context's event lands after hydration; the server's copy draws the same header until then.
  const headerEvent = event ?? initialEvent;
  const eventId = event?.id;

  const [view, setView] = useState<View>({ state: "loading" });
  const [errorMessage, setErrorMessage] = useState("");
  const [hovered, setHovered] = useState<TixStockMatchableListing | null>(null);

  // The category to keep when the cards are read again: the one in hand when the step opened (a return from the
  // summary), then whatever the customer picks here. After a refresh it is the draft's ticket (`orderResume`).
  const pickedRowIdRef = useRef<string | undefined>(eventTicket?.id || undefined);
  const resumeTicketId = orderResume?.step === 1 ? orderResume.ticketId : undefined;

  // The event's ticket rows, read when the cards land - not a reason to read the cards again.
  const rowsRef = useRef(event?.tickets_and_rates);
  useEffect(() => {
    rowsRef.current = event?.tickets_and_rates;
  }, [event]);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();

    // The ticket in hand was priced for another party, or by a listing that may be gone: nothing is picked until
    // the fresh cards land, so the continue bar stays closed meanwhile.
    setView({ state: "loading" });
    setEventTicket(NO_TICKET);

    const load = async () => {
      try {
        const query = new URLSearchParams({
          db_event_id: String(eventId),
          ticket_quantity: String(numberOfEventTickets),
        });
        const res = await fetch(`/api/tixstock/sandbox-tickets?${query.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          console.warn("[sandbox-ticket-step] the cards were not read:", res.status);
          setView({ state: "unavailable" });
          return;
        }
        const body = (await res.json()) as SandboxTicketsAnswer;
        if (controller.signal.aborted) return;
        if (!Array.isArray(body.cards) || typeof body.tixEventId !== "string" || body.tixEventId === "") {
          console.warn("[sandbox-ticket-step] the answer has no cards or no TixStock event id");
          setView({ state: "unavailable" });
          return;
        }

        const { shown, orphans } = shownSandboxCards(body.cards, rowsRef.current ?? []);
        if (orphans.length > 0) {
          // The event's ticket rows are built from this feed (the backoffice test-events script); a category
          // without a row means the feed changed since - re-run the script.
          console.warn("[sandbox-ticket-step] categories with no ticket row on the event, not shown:", orphans.join(", "));
        }
        const data: Loaded = { shown, tixEventId: body.tixEventId, venueCountryCode: body.venueCountryCode ?? null };
        setView({ state: "ready", data });
        setCurrentMinTicketPrice(shown[0]?.card.pricePerTicketUsd ?? 0);

        const keep = cardToKeep(shown, pickedRowIdRef.current ?? resumeTicketId);
        if (keep) {
          setEventTicket(
            sandboxOrderTicket(keep, {
              quantity: numberOfEventTickets,
              tixEventId: data.tixEventId,
              venueCountryCode: data.venueCountryCode,
            }),
          );
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("[sandbox-ticket-step] failed:", e instanceof Error ? e.message : String(e));
        setView({ state: "unavailable" });
      }
    };
    void load();

    return () => controller.abort();
  }, [eventId, numberOfEventTickets, resumeTicketId, setEventTicket, setCurrentMinTicketPrice]);

  const shown = useMemo(() => (view.state === "ready" ? view.data.shown : []), [view]);
  const mapTickets = useMemo(() => shown.map(toMapTicket), [shown]);
  const cheapest = shown[0]?.card.pricePerTicketUsd ?? 0;

  const pick = useCallback(
    (card: ShownSandboxCard) => {
      if (view.state !== "ready") return;
      pickedRowIdRef.current = card.row.id;
      setEventTicket(
        sandboxOrderTicket(card, {
          quantity: numberOfEventTickets,
          tixEventId: view.data.tixEventId,
          venueCountryCode: view.data.venueCountryCode,
        }),
      );
    },
    [view, numberOfEventTickets, setEventTicket],
  );

  const pickOnMap = useCallback(
    (rowId: string) => {
      const card = shown.find((s) => s.row.id === rowId);
      if (card) pick(card);
    },
    [shown, pick],
  );

  // The real step's own rule: a new party size drops a flight and a hotel priced for the old one, and the
  // travellers follow the tickets.
  const changeQuantity = (value: number) => {
    if (value < 1) return;
    if (value > MAX_TICKETS) {
      setErrorMessage("ניתן לרכוש עד 9 כרטיסים באתר");
      return;
    }
    setErrorMessage("");
    if (value !== numberOfEventTickets) {
      setFlight(undefined);
      setHotel(undefined);
    }
    setNumberOfEventTickets(value);
    setPlaneTickets({ adults: value, children: 0 });
  };

  return (
    <div>
      <div className="flex flex-col items-center">
        <div dir="rtl" className="w-screen bg-muted px-4 py-2 lg:p-4">
          <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-2 px-2 lg:flex-row lg:gap-2 lg:px-6">
            <EventDataHeader
              event={headerEvent}
              artistHref={returnToSummary ? undefined : personLink?.href}
              artistLinkLabel={returnToSummary ? undefined : personLink?.label}
            />
          </div>
        </div>
      </div>
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg">בחרו כמות כרטיסים וקטגוריה מועדפת</div>
          <div className="flex items-center gap-2" role="group" aria-label="כמות כרטיסים">
            <button
              type="button"
              onClick={() => changeQuantity(numberOfEventTickets - 1)}
              disabled={numberOfEventTickets <= 1}
              className="rounded-full border border-border bg-background p-1 hover:border-main disabled:opacity-40"
              aria-label="הפחת כמות כרטיסים"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="w-8 text-center text-xl font-bold" role="status" aria-live="polite" aria-label={`${numberOfEventTickets} כרטיסים נבחרו`}>
              {numberOfEventTickets}
            </div>
            <button
              type="button"
              onClick={() => changeQuantity(numberOfEventTickets + 1)}
              className="rounded-full border border-border bg-background p-1 hover:border-main"
              aria-label="הוסף כמות כרטיסים"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">כרטיסים</span>
          </div>
        </div>
        {errorMessage && (
          <p className="mt-2 text-sm text-red-600" role="alert" aria-live="polite">
            {errorMessage}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row-reverse">
          <div className="w-full lg:w-[45%]">
            <TixstockDynamicMap
              mapUrl={event?.map_image_url || ""}
              tickets={mapTickets}
              hoveredTicket={hovered}
              selectedTicketId={eventTicket?.id || null}
              onTicketSelect={pickOnMap}
              excludedSections={event?.tx_excluded_sections}
            />
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-[55%]" role="group" aria-label="קטגוריות כרטיסים זמינות">
            {view.state === "loading" || !event ? (
              <div className="flex items-center justify-center gap-3 p-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="text-sm text-muted-foreground">טוענים את הכרטיסים...</span>
              </div>
            ) : view.state === "unavailable" ? (
              <div className="rounded-lg border border-border p-6 text-center" role="alert">
                <div className="text-xl font-bold">האירוע לא זמין</div>
                <div className="mt-1 text-sm text-muted-foreground">לא הצלחנו לקרוא את הכרטיסים כרגע. נסו שוב בעוד רגע.</div>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-lg border border-border p-6 text-center" aria-live="polite">
                <div className="text-xl font-bold">אין {numberOfEventTickets} כרטיסים זמינים כרגע</div>
                <div className="mt-1 text-sm text-muted-foreground">נסו כמות אחרת.</div>
              </div>
            ) : (
              shown.map((s) => {
                const { card, row } = s;
                const selected = eventTicket?.id === row.id;
                const extra = card.pricePerTicketUsd - cheapest;
                const delivery = deliveryDay(card.deliveryDate);
                return (
                  <CardWrapper
                    key={row.id}
                    isSelected={selected}
                    onClick={() => pick(s)}
                    onMouseEnter={() => setHovered(toMapTicket(s))}
                    onMouseLeave={() => setHovered(null)}
                    className="items-start gap-4"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1" data-sandbox-card={card.listingId}>
                      <div className="flex flex-wrap items-center gap-2 text-xl font-bold">
                        {row.zoneLabel || card.category}
                        {card.instantDownload && (
                          <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-bold text-white dark:bg-glow dark:text-black">
                            הורדה מיידית
                          </span>
                        )}
                      </div>
                      {row.description?.length > 0 && <div>{row.description}</div>}
                      <div className="text-sm text-muted-foreground">
                        סוג כרטיס: <bdi>{card.ticketType || "-"}</bdi>
                        {" · "}
                        חלוקה: <bdi>{card.splitType || "-"}</bdi>
                      </div>
                      {card.singleSeats && (
                        <div className="text-sm font-bold text-red-600">ייתכן שהמושבים לא יהיו צמודים</div>
                      )}
                      {card.restrictions.length > 0 && (
                        <ul className="list-disc ps-5 text-sm" aria-label="הגבלות והטבות">
                          {card.restrictions.map((line) => (
                            <li key={line}>
                              <bdi>{line}</bdi>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {delivery && <span>מסירה עד {delivery} · </span>}
                        זמינים: {card.available}
                      </div>
                    </div>
                    <div className="shrink-0 text-center font-bold">
                      {extra === 0 ? (
                        <span className="text-[20px]">כלול במחיר</span>
                      ) : (
                        <div className="text-2xl">
                          ${extra}+
                          <div className="text-[16px] leading-[22px]">תוספת לכל כרטיס</div>
                        </div>
                      )}
                    </div>
                  </CardWrapper>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
