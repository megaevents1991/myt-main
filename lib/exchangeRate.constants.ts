/**
 * THE single source of truth for USD/ILS fallback pricing. Client-safe (no
 * server imports) so both the server-side exchangeRateService and the order
 * flow's last-resort fallback use the same numbers - never re-hardcode a rate
 * anywhere else.
 */

/**
 * Hardcoded USD→ILS fallback when every rate source is down. Only ever the
 * fallback - the live rate comes from exchangeRateService. Kept a round 3
 * (Dor, 2026-09-17): 2.95 sat ~3% under the market, so an outage undercharged.
 */
export const USD_ILS_FALLBACK_RATE = 3;

/** Travel-expenses margin applied on top of the raw USD/ILS rate. */
export const TRAVEL_RATE_MULTIPLIER = 1.015;

/** The travel rate the fallback yields - what customers are charged when even
 *  /api/events-info is unreachable. */
export const FALLBACK_TRAVEL_RATE =
  Math.ceil(USD_ILS_FALLBACK_RATE * TRAVEL_RATE_MULTIPLIER * 100) / 100;
