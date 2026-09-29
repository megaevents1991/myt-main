import validator from "validator";
import type { AddedBagsInfo, OrderHotel } from "@/lib/app.types";
import type { Rate } from "@/lib/hotel.type";
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";
import { rateIsRefundable, sameRateTerms } from "@/lib/hotelRateTerms";

export type Fields = "firstName" | "lastName" | "phone" | "email";

export const shortenAirlineName = (name: string | undefined) => {
  if (!name) {
    return "";
  }

  const words = name.split(/\s+/); // Split by spaces
  let shortName = "";
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // If it's the first word and longer than 6 chars, return it directly
    if (i === 0 && word.length > 6) {
      return word;
    }

    if (charCount + word.length > 6) {
      if (word.length >= 10) {
        return shortName.trim(); // Stop if the word is very long (10+ chars)
      } else {
        return (shortName + " " + word[0] + ".").trim(); // Add first letter of next word + "."
      }
    }

    shortName += (shortName ? " " : "") + word;
    charCount += word.length;
  }

  return shortName.trim();
};

export const validate: Record<Fields, (value: string) => string> = {
  firstName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם פרטי הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם פרטי חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם פרטי חייב להיות באנגלית בלבד";
    }
    return "";
  },
  lastName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם משפחה הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם משפחה חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם משפחה חייב להיות באנגלית בלבד";
    }
    return "";
  },
  email: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "אימייל הוא שדה חובה";
    if (!validator.isEmail(trimmedValue)) return "נא להזין כתובת אימייל תקינה";
    return "";
  },
  phone: (value: string) => {
    const cleanPhone = value.replace(/[- ]/g, "");
    if (!cleanPhone) return "טלפון נייד הוא שדה חובה";
    if (!cleanPhone.startsWith("05")) return "מספר נייד חייב להתחיל ב-05";
    if (!validator.isMobilePhone(cleanPhone, "he-IL")) {
      return "נא להזין מספר טלפון תקין";
    }
    return "";
  },
};

/**
 * Check if the price is outside the pack boundries
 * @param totalPrice - Total price for all passengers
 * @param basePrice - Base price per single passenger
 * @param paxs - Number of passengers
 * @returns boolean
 */
export const priceOutsidePackBoundaries = (
  totalPrice: number,
  basePrice: number,
  paxs: number
) => {
  const price = totalPrice / paxs;
  return Math.abs(price - basePrice) >
    Number(process.env.NEXT_PUBLIC_BOUNDRIES || "4")
    ? true
    : false;
};

/**
 * The combined baggage-upsell total (checked + cabin/trolley, whichever were
 * added) that actually enters the price - see useOrderVars's
 * calculateBaseTotal (app/order/hooks.tsx), which adds this straight into
 * the package total the same way an over-base flight/hotel pick does. The
 * persisted shape (Flight["added_bags"]) keeps the checked-bag fields at the
 * top level (matches ops' `flight_order_info.added_bags` read) with `cabin`
 * nested - this is the one place that combines them into money.
 */
export const getAddedBagsTotalUsd = (addedBags?: AddedBagsInfo | null): number => {
  if (!addedBags) return 0;
  return (addedBags.total_usd || 0) + (addedBags.cabin?.total_usd || 0);
};

/** Total checked bags an added_bags entry represents - the new shape stores
 *  the booking total directly (checked_qty); legacy per-pax entries (pre the
 *  20.8 quantity fix) multiply out by the traveler count. */
export const addedCheckedBagsCount = (
  addedBags: AddedBagsInfo | null | undefined,
  numOfTravelers: number,
): number =>
  addedBags?.checked_qty ??
  (addedBags?.checked_qty_per_pax ?? 0) * Math.max(1, numOfTravelers);

/**
 * Included-meals label for a hotel rate - reuses the exact "כולל ארוחת בוקר"
 * copy HotelCardHeader already shows during hotel selection. `meal_data.value`
 * is a carrier/supplier-defined code (RateHawk-style: "nomeal", "breakfast",
 * "half-board", "full-board", "all-inclusive", ...) - richer plans upgrade the
 * label when recognizable; anything unrecognized falls back to the plain
 * breakfast/no-meals binary so this never renders a raw provider code.
 */
