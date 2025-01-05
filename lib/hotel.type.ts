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
  id: string;
  rates: Rate[];
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
};

type PaymentType = {
  amount: string;
  show_amount: string;
  currency_code: string;
  show_currency_code: string;
  by: string;
  is_need_credit_card_data: boolean;
  is_need_cvc: boolean;
  type: string;
  tax_data: Record<string, unknown>;
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

type Guest = {
  adults: number;
  children: number[];
};
