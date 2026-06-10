export type HotelSearchRequest = {
  checkin: string; // Date in YYYY-MM-DD format
  checkout: string; // Date in YYYY-MM-DD format
  residency: string; // Country code (e.g., "gb")
  language: string; // Language code (e.g., "en")
  guests: Array<{
    adults: number; // Number of adult guests
    children: number[]; // Ages of children (empty array if none)
  }>;
  longitude: number; // Longitude of the search location
  latitude: number; // Latitude of the search location
  radius: number; // Search radius in kilometers
  currency: string; // Currency code (e.g., "EUR")
};

export type HotelResponse = {
  data: {
    hotels: Hotel[];
    total_hotels: number;
  };
  debug: {
    request: {
      checkin: string;
      checkout: string;
      residency: string;
      language: string;
      guests: Guest[];
      longitude: number;
      latitude: number;
      radius: number;
      currency: string;
    };
    key_id: number;
    validation_error: string | null;
  };
  status: string;
  error: string | null;
};

export type Hotel = {
  hid: number;
  id: string;
  rates: Rate[];
  isOffline?: boolean;
};

export type Rate = {
  match_hash: string;
  daily_prices: string[];
  meal: string;
  payment_options: {
    payment_types: PaymentType[];
  };
  rg_ext: RoomAttributes;
  room_name: string;
  room_name_info: string | null;
  serp_filters: string[];
  allotment: number | null;
  amenities_data: string[];
  any_residency: boolean;
  deposit: Deposit | null;
  no_show: NoShow | null;
  room_data_trans: RoomDataTrans;
  meal_data: {
    has_breakfast: boolean;
    no_child_meal: boolean;
    value: string;
  };
};

type Taxes = {
  name: string;
  included_by_supplier: boolean;
  amount: string;
  currency_code: string;
}[];

type PaymentType = {
  amount: string;
  show_amount: string;
  currency_code: string;
  show_currency_code: string;
  by: string;
  is_need_credit_card_data: boolean;
  is_need_cvc: boolean;
  type: string;
  tax_data: { taxes: Taxes };
  cancellation_penalties: CancellationPenalties;
};

type CancellationPenalties = {
  policies: CancellationPolicy[];
  free_cancellation_before: string;
};

type CancellationPolicy = {
  start_at: string | null;
  end_at: string | null;
  amount_charge: string;
  amount_show: string;
};

type RoomAttributes = {
  class: number;
  quality: number;
  sex: number;
  bathroom: number;
  bedding: number;
  family: number;
  capacity: number;
  club: number;
};

type Deposit = {
  amount: string;
  currency_code: string;
  is_refundable: boolean;
};

type NoShow = {
  amount: string;
  currency_code: string;
  from_time: string;
};

type RoomDataTrans = {
  main_room_type: string;
  main_name: string;
  bathroom: string | null;
  bedding_type: string;
  misc_room_type: string | null;
};

export type Guest = {
  adults: number;
  children: number[];
};
export type Room = {
  name: string;
  images: string[];
  amenities: string[];
};

export type HotelKind =
  | "Resort"
  | "Sanatorium"
  | "Guesthouse"
  | "Mini-hotel"
  | "Castle"
  | "Hotel"
  | "Boutique_and_Design"
  | "Apartment"
  | "Cottages_and_Houses"
  | "Farm"
  | "Villas_and_Bungalows"
  | "Camping"
  | "Hostel"
  | "BNB"
  | "Glamping"
  | "Apart-hotel";

export type HotelInfoClient = {
  rooms: Record<string, Room>;
  general: Room;
  metadata: {
    hid: number;
    hotelName: string;
    address: string;
    rating: number;
    kind: HotelKind;
    id: string;
    longitude: number;
    latitude: number;
    distanceFromCenter: number;
    // RateHawk guest review score (0–10) + review count. NOT TripAdvisor —
    // ETG does not expose TripAdvisor via API. 0/undefined = no score → hide.
    guestRating?: number;
    guestReviewCount?: number;
  };
};

export type HotelsInfoClient = Record<string, HotelInfoClient>;

// Normalized guest-rating record cached on the `hotels` table (by hid).
export type HotelGuestRating = {
  guest_rating: number; // 0–10 overall score
  guest_review_count: number;
  guest_detailed_ratings: Record<string, number> | null; // cleanness/location/...
};

// Response of POST https://api.worldota.net/api/content/v1/hotel_reviews_by_ids/
// Shape is defensive — confirm exact fields against the first real response once
// ETG enables Content-API reviews access on the key.
export type HotelReviewsResponse = {
  data?: Array<{
    hid: number;
    id?: string;
    rating?: number; // overall guest score
    detailed_ratings?: Record<string, number>;
    reviews?: Array<{
      rating?: number;
      detailed_review?: Record<string, number>;
    }>;
  }>;
  status?: string;
  error?: string | null;
};
