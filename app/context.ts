import { Flight, Hotel, Event } from "@/lib/app.types";
import { createContext } from "react";

type Context = {
  flight?: Flight;
  event?: Event;
  hotel?: Hotel;
  setHotel: (hotel: Hotel) => void;
  setFlight: (flight?: Flight) => void;
  setEvent: (event: Event) => void;
};

export const OrderContext = createContext<Context>({} as Context);
