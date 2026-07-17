/**
 * Meta (Facebook) product-catalog feed — pure mapping + serialization.
 * One site event = one feed item (id = event id, link = /order/{id}).
 * No I/O here: `lib/feed/feedData.ts` fetches events + taxonomy and calls
 * these builders; routes serialize with `toXml` / `toCsv`. Field rules follow
 * Meta's catalog reference (RSS 2.0, `g:` namespace, `price` = "1811.00 USD",
 * availability exactly "in stock" / "out of stock").
 */
import type { Event } from "@/lib/app.types";
import {
  computePackagePrice,
  getTotalMarkup,
  isEventSoldOut,
} from "@/lib/events/price";

export const FEED_SITE_ORIGIN = "https://www.mega-events.co.il";
export const MONDIAL_ORIGIN = "https://mondial2026.mega-events.co.il";
export const FEED_BRAND = "Mega Events";

/** Taxonomy info for one event, prepared by feedData from the link tables. */
export type EventTaxonomyInfo = {
  /** Deepest category path, root-first (e.g. ["Music", "Rock"]). */
  categoryPath: string[];
  /** Curated feed-tag slugs, backoffice order. */
  tagSlugs: string[];
};

export type FeedItem = {
  id: number;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  /** "1811.00 USD" */
  price: string;
  link: string;
  image_link: string;
  /** Banner-format campaign creative, when one exists (Meta shows extras). */
  additional_image_link: string | null;
  /** True when image_link is the auto-generated campaign creative. */
  has_campaign: boolean;
  brand: string;
  /** Day after the event, YYYY-MM-DD — Meta auto-hides past events. */
  expiration_date: string;
  /** "Music > Rock" (empty when the event has no category). */
  product_type: string;
  internal_labels: string[];
  custom_labels: [string, string, string, string, string];
  /** [event year, days until event, package nights] */
  custom_numbers: [number, number, number];
};

export type FeedBuildResult = {
  items: FeedItem[];
  /** Events dropped from the feed and why (shown on the admin page). */
  skipped: { id: number; name: string; reason: string }[];
};

/* ---------------- helpers ---------------- */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Mondial 2026 events live on the mondial subdomain (see mondial routing spec). */
export function isMondial2026Name(name: string): boolean {
  return /מונדיאל\s*2026|world\s*cup\s*2026/i.test(name);
}

export function orderLink(event: Pick<Event, "id" | "name">): string {
  const origin = isMondial2026Name(event.name) ? MONDIAL_ORIGIN : FEED_SITE_ORIGIN;
  return `${origin}/order/${event.id}`;
}

const dayMs = 24 * 60 * 60 * 1000;

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Day after the event date, YYYY-MM-DD. */
export function expirationDateOf(eventDate: string): string {
  const d = new Date(`${eventDate.split("T")[0]}T00:00:00Z`);
  return toISODate(new Date(d.getTime() + dayMs));
}

/** Meta price string: number + space + USD, period decimal, no symbol. */
export function formatPriceUSD(amount: number): string {
  return `${amount.toFixed(2)} USD`;
}

/**
 * Feed price. In-stock events: exactly the package price the order page
 * computes. Sold-out events still need a price (Meta requires one) — fall back
 * to the same formula over ALL tickets, then to `usual_price`. Null = no
 * usable price; the event is skipped.
 */
