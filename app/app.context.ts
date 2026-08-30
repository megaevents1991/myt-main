import {
  Flight,
  OrderHotel,
  Event,
  OrderTicket,
  FlightSearchCriteria,
  HotelSearchCriteria,
} from "@/lib/app.types";
import { createContext, Dispatch, SetStateAction } from "react";

/** Link to the artist/football-team page this event belongs to (resolved
 *  server-side by name match) - href + ready-made Hebrew label. */
export type PersonLink = { href: string; label: string };

type AppContext = {
  flight?: Flight;
  event?: Event;
  /** Undefined when the event has no artist/team page. */
  personLink?: PersonLink;
  setPersonLink: (link?: PersonLink) => void;
  hotel?: OrderHotel;
  eventTicket: OrderTicket;
  setEventTicket: (eventTicket: OrderTicket) => void;
  setHotel: (hotel?: OrderHotel) => void;
  setFlight: Dispatch<SetStateAction<Flight | undefined>>;
  setEvent: (event: Event) => void;
  numberOfEventTickets: number;
  setNumberOfEventTickets: (numberOfEventTickets: number) => void;
  currentMinTicketPrice: number;
  setCurrentMinTicketPrice: Dispatch<SetStateAction<number>>;
  planeTickets: {
    adults: number;
    children: number;
  };
  setPaymentMethod: (paymentMethod: string) => void;
  paymentMethod: string;
  selectedPlaneTicketsFilters: Partial<FlightSearchCriteria>;
  setSelectedPlaneTicketsFilters: Dispatch<
    SetStateAction<Partial<FlightSearchCriteria>>
  >;
  selectedHotelFilters: Partial<HotelSearchCriteria>;
  setSelectedHotelFilters: Dispatch<
    SetStateAction<Partial<HotelSearchCriteria>>
  >;
  setPlaneTickets: (planeTickets: { adults: number; children: number }) => void;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  globalLoader: boolean;
  setGlobalLoader: Dispatch<SetStateAction<boolean>>;
  passengers?: { [key: string]: string }[] | undefined;
  setPassengers: Dispatch<
    SetStateAction<{ [key: string]: string }[] | undefined>
  >;
  skipHotel: boolean;
  setSkipHotel: (skip: boolean) => void;
  /** Real per-guest cost of the hotel the customer REMOVED via "לא צריך מלון",
   *  captured at skip time (the hotel object itself is cleared). Drives the
   *  hotel-skip fee rule: a "cheap hotel" (cost <= the skip fee per guest)
   *  charges no skip fee at all, and the fee is otherwise capped at this cost
   *  - removing a hotel must never raise the package price (Dor 23.8).
   *  null = no hotel was picked when skipping (fee applies as before). */
  skippedHotelPricePerGuest: number | null;
  setSkippedHotelPricePerGuest: (price: number | null) => void;
  skipFlight: boolean;
  setSkipFlight: (skip: boolean) => void;
  flightSkipped: boolean;
  setFlightSkipped: (skip: boolean) => void;
  /** Edit-from-summary mode: the customer jumped to a step via the summary's
   *  עריכה / +להוספה buttons. The flow chrome (stepper, pills) hides and the
   *  primary action saves back to the summary. */
  returnToSummary: boolean;
  setReturnToSummary: (on: boolean) => void;
  /** Agent-locked prepared package (prepared_packages.allow_edit = false):
   *  the pinned composition may not be changed - summary edit buttons, the
   *  stepper and the slot pills are inert. A stale or deliberately-left-live
   *  piece still gets picked normally (that landing step stays interactive).
   *  Distinct from the event-level locked_flight_id ("locked package"). */
  packageLocked: boolean;
  setPackageLocked: (on: boolean) => void;
  /** The agent's own price for a prepared package, per traveler in USD
   *  (+ uplift above site price, - discount funded from their commission).
   *  Read from prepared_packages by /api/package/[id]; the summary adds it to
   *  the total so the LINK quotes the agent's price, not the site's
   *  (backoffice doc 2026-08-30, item 4). 0 for every non-package visit. */
  packageAdjustPerPerson: number;
  setPackageAdjustPerPerson: (usdPerTraveler: number) => void;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
