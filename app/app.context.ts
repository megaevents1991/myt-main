import { Flight, Hotel, Event } from "@/lib/app.types";
import { createContext } from "react";

type AppContext = {
  flight?: Flight;
  event?: Event;
  hotel?: Hotel;
  setHotel: (hotel: Hotel) => void;
  setFlight: (flight?: Flight) => void;
  setEvent: (event: Event) => void;
  numberOfEventTickets: number;
  setNumberOfEventTickets: (numberOfEventTickets: number) => void;
  planeTickets: {
    adults: number;
    children: number;
  };
  setPlaneTickets: (planeTickets: { adults: number; children: number }) => void;
};

export const OrderContext = createContext<AppContext>({} as AppContext);
