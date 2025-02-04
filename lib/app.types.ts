import { Airline } from "aircodes";
import { Guest, Rate } from "./hotel.type";
import { EntryFieldTypes } from "contentful";

export type Event = {
  id: number;
  name: string;
  date: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
    city_iata: string;
  };
  map_image_url: string;
  description: string;
  card_image_url: string;
  tickets_and_rates: EventTicket[];
  def_date_depart: string;
  def_date_return: string;
  usual_price: number;
  base_flight_price: number;
  base_hotel_price: number;
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
  stops: { iataCode: string; duration: number | null }[];
  duration: string;
  checkBagsIncluded: boolean;
  flightNumber?: string;
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

export interface OrderData {
  main_contact_first_name: string;
  main_contact_last_name: string;
  main_contact_phone_number: string;
  main_contact_email: string;
  more_pax_info: {
    first_name: string;
    last_name: string;
  }[];
  event_order_info: {
    event_id: number;
    date: Date;
    name: string;
    location_name: string;
    number_of_ticket: number;
    category: string;
    price_per_ticket: number;
    total_tickets_price: number;
  };
  flight_order_info: object; // You might need to define a specific interface here
  hotel_order_info: object; // You might need to define a specific interface here
  user_shown_price: number;
  event_id: number;
  aff_partner_id: string;
}

export type ArtistFields = {
  contentTypeId: "artistTemplate";
  fields: {
    bio: EntryFieldTypes.Object<{
      content: {
        content: {
          value?: string;
        }[];
      }[];
    }>;
    previewText: string;
    heroBanner: EntryFieldTypes.Object<{
      fields?: {
        file?: {
          url?: string;
          details?: {
            image?: {
              height?: number;
              width?: number;
            };
          };
        };
        description?: string;
        title?: string;
      };
    }>;
    name: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};

export type FootballFields = {
  contentTypeId: "footballTeamTemplate";
  fields: {
    bio: EntryFieldTypes.Object<{
      content: {
        content: {
          value?: string;
        }[];
      }[];
    }>;
    previewText: string;
    heroBanner: EntryFieldTypes.Object<{
      fields?: {
        file?: {
          url?: string;
          details?: {
            image?: {
              height?: number;
              width?: number;
            };
          };
        };
        description?: string;
        title?: string;
      };
    }>;
    name: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};
