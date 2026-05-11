import {
  Flight,
  OrderHotel,
  Event,
  OrderTicket,
  FlightSearchCriteria,
  HotelSearchCriteria,
} from "@/lib/app.types";
import { createContext, Dispatch, SetStateAction } from "react";

type AppContext = {
  flight?: Flight;
  event?: Event;
  selectedEvents: Event[];
  setSelectedEvents: Dispatch<SetStateAction<Event[]>>;
  activeTicketEventIndex: number;
  setActiveTicketEventIndex: Dispatch<SetStateAction<number>>;
  selectedEventTickets: Record<number, OrderTicket>;
  setSelectedEventTickets: Dispatch<
    SetStateAction<Record<number, OrderTicket>>
  >;
  hotel?: OrderHotel;
  eventTicket: OrderTicket;
  setEventTicket: (eventTicket: OrderTicket) => void;
  setHotel: (hotel?: OrderHotel) => void;
  setFlight: Dispatch<SetStateAction<Flight | undefined>>;
  setEvent: (event: Event) => void;
  numberOfEventTickets: number;
  setNumberOfEventTickets: (numberOfEventTickets: number) => void;
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
  forceSkipHotel: boolean;
  setForceSkipHotel: (skip: boolean) => void;
  // Skip-flight (ticket-only): skipFlight = capability (event-level), flightSkipped = user choice.
  skipFlight: boolean;
  setSkipFlight: (skip: boolean) => void;
  flightSkipped: boolean;
  setFlightSkipped: (skipped: boolean) => void;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
