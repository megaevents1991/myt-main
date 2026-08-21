import validator from "validator";
import type { AddedBagsInfo, OrderHotel } from "@/lib/app.types";
import type { Rate } from "@/lib/hotel.type";
import type { HotelsData } from "@/app/hooks/HotelFetch.provider";

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
 *  - no same-room rate with breakfast exists in that (trusted) search.
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
    request.checkout !== selectedHotel.checkout
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
      isSameRoom(selectedHotel.rate, r)
  );
  if (!candidates.length) return null;

  const cheapest = candidates.reduce((best, r) =>
    rateShowAmount(r) < rateShowAmount(best) ? r : best
  );
  const cheapestPrice = rateShowAmount(cheapest);
  if (!Number.isFinite(cheapestPrice)) return null;

  return { rate: cheapest, deltaUsd: cheapestPrice - currentPrice };
};
