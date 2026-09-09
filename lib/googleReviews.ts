import { supabase } from "@/lib/supabase";

/**
 * "לקוחות משתפים" data. The backoffice mirrors the Mega Events Google
 * Business reviews into `google_reviews` (+ the live rating / count in
 * `google_review_sources`) with a daily cron; this is the read side.
 * Replaced the Elfsight widget on 2026-09-09.
 *
 * Server-only (service client). Pages that render it are ISR, so the query
 * runs once per revalidation, not per visitor.
 */

export interface GoogleReview {
  key: string;
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number;
  text: string;
  /** ISO timestamp. */
  publishedAt: string;
  reviewUrl: string | null;
  replyText: string | null;
  replyAt: string | null;
}

export interface GoogleReviewsData {
  /** Overall rating of the profile (all reviews), e.g. 5.0. */
  rating: number | null;
  /** Total number of reviews on the profile (all ratings). */
  count: number | null;
  mapsUrl: string | null;
  /** Reviews shown on the site: text-only, `MIN_RATING`+, newest first. */
  reviews: GoogleReview[];
}

/** Same filter the widget had: 5-star reviews with text. */
export const MIN_RATING = 5;
const MAX_REVIEWS = 100;

interface ReviewRow {
  review_key: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  published_at: string;
  review_url: string | null;
  reply_text: string | null;
  reply_at: string | null;
}

interface SourceRow {
  rating: number | string | null;
  review_count: number | null;
  maps_url: string | null;
}

export async function getGoogleReviews(): Promise<GoogleReviewsData | null> {
  const [reviewsRes, sourceRes] = await Promise.all([
    supabase
      .from("google_reviews")
      .select(
        "review_key,author_name,author_photo_url,rating,text,published_at,review_url,reply_text,reply_at",
      )
      .eq("is_hidden", false)
      .gte("rating", MIN_RATING)
      .not("text", "is", null)
      .neq("text", "")
      .order("published_at", { ascending: false })
      .limit(MAX_REVIEWS),
    supabase
      .from("google_review_sources")
      .select("rating,review_count,maps_url")
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (reviewsRes.error) {
    console.error("[googleReviews] reviews:", JSON.stringify(reviewsRes.error));
    return null;
  }
  if (sourceRes.error) {
    console.error("[googleReviews] source:", JSON.stringify(sourceRes.error));
  }

  const rows = (reviewsRes.data ?? []) as ReviewRow[];
  const source = (sourceRes.data ?? null) as SourceRow | null;
  const rating = source?.rating == null ? null : Number(source.rating);

  return {
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    count: source?.review_count ?? null,
    mapsUrl: source?.maps_url ?? null,
    reviews: rows
      .filter((r) => typeof r.text === "string" && r.text.trim().length > 0)
      .map((r) => ({
        key: r.review_key,
        authorName: r.author_name,
        authorPhotoUrl: r.author_photo_url,
        rating: r.rating,
        text: (r.text as string).trim(),
        publishedAt: r.published_at,
        reviewUrl: r.review_url,
        replyText: r.reply_text,
        replyAt: r.reply_at,
      })),
  };
}
