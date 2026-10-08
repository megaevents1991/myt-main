import { describe, expect, it, vi } from "vitest";

/**
 * `google_reviews` / `google_review_sources` hold MORE than one Google profile:
 * the backoffice mirrors the tours companies' profiles into the same two tables,
 * each under its own Place ID (since 2026-10-05). This site shows the Mega Events
 * profile alone.
 *
 * The reader used to take the source row with the most reviews and every review
 * in the table - right while the table held one profile. On 2026-10-08 the
 * homepage said 4.6 (100) under "לקוחות משתפים" while Google said 5.0, and 44 of
 * the 100 reviews in the carousel belonged to the other company.
 */

const { MEGA, OTHER, tables } = vi.hoisted(() => {
  const MEGA = "ChIJ4_iJNrNJZWoRHYuKTpYGzDE";
  const OTHER = "ChIJyZ2K7pRjVCoRgPJUH9WpRco";
  const review = (place_id: string, review_key: string, published_at: string) => ({
    review_key,
    place_id,
    author_name: review_key,
    author_photo_url: null,
    rating: 5,
    text: `text of ${review_key}`,
    published_at,
    review_url: null,
    reply_text: null,
    reply_at: null,
    is_hidden: false,
  });
  return {
    MEGA,
    OTHER,
    tables: {
      google_reviews: [
        review(MEGA, "mega-1", "2026-09-29T10:00:00Z"),
        review(OTHER, "other-1", "2026-09-28T10:00:00Z"),
        review(MEGA, "mega-2", "2026-09-27T10:00:00Z"),
        review(OTHER, "other-2", "2026-08-28T10:00:00Z"),
      ],
      google_review_sources: [
        { place_id: MEGA, rating: "5.0", review_count: 84, maps_url: "https://maps/mega" },
        // The other profile has MORE reviews - "the biggest row" is not ours.
        { place_id: OTHER, rating: "4.6", review_count: 100, maps_url: null },
      ],
    } as Record<string, Record<string, unknown>[]>,
  };
});

vi.mock("@/lib/supabase", () => {
  type Row = Record<string, unknown>;
  // Just enough of the query builder for the reader's own filters.
  const query = (rows: Row[]) => {
    let out = [...rows];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => ((out = out.filter((r) => r[c] === v)), q),
      neq: (c: string, v: unknown) => ((out = out.filter((r) => r[c] !== v)), q),
      gte: (c: string, v: number) => ((out = out.filter((r) => Number(r[c]) >= v)), q),
      not: (c: string, _op: string, v: unknown) => ((out = out.filter((r) => r[c] !== v)), q),
      order: (c: string, o: { ascending: boolean }) => {
        // Numbers compare as numbers ("84" must not sort above "100"), ISO dates as text.
        const key = (r: Row) => (typeof r[c] === "number" ? r[c] : String(r[c]));
        out = [...out].sort((a, b) => {
          const cmp = key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
          return o.ascending ? cmp : -cmp;
        });
        return q;
      },
      limit: (n: number) => ((out = out.slice(0, n)), q),
      maybeSingle: () => Promise.resolve({ data: out[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: out, error: null }).then(resolve),
    };
    return q;
  };
  return { supabase: { from: (table: string) => query(tables[table] ?? []) } };
});

import { getGoogleReviews, MEGA_EVENTS_PLACE_ID } from "@/lib/googleReviews";

describe("getGoogleReviews - one profile out of a shared table", () => {
  it("reads the Mega Events profile by default", () => {
    expect(MEGA_EVENTS_PLACE_ID).toBe(MEGA);
  });

  it("takes the rating and count of OUR profile, not of the one with the most reviews", async () => {
    const data = await getGoogleReviews();
    expect(data?.rating).toBe(5);
    expect(data?.count).toBe(84);
    expect(data?.mapsUrl).toBe("https://maps/mega");
  });

  it("shows only OUR profile's reviews, newest first", async () => {
    const data = await getGoogleReviews();
    expect(data?.reviews.map((r) => r.key)).toEqual(["mega-1", "mega-2"]);
  });

  it("another profile named in the env is read instead", async () => {
    vi.stubEnv("NEXT_SECRET_GOOGLE_PLACE_ID", OTHER);
    try {
      const data = await getGoogleReviews();
      expect(data?.count).toBe(100);
      expect(data?.reviews.map((r) => r.key)).toEqual(["other-1", "other-2"]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
