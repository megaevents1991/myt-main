/**
 * Meta ACTIVITIES catalog feed — pure mapping + CSV serialization.
 *
 * Meta catalogs have verticals, and ours is **Activities** (events/tickets),
 * NOT e-commerce. Different required fields entirely: activities want
 * rating_count / user_rating / activity_category / activity_date and have NO
 * availability, condition, expiration_date or product_type. Uploading our
 * e-commerce-shaped file into an activities catalog is what produced
 * "Your file format isn't supported" — Meta was reading a file whose columns
 * its parser doesn't know. `metaCatalog.ts` (e-commerce shape) stays for
 * Google Merchant; THIS file is what Meta consumes.
 *
 * Column set + order copy the CMO's file that uploaded with 0 errors
 * (facebook-activities-10-events.csv, 2026-07-22). Do not add, drop or
 * reorder columns without re-verifying an upload in Commerce Manager.
 */
import type { Event } from "@/lib/app.types";
import { isEventSoldOut } from "@/lib/events/price";
import {
  FEED_BRAND,
  feedPriceUSD,
  formatPriceUSD,
  orderLink,
  plainText,
  type EventTaxonomyInfo,
} from "./metaCatalog";

/**
 * Meta marks rating_count + user_rating "required", but we have NO ratings
 * system — so we publish zeros, which the spec explicitly allows ("a rating
 * between 0.0 and 5.0"). Inventing a rating (e.g. 100 reviews / 5 stars)
 * would be fabricated social proof shown to customers in ads. If real
 * ratings ever exist, source them per-event here instead of a constant.
 */
export const ACTIVITY_RATING_COUNT = Number(process.env.META_ACTIVITY_RATING_COUNT ?? 0);
export const ACTIVITY_USER_RATING = Number(process.env.META_ACTIVITY_USER_RATING ?? 0);

/** Package suffix on concert titles — matches the verified working file. */
const PACKAGE_SUFFIX = "טיסה+מלון+כרטיס";

export type ActivityCategory = "Concert" | "Sports" | "Other";

export type ActivityItem = {
  id: number;
  image_link: string;
  brand: string;
  description: string;
  title: string;
  /** "1276.00 USD" */
  price: string;
  link: string;
  rating_count: number;
  user_rating: number;
  activity_category: ActivityCategory;
  /** Artist or team name. */
  performers: string;
  /** City only — no country, per the verified file. */
  location_names: string;
  /** Genre / sport, e.g. "Rock", "Football". */
  activity_sub_categories: string;
  /** YYYY-MM-DD */
  activity_date: string;
  custom_label_0: string;
  custom_label_1: string;
};

export type ActivityBuildResult = {
  items: ActivityItem[];
  skipped: { id: number; name: string; reason: string }[];
};

/**
 * Whether the event's name matched a CMS artist or football team — the site's
 * own classifier, supplied by `feedData`. Many `tx_event` rows carry no
 * taxonomy link at all, and this is what keeps them out of "Other".
 */
export type DomainHint = "artist" | "football-team" | null;

/** Meta's activity_category vocabulary: event type → taxonomy root → CMS hint. */
export function activityCategoryOf(
  event: Pick<Event, "type">,
  taxonomy: EventTaxonomyInfo,
  hint: DomainHint = null
): ActivityCategory {
  if (event.type === "music_event" || event.type === "music_live_event_dynamic") {
    return "Concert";
  }
  if (
    event.type === "sports_event" ||
    event.type === "sports_event_dynamic" ||
    event.type === "sports_live_event_dynamic"
  ) {
    return "Sports";
  }
  // tx_event carries either kind — taxonomy root first, then the CMS match.
  const root = (taxonomy.categoryPath[0] ?? "").trim().toLowerCase();
  if (root.startsWith("music")) return "Concert";
  if (root.startsWith("sport")) return "Sports";
  if (hint === "artist") return "Concert";
  if (hint === "football-team") return "Sports";
  return "Other";
}

