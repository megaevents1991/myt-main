import { Airline } from "aircodes";

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
  tickets: {
    category: string;
    description: string;
    price: number;
    id: string;
    colorOnTheMap?: string;
  }[];
};

export type Flight = {
  id: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  price: number;
  duration: string;
  stops: number;
  returnDepartureTime: string;
  returnArrivalTime: string;
  metadata: Airline;
  outbound: {
    departureTime: string;
    arrivalTime: string;
    departureAirport: string;
    arrivalAirport: string;
    stops: string[];
    duration: string;
  };
  inbound: {
    departureTime: string;
    arrivalTime: string;
    departureAirport: string;
    arrivalAirport: string;
    stops: string[];
    duration: string;
  };
};

export type Hotel = {
  id: string;
  name: string;
  price: number;
  rating: number;
  amenities: string[];
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
