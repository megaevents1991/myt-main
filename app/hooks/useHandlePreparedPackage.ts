import { useContext, useLayoutEffect } from "react";
import { OrderContext } from "../app.context";
import { Flight, OrderHotel } from "@/lib/app.types";
import { useSearchParams } from "next/navigation";

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
 */
export const useHandlePreparedPackage = () => {
  const {
    setStep,
    setFlight,
    setHotel,
    setNumberOfEventTickets,
    setEventTicket,
    setGlobalLoader,
    setSkipHotel,
    setFlightSkipped,
    setPackageLocked,
  } = useContext(OrderContext);

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

      const data: {
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
      } = await response.json();

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

      // Land as far into the flow as still valid: only a stale flight or
      // hotel sends the visitor back to re-pick it; an intentional skip
      // does not.
      if (data.flight_needs_repick) setStep(2);
      else if (data.hotel_needs_repick) setStep(3);
      else setStep(4);
    } catch (error) {
      console.error("Error fetching prepared package:", error);
    } finally {
      setGlobalLoader(false);
    }
  };

  useLayoutEffect(() => {
    const packageId = searchParams.get("pkg");
    if (packageId) {
      fetchPackage(packageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
