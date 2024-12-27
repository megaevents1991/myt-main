/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "amadeus" {
  export default class Amadeus {
    constructor(options: { clientId: string; clientSecret: string });

    static location: {
      AIRPORT: string;
      CITY: string;
      COUNTRY: string;
    };

    referenceData: {
      locations: {
        get(params: {
          keyword: string;
          subType: string;
        }): Promise<AmadeusLocationResponse>;
      };
      airlines: {
        get(params: { airlineCodes: string }): Promise<any>;
      };
    };

    shopping: {
      flightOffersSearch: {
        get(params: {
          originLocationCode: string; // IATA code of the origin airport (e.g., "JFK")
          destinationLocationCode: string; // IATA code of the destination airport (e.g., "LAX")
          departureDate: string; // ISO date format (e.g., "2024-11-25")
          returnDate?: string; // Optional, ISO date format (e.g., "2024-11-30")
          adults: number; // Number of adult passengers
          children?: number; // Number of children (optional)
          infants?: number; // Number of infants (optional)
          travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"; // Travel class
          includedAirlineCodes?: string[]; // Optional, array of airline IATA codes to include
          excludedAirlineCodes?: string[]; // Optional, array of airline IATA codes to exclude
          nonStop?: boolean; // Optional, whether only non-stop flights should be considered
          currencyCode?: string; // Optional, currency code for pricing (e.g., "USD")
          maxPrice?: number; // Optional, maximum price for the flight
          max?: number; // Optional, maximum number of results to return
        }): Promise<AmadeusResponse>;
      };
    };
  }
}

type AmadeusResponse = {
  result: {
    data: {
      type: string;
      id: string;
      source: string;
      instantTicketingRequired: boolean;
      nonHomogeneous: boolean;
      oneWay: boolean;
      isUpsellOffer: boolean;
      lastTicketingDate: string;
      lastTicketingDateTime: string;
      numberOfBookableSeats: number;
      itineraries: Array<{
        duration: string;
        segments: {
          departure: {
            iataCode: string;
            terminal?: string;
            at: string;
          };
          arrival: {
            iataCode: string;
            at: string;
            terminal?: string;
          };
          carrierCode: string;
          number: string;
          aircraft: {
            code: string;
          };
          operating: {
            carrierCode: string;
          };
          duration: string;
          id: string;
          numberOfStops: number;
          blacklistedInEU: boolean;
          stops?: Array<{
            iataCode: string;
            duration: string;
            arrivalAt: string;
            departureAt: string;
          }>;
        }[];
      }>;
      price: {
        currency: string;
        total: string;
        base: string;
        fees: Array<{
          amount: string;
          type: string;
        }>;
        grandTotal: string;
        additionalServices?: Array<{
          amount: string;
          type: string;
        }>;
      };
      pricingOptions: {
        fareType: Array<string>;
        includedCheckedBagsOnly: boolean;
      };
      validatingAirlineCodes: Array<string>;
      travelerPricings: Array<{
        travelerId: string;
        fareOption: string;
        travelerType: string;
        price: {
          currency: string;
          total: string;
          base: string;
        };
        fareDetailsBySegment: Array<{
          segmentId: string;
          cabin: string;
          fareBasis: string;
          brandedFare?: string;
          brandedFareLabel?: string;
          class: string;
          includedCheckedBags: {
            quantity: number;
          };
          amenities?: Array<{
            description: string;
            isChargeable: boolean;
            amenityType: string;
            amenityProvider: {
              name: string;
            };
          }>;
        }>;
      }>;
    }[];
    dictionaries: {
      carriers: Record<string, string>;
    };
  };
};

type AmadeusLocationResponse = {
  data: {
    type: string;
    subType: string;
    name: string;
    detailedName: string;
    id: string;
    self: {
      href: string;
      methods: Array<string>;
    };
    timeZoneOffset: string;
    iataCode: string;
    geoCode: {
      latitude: number;
      longitude: number;
    };
    address: {
      cityName: string;
      cityCode: string;
      countryName: string;
      countryCode: string;
      stateCode: string;
      regionCode: string;
    };
    analytics?: {
      travelers: {
        score: number;
      };
    };
  }[];
};
