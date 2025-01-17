import { Airline } from "aircodes";
import { Guest, Rate } from "./hotel.type";

export type Event = {
  id: string;
  name: string;
  date: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
  };
  mapUrl: string;
  description: string;
  imageUrl: string;
  city: string;
  tickets: EventTicket[];
};

export type Flight = {
  id: string;
  airline: string;
  price: number;
  duration: string;
  stops: number;
  metadata: Airline;
  outbound: FlightSegment;
  inbound: FlightSegment;
  numOfTravelers: number;
};

export type FlightSegment = {
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  stops: string[];
  duration: string;
  checkBagsIncluded: boolean;
};

export type OrderHotel = {
  rate: Rate;
  address: string;
  name: string;
  id: string;
  price: string;
  guests: Guest[];
};

export type Order = {
  eventId: string;
  ticketType: string;
  quantity: number;
  flightId: string;
  hotelId: string;
  totalPrice: number;
};

export type FlightSearchOptions = {
  originLocationCode: "TLV";
  destinationLocationCode: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  children: string;
  infants: string;
  destination: string;
  nonStop: boolean;
};

export type TimeRange = [
  {
    hours: number;
    minutes: number;
  },
  {
    hours: number;
    minutes: number;
  }
];

export type AffiliateTracking = {
  id: string;
  affiliate_id: string;
  stage:
    | "VISIT"
    | "EVENT_SELECTED"
    | "TICKET_SELECTED"
    | "FLIGHT_SELECTED"
    | "HOTEL_SELECTED"
    | "CONFIRMED";
  data: object;
  timestamp: string;
};

export type SortOptions = "price_asc" | "rating";

export type HotelSearchCriteria =
  | {
      type: "rating";
      value: boolean[];
    }
  | {
      type: "priceRange";
      value: [number, number];
    }
  | {
      type: "hotelName";
      value: string;
    }
  | {
      type: "withMeal";
      value: boolean;
    }
  | {
      type: "sortOption";
      value: SortOptions;
    }
  | {
      type: "region";
      value: string[];
    }
  | {
      type: "distanceFromCenter";
      value: [number, number];
    };

type EventTicket = {
  category: string;
  price: number;
  id: string;
  description: string;
  colorOnTheMap: string;
};

export type OrderTicket = Omit<EventTicket, "description" | "colorOnTheMap"> & {
  quantity: number;
};
