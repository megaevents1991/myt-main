// aircode.d.ts

declare module "aircodes" {
  /**
   * Interface representing an airline's information.
   */
  export interface Airline {
    iata: string; // The IATA code of the airline (e.g., "AA" for American Airlines).
    name: string; // The name of the airline.
    country: string; // The country the airline is based in.
    logo?: string; // Optional URL to the airline's logo.
  }

  /**
   * Retrieves airline information by its IATA code.
   * @param iataCode - The IATA code of the airline.
   * @returns The airline's information, or `null` when the code is not in the
   *          dataset (the implementation ends in `return airline || null`). The
   *          gaps are real and include large carriers — "W6" (Wizz Air) and
   *          "X3" (TUIfly) both miss — so this MUST stay nullable: reading a
   *          property off the result unguarded previously threw and turned an
   *          entire flight search into a 500.
   */
  export function getAirlineByIata(iataCode: string): Airline | null;
}