/** "לונדון, בריטניה" → "לונדון" (the verified file lists city only). */
export function cityOnly(locationName: string | undefined): string {
  return (locationName ?? "").split(",")[0].trim();
}

/**
 * @param availabilityCutoffISO events dated before this can't be booked (the
 *   site's 7-day window) — activities feeds have no availability field, so
 *   those and sold-out events are dropped rather than marked out of stock.
 */
export function buildActivityItem(
  event: Event,
  taxonomy: EventTaxonomyInfo,
  availabilityCutoffISO: string,
  hint: DomainHint = null
): ActivityItem | { skipped: string } {
  const eventDate = event.date.split("T")[0];
  if (isEventSoldOut(event)) return { skipped: "sold out" };
  if (eventDate < availabilityCutoffISO) return { skipped: "inside booking window" };

  const price = feedPriceUSD(event);
  if (price == null) return { skipped: "no computable price" };
  const image_link = event.campaign_image_url || event.card_image_url;
  if (!image_link) return { skipped: "no image" };

  const d = new Date(`${eventDate}T00:00:00Z`);
  const name = event.name.trim();
  const city = cityOnly(event.location?.name);
  const activity_category = activityCategoryOf(event, taxonomy, hint);

  const baseTitle = [name, city, `${d.getUTCDate()}.${d.getUTCMonth() + 1}`]
    .filter(Boolean)
    .join(" · ");
  const title = (
    activity_category === "Concert" ? `${baseTitle} · ${PACKAGE_SUFFIX}` : baseTitle
  ).slice(0, 200);

  const fromCms = plainText(event.description || "");
  const generated = `${name} ב${city || "חו״ל"}, ${d.getUTCDate()}.${
    d.getUTCMonth() + 1
  }.${d.getUTCFullYear()}. כרטיס רשמי לאירוע${
    event.skip_flight ? " ומלון" : ", טיסה ומלון"
  } — חבילה שאתם מרכיבים בעצמכם.`;
  const description = fromCms && fromCms !== title ? fromCms : generated;

  // Category names carry stray whitespace in the DB ("Football ").
  const path = taxonomy.categoryPath.map((p) => p.trim()).filter(Boolean);
  const leaf = path.length > 1 ? path[path.length - 1] : "";
  // Untagged events still get a usable targeting label from the CMS match.
  const domainLabel =
    path[0]?.toLowerCase() ||
    (hint === "artist" ? "music" : hint === "football-team" ? "sport" : "");
  const subCategory = leaf || (hint === "football-team" ? "Football" : "");

  return {
    id: event.id,
    image_link,
    brand: FEED_BRAND,
    description,
    title,
    price: formatPriceUSD(price),
    link: orderLink(event),
    rating_count: ACTIVITY_RATING_COUNT,
    user_rating: ACTIVITY_USER_RATING,
    activity_category,
    performers: name,
    location_names: city,
    // Deepest taxonomy segment = the genre/sport ("Rock", "Football").
    activity_sub_categories: subCategory,
    activity_date: eventDate,
    custom_label_0: domainLabel,
    custom_label_1: subCategory.toLowerCase(),
  };
}

const CSV_HEADERS = [
  "id", "image_link", "brand", "description", "title", "price", "link",
  "rating_count", "user_rating", "activity_category", "performers",
  "location_names", "activity_sub_categories", "activity_date",
  "custom_label_0", "custom_label_1",
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV in the verified-working byte format: no BOM, CRLF rows, UTF-8. */
export function toActivitiesCsv(items: ActivityItem[]): string {
  const rows = items.map((it) =>
    [
      it.id, it.image_link, it.brand, it.description, it.title, it.price, it.link,
      it.rating_count, it.user_rating, it.activity_category, it.performers,
      it.location_names, it.activity_sub_categories, it.activity_date,
      it.custom_label_0, it.custom_label_1,
    ]
      .map(csvCell)
      .join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
}