export function feedPriceUSD(event: Event): number | null {
  const live = computePackagePrice(event);
  if (live != null && live > 0) return live;

  const allPrices = (event.tickets_and_rates || [])
    .map((t) => Number(t?.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (allPrices.length > 0) {
    return (
      event.base_flight_price +
      event.base_hotel_price +
      Math.min(...allPrices) +
      getTotalMarkup(event)
    );
  }

  const usual = Number(event.usual_price);
  return Number.isFinite(usual) && usual > 0 ? usual : null;
}

/** Strip HTML tags/links, collapse whitespace. Meta wants plain text. */
export function plainText(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const HEB_MONTHS = [
  "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר",
];

/* ---------------- item builder ---------------- */

/**
 * @param availabilityCutoffISO events dated before this are "out of stock"
 *   (the site's 7-day booking window — the order page won't load them).
 * @param todayISO "now" for days-until-event; injected for testability.
 */
export function buildFeedItem(
  event: Event,
  taxonomy: EventTaxonomyInfo,
  availabilityCutoffISO: string,
  todayISO: string
): FeedItem | { skipped: string } {
  const price = feedPriceUSD(event);
  if (price == null) return { skipped: "no computable price" };
  // Campaign creative (backoffice nightly cron) wins; original card image is
  // the fallback for events the auto-derivation couldn't handle cleanly.
  const imageLink = event.campaign_image_url || event.card_image_url;
  if (!imageLink) return { skipped: "no image" };

  const eventDate = event.date.split("T")[0];
  const d = new Date(`${eventDate}T00:00:00Z`);
  const city = event.location?.name ?? "";

  const soldOut = isEventSoldOut(event) || eventDate < availabilityCutoffISO;
  const composition = event.skip_flight ? "מלון+כרטיס" : "טיסה+מלון+כרטיס";
  const title = [
    event.name,
    city,
    `${d.getUTCDate()}.${d.getUTCMonth() + 1}`,
    composition,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);

  const fromCms = plainText(event.description || "");
  const generated = `${event.name} ב${city || "חו״ל"}, ${d.getUTCDate()} ${
    HEB_MONTHS[d.getUTCMonth()]
  } ${d.getUTCFullYear()}. כרטיס רשמי לאירוע${
    event.skip_flight ? " ומלון" : ", טיסה ומלון"
  } — חבילה שאתם מרכיבים בעצמכם.`;
  // Meta rejects description === title; the generated sentence always differs.
  const description = fromCms && fromCms !== title ? fromCms : generated;

  const status = soldOut ? "sold_out" : "available";
  const labels = taxonomy.tagSlugs.slice(0, 4);
  const custom_labels: FeedItem["custom_labels"] = [
    labels[0] ?? "",
    labels[1] ?? "",
    labels[2] ?? "",
    labels[3] ?? "",
    status,
  ];

  const daysUntil = Math.max(
    0,
    Math.round((d.getTime() - new Date(`${todayISO}T00:00:00Z`).getTime()) / dayMs)
  );
  const nights = nightsOf(event);

  return {
    id: event.id,
    title,
    description,
    availability: soldOut ? "out of stock" : "in stock",
    condition: "new",
    price: formatPriceUSD(price),
    link: orderLink(event),
    image_link: imageLink,
    additional_image_link: event.campaign_image_url ? (event.campaign_banner_url ?? null) : null,
    has_campaign: Boolean(event.campaign_image_url),
    brand: FEED_BRAND,
    expiration_date: expirationDateOf(eventDate),
    product_type: taxonomy.categoryPath.join(" > "),
    internal_labels: [...taxonomy.tagSlugs, `status:${status}`],
    custom_labels,
    custom_numbers: [d.getUTCFullYear(), daysUntil, nights],
  };
}

/** Package nights from the default depart/return dates (0 when unusable). */
export function nightsOf(event: Pick<Event, "def_date_depart" | "def_date_return">): number {
  const dep = new Date(`${(event.def_date_depart || "").split("T")[0]}T00:00:00Z`);
  const ret = new Date(`${(event.def_date_return || "").split("T")[0]}T00:00:00Z`);
  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) return 0;
  const n = Math.round((ret.getTime() - dep.getTime()) / dayMs);
  return n > 0 ? n : 0;
}

/* ---------------- serializers ---------------- */

export function toXml(items: FeedItem[]): string {
  const itemXml = items
    .map((it) => {
      const labels = it.internal_labels
        .map((l) => `      <internal_label>${escapeXml(l)}</internal_label>`)
        .join("\n");
      const customLabels = it.custom_labels
        .map((l, i) => `      <g:custom_label_${i}>${escapeXml(l)}</g:custom_label_${i}>`)
        .join("\n");
      const customNumbers = it.custom_numbers
        .map((n, i) => `      <custom_number_${i}>${n}</custom_number_${i}>`)
        .join("\n");
      return `    <item>
      <g:id>${it.id}</g:id>
      <g:title>${escapeXml(it.title)}</g:title>
      <g:description>${escapeXml(it.description)}</g:description>
      <g:availability>${it.availability}</g:availability>
      <g:condition>${it.condition}</g:condition>
      <g:price>${it.price}</g:price>
      <g:link>${escapeXml(it.link)}</g:link>
      <g:image_link>${escapeXml(it.image_link)}</g:image_link>
${it.additional_image_link ? `      <g:additional_image_link>${escapeXml(it.additional_image_link)}</g:additional_image_link>\n` : ""}      <g:brand>${escapeXml(it.brand)}</g:brand>
      <g:expiration_date>${it.expiration_date}</g:expiration_date>
${it.product_type ? `      <g:product_type>${escapeXml(it.product_type)}</g:product_type>\n` : ""}${labels ? labels + "\n" : ""}${customLabels}
${customNumbers}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Mega Events - Product Catalog</title>
    <link>${FEED_SITE_ORIGIN}</link>
    <description>Event packages (ticket + flight + hotel)</description>
${itemXml}
  </channel>
</rss>
`;
}

const CSV_HEADERS = [
  "id", "title", "description", "availability", "condition", "price", "link",
  "image_link", "additional_image_link", "brand", "expiration_date", "product_type",
  "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4",
  "custom_number_0", "custom_number_1", "custom_number_2",
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export (same rows as the XML; internal_labels omitted — XML-only field). */
export function toCsv(items: FeedItem[]): string {
  const rows = items.map((it) =>
    [
      it.id, it.title, it.description, it.availability, it.condition, it.price,
      it.link, it.image_link, it.additional_image_link ?? "", it.brand,
      it.expiration_date, it.product_type,
      ...it.custom_labels, ...it.custom_numbers,
    ]
      .map(csvCell)
      .join(",")
  );
  // BOM so Excel opens the Hebrew text as UTF-8.
  return "﻿" + [CSV_HEADERS.join(","), ...rows].join("\r\n") + "\r\n";
}
