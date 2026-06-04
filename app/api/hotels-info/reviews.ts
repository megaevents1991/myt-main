import { authHeader } from "../keys";
import { HotelGuestRating, HotelReviewsResponse } from "@/lib/hotel.type";

// RateHawk/ETG Content-API endpoint for guest reviews. Requires Content-API
// access to be enabled on the key by ETG support — without it this returns
// 403/empty and callers fall back to "no score" (UI hides the badge).
const HOTEL_REVIEWS_URL =
  "https://api.worldota.net/api/content/v1/hotel_reviews_by_ids/";

// NOTE: ETG cannot share TripAdvisor data via API. This is RateHawk's OWN guest
// review score. Scale is treated as 0–10 (matches the green badge on ratehawk.com).
// Mapping is isolated here so it's trivial to adjust once a real response is seen.
const normalize = (
  entry: NonNullable<HotelReviewsResponse["data"]>[number]
): HotelGuestRating => {
  const reviews = entry.reviews ?? [];

  // Prefer an explicit overall rating; otherwise average the per-review ratings.
  const overall =
    typeof entry.rating === "number"
      ? entry.rating
      : reviews.length
      ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
      : 0;

  return {
    guest_rating: Math.round(overall * 10) / 10,
    guest_review_count: reviews.length,
    guest_detailed_ratings: entry.detailed_ratings ?? null,
  };
};

// Fetch guest ratings for the given hids. Returns a map hid -> rating record.
// Never throws — a failure (incl. access not yet granted) yields an empty map.
export const getHotelReviews = async (
  hids: number[]
): Promise<Record<number, HotelGuestRating>> => {
  if (!hids.length) return {};

  try {
    const res = await fetch(HOTEL_REVIEWS_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${authHeader}` },
      body: JSON.stringify({ hids, language: "en" }),
    });

    if (!res.ok) {
      console.error("Hotel reviews fetch failed:", res.status, await res.text());
      return {};
    }

    const json: HotelReviewsResponse = await res.json();
    const out: Record<number, HotelGuestRating> = {};
    for (const entry of json.data ?? []) {
      if (entry?.hid != null) out[entry.hid] = normalize(entry);
    }
    return out;
  } catch (error) {
    console.error("Hotel reviews API error:", error);
    return {};
  }
};
