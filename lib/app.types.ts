import { Airline } from "aircodes";
import { Guest, Rate } from "./hotel.type";
import { EntryFieldTypes } from "contentful";

export type EventType =
  | "sports_event"
  | "music_event"
  | "sports_event_dynamic"
  | "music_live_event_dynamic"
  | "tx_event";

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
    country_code?: string;
  };
  map_image_url: string;
  description: string;
  card_image_url: string;
  // Card "blob" art (set in the backoffice). When art_image_url (a transparent
  // cut-out PNG) is present the card renders it on a neon brand blob; otherwise
  // it falls back to the full card_image_url photo. art_color_index (0–5) and
  // art_shape_index (0–3) pick the blob colour + shape; omitted = derived from id.
  art_image_url?: string | null;
  art_color_index?: number | null;
  art_shape_index?: number | null;
  tickets_and_rates: EventTicket[];
  def_date_depart: string;
  def_date_return: string;
  usual_price: number;
  base_flight_price: number;
  base_hotel_price: number;
  is_prioritized: boolean;
  skip_flight?: boolean;
  // Extra per-ticket markup (USD) added when skip_flight is true.
  // Compensates for the markup normally embedded in base_flight_price.
  skip_flight_markup?: number | null;
  is_deleted: string;
  tags: string;
  tx_excluded_sections?: string[];
  event_additional_markup?: number | null;
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
  virtualOfferType?: boolean;
  isOffline?: boolean;
  // When isOffline is true, these reference the source row in the `flights`
  // inventory table so the backoffice can attribute the reservation and
  // decrement stock. offlineRawPrice is the true per-traveler inventory cost
  // (before customer-facing normalization).
  offlineId?: number;
  offlineRawPrice?: number;
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
  isOffline?: boolean;
  // When isOffline is true: the offline_hotels.id values consumed by this
  // booking (one entry per room unit, so a triple+double combo yields two
  // ids). `offlineRawPrice` is the summed inventory cost across those rows.
  // `offlineId` is kept as the first id for legacy backoffice code paths.
  offlineId?: number;
  offlineIds?: number[];
  offlineRawPrice?: number;
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
  },
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

export type SortOptions = "price_asc" | "rating" | "distance_asc";

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
        "Apart-hotel",
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

export type VipConfig = {
  enabled: boolean;
  details: string;
};

export type EventTicket = {
  category: string;
  price: number;
  id: string;
  description: string;
  colorOnTheMap: string;
  vendor?: string;
  eid?: string;
  available?: boolean;
  vip?: VipConfig;
};

export type OrderTicket = Omit<EventTicket, "colorOnTheMap"> & {
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
    event_type: EventType;
    location_name: string;
    number_of_ticket: number;
    category: string;
    event_tags?: string;
    event_additional_markup?: number | null;
    price_per_ticket: number;
    total_tickets_price: number;
    vendor?: string;
    id?: string;
  };
  flight_order_info: Flight | Record<string, never>; // empty object {} indicates flight was skipped
  hotel_order_info: OrderHotel | Record<string, never>; // empty object {} indicates hotel was skipped
  user_shown_price: number;
  event_id: number;
  aff_partner_tracking_code: string;
  booking_reference: string;
  final_purchase_price_ils: number;
  exchange_rate_usd_ils_100: number;
  is_agent_booking: boolean;
  confirmation_email_sent: boolean;
  status?: string;
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
    seoTitle?: string;
    metaDescription?: string;
    metaTags?: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};

