/**
 * THE single source of truth for USD/ILS fallback pricing. Client-safe (no
 * server imports) so both the server-side exchangeRateService and the order
 * flow's last-resort fallback use the same numbers — never re-hardcode a rate
 * anywhere else.
 */

/** Hardcoded USD→ILS fallback when every rate source is down. */
export const USD_ILS_FALLBACK_RATE = 2.95;

/** Travel-expenses margin applied on top of the raw USD/ILS rate. */
export const TRAVEL_RATE_MULTIPLIER = 1.015;

/** The travel rate the fallback yields — what customers are charged when even
 *  /api/events-info is unreachable. */
export const FALLBACK_TRAVEL_RATE =
  Math.ceil(USD_ILS_FALLBACK_RATE * TRAVEL_RATE_MULTIPLIER * 100) / 100;
