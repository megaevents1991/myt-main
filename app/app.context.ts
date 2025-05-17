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
  hotel?: OrderHotel;
  eventTicket: OrderTicket;
  setEventTicket: (eventTicket: OrderTicket) => void;
  setHotel: (hotel?: OrderHotel) => void;
  setFlight: Dispatch<SetStateAction<Flight | undefined>>;
  setEvent: (event: Event) => void;
  numberOfEventTickets: number;
  numOfGuests: number;
  setNumOfGuests: Dispatch<SetStateAction<number>>;
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
};

export const OrderContext = createContext<AppContext>({} as AppContext);
