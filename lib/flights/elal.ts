/**
 * El Al on the order summary: a bag is never sold as an add-on - the only
 * upsell is the fare upgrade LITE -> CLASSIC, at one fixed price (Alon + Dor,
 * 30.09). Every number the customer reads about it lives here, so the chip,
 * its info bubble and the Penalties dialog cannot disagree.
 *
 * Why fixed and not quoted live: Amadeus' Branded Fares Upsell endpoint is not
 * on our Enterprise contract (401 on every call, prod included - verified
 * 30.09), so the old "quote the real delta" path never answered and El Al fell
 * through to the ancillary bag. Measured the same day through a bag-included
 * fare search, CLASSIC costs $100-120 a traveler over LITE on the same flights
 * (LON / MAD 100, PAR 110, BCN / MIL 120).
 */

/** Carriers sold as a fare upgrade instead of an ancillary bag. */
export const FARE_UPGRADE_CARRIERS: ReadonlySet<string> = new Set(["LY"]);

export const ELAL_CLASSIC_BRAND = "CLASSIC";

/** Per traveler, for the whole round trip. */
export const ELAL_CLASSIC_UPGRADE_USD = 120;

/** CLASSIC's cancellation fee per traveler, and until when it applies.
 *  Amadeus' own fare rule read USD 190 on 30.09 (LITE: non-refundable). */
export const ELAL_CLASSIC_CANCEL_FEE_USD = 180;
export const ELAL_CLASSIC_CANCEL_HOURS = 48;

/** The info bubble next to "שדרוג לקלאסיק". */
export const ELAL_CLASSIC_INFO_HE = `שדרוג זה מקנה מזוודה לבטן המטוס, הושבה ללא עלות באתר אל על ודמי ביטול נוחים על הטיסה של ${ELAL_CLASSIC_CANCEL_FEE_USD} דולר עד ${ELAL_CLASSIC_CANCEL_HOURS} שעות לפני ההמראה.`;

/** The validating carrier of an Amadeus offer, upper-cased ("" when unknown). */
export const validatingCarrier = (offer: {
  validatingAirlineCodes?: string[];
  itineraries?: Array<{ segments?: Array<{ carrierCode?: string }> }>;
}): string =>
  String(
    offer.validatingAirlineCodes?.[0] ??
      offer.itineraries?.[0]?.segments?.[0]?.carrierCode ??
      "",
  ).toUpperCase();
