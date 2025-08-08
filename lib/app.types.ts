import { Airline } from "aircodes";
import { Guest, Rate } from "./hotel.type";
import { EntryFieldTypes } from "contentful";

export type EventType =
  | "sports_event"
  | "music_event"
  | "sports_event_dynamic";

export type Event = {
  id: number;
  name: string;
  name_english: string;
  type: EventType;
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
  is_prioritized: boolean;
  is_deleted: string;
  tags: string;
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
  offer: FlightOffer;
  penalties?: string;
  bags?: object;
};

export type FlightSegment = {
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  stops: { iataCode: string; duration: number | null }[];
  duration: string;
  checkBagsIncluded: boolean;
  cabinBagsIncluded: boolean;
  flightNumber?: string;
};

export type OrderHotel = {
  rate: Rate;
  address: string;
  name: string;
  id: string;
  price: string;
  guests: Guest[];
  checkin: string;
  checkout: string;
  hotelInformation: {
    hotelName: string;
    roomName: string;
    stars: number;
    amenities: string[];
    distance: number;
  };
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
  gtmIdnts?: string;
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
      type: "meal";
      value: ["withMeal", "withoutMeal"];
    }
  | {
      type: "kind";
      value: [
        "Resort",
        "Sanatorium",
        "Guesthouse",
        "Mini-hotel",
        "Castle",
        "Hotel",
        "Boutique_and_Design",
        "Apartment",
        "Cottages_and_Houses",
        "Farm",
        "Villas_and_Bungalows",
        "Camping",
        "Hostel",
        "BNB",
        "Glamping",
        "Apart-hotel"
      ];
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
    }
  | {
      type: "freeCancellation";
      value: ("withFreeCancellation" | "withoutFreeCancellation")[];
    };

export type FlightSearchCriteria =
  | {
      type: "departureRanges" | "arrivalRanges";
      value: TimeRange[];
    }
  | {
      type: "maxPrice";
      value: number;
    }
  | {
      type: "flightDuration";
      value: number;
    }
  | {
      type: "airline";
      value: string[];
    }
  | {
      type: "numOfStops";
      value: string[];
    }
  | {
      type: "luggage";
      value: string[];
    };

export type EventTicket = {
  category: string;
  price: number;
  id: string;
  description: string;
  colorOnTheMap: string;
  vendor?: string; // Optional vendor field
  available?: boolean; // For dynamic sports events
  lastUpdated?: string; // ISO string for last update timestamp
};

export type OrderTicket = Omit<EventTicket, "description" | "colorOnTheMap"> & {
  quantity: number;
};

export type OrderData = {
  payment_info?: object;
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
    vendor?: string;
    id?: string;
  };
  flight_order_info: Flight; // You might need to define a specific interface here
  hotel_order_info: OrderHotel; // You might need to define a specific interface here
  user_shown_price: number;
  event_id: number;
  aff_partner_tracking_code: string;
  booking_reference: string;
  final_purchase_price_ils: number;
  exchange_rate_usd_ils_100: number;
  is_agent_booking: boolean;
  confirmation_email_sent: boolean;
};

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
    nameDBenglish: string;
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
    nameDBenglish: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};

export type Log = {
  type?: "error" | "warn" | "log";
  data: Record<string, unknown> | string;
};

export type PaymentRequest = {
  amount: number;
  email: string;
  orderId: string;
  promoCode: string;
};
