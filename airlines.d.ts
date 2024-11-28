// aircode.d.ts

declare module "aircodes" {
  /**
   * Interface representing an airline's information.
   */
  export interface Airline {
    iataCode: string; // The IATA code of the airline (e.g., "AA" for American Airlines).
    name: string; // The name of the airline.
    country: string; // The country the airline is based in.
    logo?: string; // Optional URL to the airline's logo.
  }

  /**
   * Retrieves airline information by its IATA code.
   * @param iataCode - The IATA code of the airline.
   * @returns A Promise that resolves to the airline's information or null if not found.
   */
  export function getAirlineByIata(iataCode: string): Airline | null;
}
