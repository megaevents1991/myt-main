import { Airline } from "aircodes";
import { Rate } from "./hotel.type";

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
  price: number;
  duration: string;
  stops: number;
  returnDepartureTime: string;
  returnArrivalTime: string;
  metadata: Airline;
  outbound: FlightSegment;
  inbound: FlightSegment;
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