export type CarouselFields = {
  contentTypeId: "carousel";
  fields: {
    title?: string;
    items: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ArtistFields>>;
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
    seoTitle?: string;
    metaDescription?: string;
    metaTags?: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};

/**
 * Backoffice CMS templates — one typed table per content type (replacing
 * Contentful). Every table shares `TemplateBase`. Shared DB shape: keep in sync
 * with backoffice `types/template.types.ts` + per-type files.
 */
export interface TemplateBase {
  id: number;
  slug: string;
  name: string;
  name_english: string | null;
  image_url: string | null;
  // Blob card-art (optional). When art_image_url is set the site shows the
  // cut-out over a neon blob; otherwise it falls back to image_url.
  art_image_url: string | null;
  art_color_index: number | null;
  art_shape_index: number | null;
  display_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Category — typed row of the Supabase `categories` table. Managed in the
 * backoffice, read by this app. Keep in sync with backoffice
 * `types/category.types.ts`.
 */
export interface Category extends TemplateBase {
  subtitle: string | null;
  tag: string | null;
  sport: string | null;
  /** Artist/team page IDs grouped under this category (Contentful IDs for now). */
  member_ids: string[];
  link_url: string | null;
}

/**
 * (Legacy / reference) Contentful-backed category type. Kept for reference;
 * the live source is the Supabase `categories` table (see `Category` above).
 */
export type CategoryFields = {
  contentTypeId: "categoryTemplate";
  fields: {
    name: string;
    nameEnglish?: string;
    /** Meta line under the title, e.g. "עונת 2025/26 · אירופה · שלב ההכרעה". */
    subtitle?: string;
    /** Grouping label for the homepage section, e.g. "כדורגל". */
    sport?: string;
    /** Optional badge text, e.g. "כרטיסים אחרונים". */
    tag?: string;
    heroBanner: EntryFieldTypes.Object<{
      fields?: {
        file?: {
          url?: string;
          details?: { image?: { height?: number; width?: number } };
        };
        description?: string;
        title?: string;
      };
    }>;
    /** Artist/team entries that belong to this category. */
    members?: EntryFieldTypes.Array<
      EntryFieldTypes.EntryLink<ArtistFields | FootballFields>
    >;
    seoTitle?: string;
    metaDescription?: string;
    metaTags?: string;
    sys: EntryFieldTypes.Object<{ id: string }>;
  };
};

export type BlogTemplateFields = {
  contentTypeId: "blogTemplate";
  fields: {
    name: string;
    title: string;
    previewText: string;
    byWho?: string;
    heroBanner?: EntryFieldTypes.Object<{
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
    mainContent: EntryFieldTypes.Object<{
      content: {
        content: {
          value?: string;
        }[];
      }[];
    }>;
    seoTitleTag?: string;
    metaDescription?: string;
    metaTags?: string;
    sys: EntryFieldTypes.Object<{
      id: string;
    }>;
  };
};

export type FootballTeam = {
  sys: {
    id: string;
  };
  fields: {
    name?: string;
    nameDBenglish?: string;
    previewText?: string;
    heroBanner?: {
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
    };
    bio?: {
      content?: {
        content?: {
          value?: string;
        }[];
      }[];
    };
    seoTitle?: string;
    metaDescription?: string;
    metaTags?: string;
    // Blob card-art (Supabase art_* columns; absent on Contentful-fallback rows).
    artImageUrl?: string;
    artColorIndex?: number;
    artShapeIndex?: number;
    // Backoffice-managed page enrichments (Supabase artists/football_teams).
    /** #19b: YouTube URL that plays behind the hero circle. */
    heroVideoUrl?: string;
    /** #20: promo banners on the page. */
    banners?: { image_url?: string; link_url?: string; title?: string }[];
    /** #21: image gallery URLs. */
    gallery?: string[];
    /** #24: performance videos (YouTube). */
    videos?: { url?: string; label?: string }[];
  };
};

export type Artist = {
  sys: {
    id: string;
  };
  fields: {
    name?: string;
    nameDBenglish?: string;
    previewText?: string;
    heroBanner?: {
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
    };
    bio?: {
      content?: {
        content?: {
          value?: string;
        }[];
      }[];
    };
    seoTitle?: string;
    metaDescription?: string;
    metaTags?: string;
    // Blob card-art (Supabase art_* columns; absent on Contentful-fallback rows).
    artImageUrl?: string;
    artColorIndex?: number;
    artShapeIndex?: number;
    // Backoffice-managed page enrichments (Supabase artists/football_teams).
    /** #19b: YouTube URL that plays behind the hero circle. */
    heroVideoUrl?: string;
    /** #20: promo banners on the page. */
    banners?: { image_url?: string; link_url?: string; title?: string }[];
    /** #21: image gallery URLs. */
    gallery?: string[];
    /** #24: performance videos (YouTube). */
    videos?: { url?: string; label?: string }[];
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