export const mealPlanLabel = (rate: Rate | undefined): string => {
  if (!rate?.meal_data?.has_breakfast) return "ללא ארוחות";
  const value = (rate.meal_data.value || "").toLowerCase();
  if (value.includes("all")) return "הכל כלול";
  if (value.includes("full")) return "פנסיון מלא";
  if (value.includes("half")) return "חצי פנסיון";
  return "כולל ארוחת בוקר";
};

/** Same "room" for the breakfast upsell = same display name + bed
 *  configuration - the identical grouping key components/ui/hotelCard.tsx's
 *  handleRoomSelect already uses to key into hotelInfo.rooms. Rate has no
 *  dedicated room id, so this is the closest established equivalent. */
const isSameRoom = (a: Rate | undefined, b: Rate): boolean =>
  !!a &&
  a.room_data_trans?.main_name === b.room_data_trans?.main_name &&
  a.room_data_trans?.bedding_type === b.room_data_trans?.bedding_type;

/**
 * The same hotel again on other dates (a split stay that comes back to a city,
 * Dor 28.09): of that hotel's rates, the one closest to the rate picked before -
 * same room first, then same breakfast, then same refundability; the cheapest
 * wins a tie (rates arrive cheapest-first). Null when the hotel has no rates.
 */
export const closestRate = (rates: Rate[], ref: Rate | undefined): Rate | null => {
  if (!rates.length) return null;
  if (!ref) return rates[0];
  const score = (r: Rate) =>
    (isSameRoom(ref, r) ? 4 : 0) +
    (!!r.meal_data?.has_breakfast === !!ref.meal_data?.has_breakfast ? 2 : 0) +
    (rateIsRefundable(r) === rateIsRefundable(ref) ? 1 : 0);
  return rates.reduce((best, r) => (score(r) > score(best) ? r : best), rates[0]);
};

/** Same sum as lib/price.utils getTotalPersons - kept local so this module
 *  stays free of that file's JSX (and testable under plain vitest). */
const totalGuests = (rooms: { adults: number; children: number[] }[] | undefined): number =>
  (rooms ?? []).reduce((n, room) => n + room.adults + (room.children?.length ?? 0), 0);

const rateShowAmount = (rate: Rate): number =>
  Number(rate.payment_options?.payment_types?.[0]?.show_amount);

export type BreakfastUpgrade = {
  rate: Rate;
  /** Delta for the WHOLE stay (not per-guest) - what the button shows. */
  deltaUsd: number;
};

/**
 * The same room's cheapest breakfast-included rate, found in the hotel
 * search results already sitting in HotelFetchContext (the serp the
 * customer picked selectedHotel from) - never a fresh fetch, per spec
 * ("rate swap, zero schema change"). Returns null (button hides) when:
 *  - the selected rate already includes breakfast (nothing to upsell),
 *  - the hotel is offline inventory (one rate per row - literally no
 *    sibling can exist, see app/api/offline-hotels/route.ts),
 *  - hotelsData holds a search for different dates than THIS hotel was
 *    picked from (package-prefilled / resumed-order state, or simply a
 *    later in-flow date change) - trusting it then would show a delta
 *    computed against the wrong stay,
 *  - hotelsData holds a search for a different number of guests,
 *  - no same-room rate with breakfast AND the same terms (refundability,
 *    payment type, rg_ext - lib/hotelRateTerms.ts) exists in that search,
 *  - the cheapest such rate is CHEAPER than the selected one (owner 24.09:
 *    a cheaper "breakfast" sibling means the two rates differ in something
 *    we can't see - don't offer the swap at all rather than as "+$0").
 */
