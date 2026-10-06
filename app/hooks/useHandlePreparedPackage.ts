import { useCallback, useContext, useLayoutEffect } from "react";
import { OrderContext } from "../app.context";
import { Event, Flight, OrderHotel } from "@/lib/app.types";
import { useSearchParams } from "next/navigation";
import { readyPackageEntry, swapOf, type ReadySwap } from "@/lib/events/readyPackage";

/** What /api/package/[id] answers (app/api/package/[id]/route.ts). */
type PackageAnswer = {
  event_order_info: {
    number_of_ticket: number;
    category: string;
    id: string;
    price_per_ticket: number;
  };
  flight_order_info: Flight | null;
  flight_needs_repick: boolean;
  hotel_order_info: OrderHotel | null;
  hotel_needs_repick: boolean;
  allow_edit?: boolean;
  /** Agent's own price for this package, per traveler (USD). */
  price_adjust_per_person?: number;
  num_travelers?: number;
  /** A ready package ("חבילה מוכנה") - a house-built package of this event. */
  house?: boolean;
  /** Ready package only: the party sizes it is priced for, ascending. */
  pax_options?: number[];
  hotel_image?: string | null;
  /** Ready package only: per piece, may the customer swap it. */
  swap?: ReadySwap;
};

/**
 * Puts a package answer into the order - the one place both the first load
 * and the ready package's traveller picker go through.
 */
const useApplyPackage = () => {
  const {
    setStep,
    setFlight,
    setHotel,
    setNumberOfEventTickets,
    setEventTicket,
    setSkipHotel,
    setFlightSkipped,
    setPackageLocked,
    setPackageAdjustPerPerson,
    setPlaneTickets,
    setReadyPackage,
  } = useContext(OrderContext);

  return useCallback(
    (data: PackageAnswer, token: string) => {
      // The agent's price rides the LINK now (backoffice doc 2026-08-30, item
      // 4) - the summary adds it to the total. Site pricing stays the base, so
      // a customer who re-picks a flight or hotel still gets a live price with
      // the same agent margin on top.
      setPackageAdjustPerPerson(Number(data.price_adjust_per_person ?? 0) || 0);

      // Agent chose to lock the composition - the summary's edit buttons,
      // the stepper and the slot pills go inert. A needs_repick piece still
      // lands the visitor on its step to be picked (that never locks).
      if (data.allow_edit === false) {
        setPackageLocked(true);
      }

      setEventTicket({
        category: data.event_order_info.category,
        id: data.event_order_info.id,
        price: data.event_order_info.price_per_ticket,
        description: "",
        quantity: data.event_order_info.number_of_ticket,
      });
      setNumberOfEventTickets(data.event_order_info.number_of_ticket);

      if (data.flight_order_info) {
        setFlightSkipped(false);
        setFlight(data.flight_order_info);
      } else {
        // Either the agent skipped flight entirely, or it's now stale -
        // flight_needs_repick (below) is what tells step-targeting apart.
        setFlightSkipped(!data.flight_needs_repick);
        setFlight(undefined);
      }

      if (data.hotel_order_info) {
        setSkipHotel(false);
        setHotel(data.hotel_order_info);
      } else {
        setSkipHotel(!data.hotel_needs_repick);
        setHotel(undefined);
      }

      // A ready package: the summary draws the package view, with a traveller
      // picker over the sizes it is priced for. The party follows the chosen
      // size everywhere a step would read it (a swap of the flight or the hotel
      // searches for this many).
      if (data.house) {
        const party = data.event_order_info.number_of_ticket;
        setPlaneTickets({ adults: party, children: 0 });
        setReadyPackage((prev) => {
          // Sizes the ticket could not be sold for stay out for the whole visit.
          const blockedPax = prev?.blockedPax ?? [];
          return {
            token,
            paxOptions: (data.pax_options ?? [party]).filter((n) => !blockedPax.includes(n)),
            hotelImage: data.hotel_image ?? null,
            hotelImageFor: data.hotel_order_info?.id ?? null,
            // An older route answer has no breakdown: every piece follows allow_edit.
            swap: data.swap ?? swapOf(null, data.allow_edit),
            blockedPax,
            notice: prev?.notice ?? null,
            loading: false,
            error: null,
          };
        });
      }

      // Land as far into the flow as still valid: only a stale flight or
      // hotel sends the visitor back to re-pick it; an intentional skip
      // does not.
      if (data.flight_needs_repick) setStep(2);
      else if (data.hotel_needs_repick) setStep(3);
      else setStep(4);
    },
    [
      setStep,
      setFlight,
      setHotel,
      setNumberOfEventTickets,
      setEventTicket,
      setSkipHotel,
      setFlightSkipped,
      setPackageLocked,
      setPackageAdjustPerPerson,
      setPlaneTickets,
      setReadyPackage,
    ],
  );
};

