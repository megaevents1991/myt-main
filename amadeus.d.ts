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
        get(params: { keyword: string; subType: string }): Promise<any>;
      };
    };

    shopping: {
      flightOffersSearch: {
        get(params: {
          originLocationCode: string;
          destinationLocationCode: string;
          departureDate: string;
          returnDate: string;
          adults: string;
          max: string;
        }): Promise<any>;
      };
    };
  }
}
