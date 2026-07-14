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
 *  server-side by name match) — href + ready-made Hebrew label. */
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
  skipFlight: boolean;
  setSkipFlight: (skip: boolean) => void;
  flightSkipped: boolean;
  setFlightSkipped: (skip: boolean) => void;
  /** Edit-from-summary mode: the customer jumped to a step via the summary's
   *  עריכה / +להוספה buttons. The flow chrome (stepper, pills) hides and the
   *  primary action saves back to the summary. */
  returnToSummary: boolean;
  setReturnToSummary: (on: boolean) => void;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
