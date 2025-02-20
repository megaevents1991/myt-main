export type HotelInfo = {
  data: {
    address: string;
    amenity_groups: Array<{
      amenities: Array<string>;
      group_name: string;
      non_free_amenities: Array<string>;
    }>;
    check_in_time: string;
    check_out_time: string;
    description_struct: Array<{
      paragraphs: Array<string>;
      title: string;
    }>;
    email: string;
    facts: {
      electricity: {
        frequency: Array<number>;
        sockets: Array<string>;
        voltage: Array<string>;
      };
      floors_number: string;
      rooms_number: string;
      year_built: string;
      year_renovated: string;
    };
    front_desk_time_end: string;
    front_desk_time_start: string;
    hid: number;
    hotel_chain: string;
    id: string;
    images: Array<string>;
    images_ext: Array<{
      category_slug: string;
      url: string;
    }>;
    is_closed: boolean;
    is_gender_specification_required: boolean;
    keys_pickup: {
      apartment_extra_information: string;
      apartment_office_address: string;
      email: string;
      is_contactless: boolean;
      phone: string;
      type: string;
    };
    kind: string;
    latitude: number;
    longitude: number;
    metapolicy_extra_info: string;
    metapolicy_struct: {
      add_fee: Array<string>;
      check_in_check_out: Array<string>;
      children: Array<string>;
      children_meal: Array<string>;
      cot: Array<{
        amount: number;
        currency: string;
        inclusion: string;
        price: string;
        price_unit: string;
      }>;
      deposit: Array<{
        availability: string;
        currency: string;
        deposit_type: string;
        payment_type: string;
        price: string;
        price_unit: string;
        pricing_method: string;
      }>;
      extra_bed: Array<string>;
      internet: Array<string>;
      meal: Array<string>;
      no_show: {
        availability: string;
        day_period: string;
        time: string;
      };
      parking: Array<string>;
      pets: Array<{
        currency: string;
        inclusion: string;
        pets_type: string;
        price: string;
        price_unit: string;
      }>;
      shuttle: Array<string>;
      visa: {
        visa_support: string;
      };
    };
    name: string;
    payment_methods: Array<string>;
    phone: string;
    policy_struct: Array<{
      paragraphs: Array<string>;
      title: string;
    }>;
    postal_code: string;
    region: {
      country_code: string;
      iata: string;
      id: number;
      name: string;
      type: string;
    };
    room_groups: Array<{
      images: Array<string>;
      images_ext: Array<{
        category_slug: string;
        url: string;
      }>;
      name: string;
      name_struct: {
        bathroom: string;
        bedding_type: string;
        main_name: string;
      };
      rg_ext: {
        balcony: number;
        bathroom: number;
        bedding: number;
        bedrooms: number;
        capacity: number;
        class: number;
        club: number;
        family: number;
        floor: number;
        quality: number;
        sex: number;
        view: number;
      };
      room_amenities: Array<string>;
      room_group_id: number;
    }>;
    serp_filters: Array<string>;
    star_certificate: string;
    star_rating: number;
  };
  debug: string;
  error: string;
  status: string;
};


export type HotelInfoDB = {
  address: string;
  name: string;
  amenity_groups: Array<{
    amenities: Array<string>;
    group_name: string;
    non_free_amenities: Array<string>;
  }>;
  hid: number;
  _id: string;
  images_ext: Array<{
    category_slug: string;
    url: string;
  }>;
  latitude: number;
  kind: string;
  longitude: number;
  room_groups: Array<{
    images: Array<string>;
    images_ext: Array<{
      category_slug: string;
      url: string;
    }>;
    name: string;
    name_struct: {
      bathroom: string;
      bedding_type: string;
      main_name: string;
    };
    rg_ext: {
      balcony: number;
      bathroom: number;
      bedding: number;
      bedrooms: number;
      capacity: number;
      class: number;
      club: number;
      family: number;
      floor: number;
      quality: number;
      sex: number;
      view: number;
    };
    room_amenities: Array<string>;
    room_group_id: number;
  }>;
  star_rating: number;
  city: string;
  created_at: string;
};
