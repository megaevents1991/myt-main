import { Flight, OrderHotel, Event, EventTicket } from "@/lib/app.types";
import { createContext, Dispatch, SetStateAction } from "react";

type AppContext = {
  flight?: Flight;
  event?: Event;
  hotel?: OrderHotel;
  eventTicket: EventTicket;
  setEventTicket: (eventTicket: EventTicket) => void;
  setHotel: (hotel?: OrderHotel) => void;
  setFlight: (flight?: Flight) => void;
  setEvent: (event: Event) => void;
  numberOfEventTickets: number;
  setNumberOfEventTickets: (numberOfEventTickets: number) => void;
  planeTickets: {
    adults: number;
    children: number;
  };
  setPlaneTickets: (planeTickets: { adults: number; children: number }) => void;
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