export const findBreakfastUpgrade = (
  selectedHotel: OrderHotel | undefined,
  hotelsData: HotelsData | undefined
): BreakfastUpgrade | null => {
  if (!selectedHotel || selectedHotel.isOffline) return null;
  if (selectedHotel.rate?.meal_data?.has_breakfast) return null;

  const request = hotelsData?.data?.debug?.request;
  if (
    !request ||
    request.checkin !== selectedHotel.checkin ||
    request.checkout !== selectedHotel.checkout ||
    totalGuests(request.guests) !== totalGuests(selectedHotel.guests)
  ) {
    return null;
  }

  const hotel = hotelsData?.data?.data?.hotels?.find(
    (h) => h.id === selectedHotel.id && !h.isOffline
  );
  if (!hotel) return null;

  const currentPrice = rateShowAmount(selectedHotel.rate);
  if (!Number.isFinite(currentPrice)) return null;

  const candidates = hotel.rates.filter(
    (r) =>
      r.match_hash !== selectedHotel.rate?.match_hash &&
      r.meal_data?.has_breakfast &&
      isSameRoom(selectedHotel.rate, r) &&
      sameRateTerms(selectedHotel.rate, r)
  );
  if (!candidates.length) return null;

  const cheapest = candidates.reduce((best, r) =>
    rateShowAmount(r) < rateShowAmount(best) ? r : best
  );
  const cheapestPrice = rateShowAmount(cheapest);
  if (!Number.isFinite(cheapestPrice)) return null;

  // The breakfast sibling can be CHEAPER than the selected rate (56 of 257
  // upgradeable rates in the live Prague serp, e.g. Populus Double Suite
  // $473 → $414 w/ breakfast). A raw delta LOWERED the package total (prod
  // bug 23.8); the clamp that fixed it showed "+$0" while swapping the
  // customer onto a rate with worse terms (24.09). Now: no offer.
  const deltaUsd = cheapestPrice - currentPrice;
  if (deltaUsd < 0) return null;
  return { rate: cheapest, deltaUsd };
};

/** The breakfast rate swap: the charge moves by EXACTLY the shown delta
 *  (never the sibling rate's raw amount - 23.8), the old pick kept so
 *  "הסרה" can restore it. */
export const withBreakfast = (
  hotel: OrderHotel,
  upgrade: BreakfastUpgrade
): OrderHotel => ({
  ...hotel,
  rate: upgrade.rate,
  price: String(+hotel.price + upgrade.deltaUsd),
  breakfast_upgrade: {
    delta_usd: upgrade.deltaUsd,
    prev_price: hotel.price,
    prev_rate: hotel.rate,
    prev_match_hash: hotel.rate?.match_hash,
    prev_refundable: rateIsRefundable(hotel.rate),
  },
});

export const withoutBreakfast = (hotel: OrderHotel): OrderHotel => {
  const upgrade = hotel.breakfast_upgrade;
  if (!upgrade?.prev_rate) return hotel;
  return {
    ...hotel,
    rate: upgrade.prev_rate,
    price: upgrade.prev_price,
    breakfast_upgrade: undefined,
  };
};

/** A split-stay segment's breakfast upsell - captured from the segment's own
 *  search when it was picked (HotelSelection), since the provider only keeps
 *  the main list's search. Null once added or when the rate has breakfast. */
export const segmentBreakfastOffer = (
  hotel: OrderHotel | undefined
): BreakfastUpgrade | null =>
  hotel?.breakfast_offer &&
  !hotel.breakfast_upgrade &&
  !hotel.rate?.meal_data?.has_breakfast
    ? { rate: hotel.breakfast_offer.rate, deltaUsd: hotel.breakfast_offer.delta_usd }
    : null;

/** The hotel as it is saved on the reservation: no in-session restore anchors
 *  (breakfast_offer / breakfast_upgrade.prev_rate are full Rate objects) and
 *  no segment card photos; the swapped-out rate's match_hash + refundability
 *  ride along for ops. */
export const persistableHotel = (hotel: OrderHotel): OrderHotel => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { breakfast_offer, segment_card, ...rest } = hotel;
  return rest.breakfast_upgrade
    ? {
        ...rest,
        breakfast_upgrade: {
          delta_usd: rest.breakfast_upgrade.delta_usd,
          prev_price: rest.breakfast_upgrade.prev_price,
          prev_match_hash: rest.breakfast_upgrade.prev_match_hash,
          prev_refundable: rest.breakfast_upgrade.prev_refundable,
        },
      }
    : rest;
};