/**
 * Consumes a `?pkg=<id>` link (see lib/agent-package-actions.ts,
 * SavePackageLink) - a partner's saved ticket+flight+hotel combination,
 * re-validated server-side (app/api/package/[id]/route.ts) rather than
 * trusted outright, unlike the sibling `?orderId=` recovery flow
 * (useHandleExistingOrder), whose 25-hour window makes staleness rare
 * enough to skip re-checking. A package link can be opened long after it
 * was made, so a stale flight/hotel is the expected case, not an edge one -
 * the route drops just that piece and this hook lands the visitor on the
 * step that actually needs a fresh pick instead of pretending everything
 * is still fine.
 *
 * The same load opens an event's READY package (lib/events/readyPackage.ts):
 * with no `?pkg`, an event in mode 'live' - or the staff's `?ready=<token>`
 * link in 'preview' - opens on its house-built package.
 */
export const useHandlePreparedPackage = (event?: Event) => {
  const { setGlobalLoader } = useContext(OrderContext);
  const applyPackage = useApplyPackage();
  const searchParams = useSearchParams();

  const fetchPackage = async (packageId: string) => {
    setGlobalLoader(true);
    try {
      const response = await fetch(`/api/package/${packageId}`);
      if (!response.ok) {
        // Gone/invalid package - fall back to a normal, from-scratch flow
        // rather than blocking the visitor entirely; they still landed on
        // the right event via the link's own eventId.
        const errorData = await response.json().catch(() => null);
        console.error(
          "useHandlePreparedPackage:",
          errorData?.error || response.status,
        );
        return;
      }

      const data: PackageAnswer = await response.json();
      applyPackage(data, packageId);
    } catch (error) {
      console.error("Error fetching prepared package:", error);
    } finally {
      setGlobalLoader(false);
    }
  };

  useLayoutEffect(() => {
    const packageId =
      searchParams.get("pkg") ??
      readyPackageEntry(event, window.location.search);
    if (packageId) {
      fetchPackage(packageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * The ready package's traveller picker: asks the route for the same package
 * priced for another party size and applies it like the first load. A failed
 * request leaves the order as it was and says so on the picker.
 */
export const useReadyPackagePax = () => {
  const { readyPackage, setReadyPackage } = useContext(OrderContext);
  const applyPackage = useApplyPackage();

  const changePax = useCallback(
    async (pax: number) => {
      if (!readyPackage || readyPackage.loading) return;
      const { token } = readyPackage;
      setReadyPackage((prev) =>
        prev ? { ...prev, loading: true, error: null, notice: null } : prev,
      );
      const fail = () =>
        setReadyPackage((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: "לא הצלחנו לעדכן את מספר הנוסעים. נסו שוב.",
              }
            : prev,
        );
      try {
        const response = await fetch(`/api/package/${token}?pax=${pax}`);
        if (!response.ok) {
          fail();
          return;
        }
        const data: PackageAnswer = await response.json();
        applyPackage(data, token);
      } catch (error) {
        console.error("useReadyPackagePax:", error);
        fail();
      }
    },
    [readyPackage, setReadyPackage, applyPackage],
  );

  return { changePax };
};
