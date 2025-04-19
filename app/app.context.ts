import { Flight, OrderHotel, Event, OrderTicket, FlightSearchCriteria, HotelSearchCriteria } from "@/lib/app.types";
import { createContext, Dispatch, SetStateAction } from "react";

type AppContext = {
  flight?: Flight;
  event?: Event;
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
  selectedPlaneTicketsFilters: Partial<Record<FlightSearchCriteria['type'], FlightSearchCriteria['value']>>;
  setSelectedPlaneTicketsFilters: Dispatch<
    SetStateAction<Partial<Record<FlightSearchCriteria['type'], FlightSearchCriteria['value']>>>
  >;
  selectedHotelFilters: Partial<Record<HotelSearchCriteria['type'], HotelSearchCriteria['value']>>;
  setSelectedHotelFilters: Dispatch<
    SetStateAction<Partial<Record<HotelSearchCriteria['type'], HotelSearchCriteria['value']>>>
  >;
  setPlaneTickets: (planeTickets: { adults: number; children: number }) => void;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
