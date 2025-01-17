import { Flight, OrderHotel, Event, OrderTicket } from "@/lib/app.types";
import { createContext, Dispatch, SetStateAction } from "react";

type AppContext = {
  flight?: Flight;
  event?: Event;
  hotel?: OrderHotel;
  eventTicket: OrderTicket;
  setEventTicket: (eventTicket: OrderTicket) => void;
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
