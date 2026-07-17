/**
 * Validation script for the Meta catalog feed builders/serializers.
 * Run with: npx tsx lib/feed/__tests__/metaCatalog.test.ts
 * (Script-style asserts — matches lib/events/__tests__/price.test.ts.)
 */
import assert from "node:assert";
import type { Event } from "../../app.types";
import {
  buildFeedItem,
  escapeXml,
  expirationDateOf,
  feedPriceUSD,
  formatPriceUSD,
  isMondial2026Name,
  nightsOf,
  orderLink,
  plainText,
  toCsv,
  toXml,
  type FeedItem,
} from "../metaCatalog";

const baseEvent = (over: Partial<Event> = {}): Event =>
  ({
    id: 607,
    name: "בריאן אדמס",
    name_english: "Bryan Adams",
    type: "music_event",
    date: "2026-10-02",
    location: { latitude: 0, longitude: 0, name: "ברלין", city_iata: "BER" },
    map_image_url: "",
    description: "",
    card_image_url: "https://example.com/bryan.jpg",
    tickets_and_rates: [
      { category: "A", price: 120, id: "t1", description: "", available: true, colorOnTheMap: "" },
    ],
    def_date_depart: "2026-10-01",
    def_date_return: "2026-10-03",
    usual_price: 2000,
    base_flight_price: 900,
    base_hotel_price: 616,
    is_prioritized: false,
    is_deleted: null as unknown as string,
    tags: "",
    ...over,
  }) as Event;

const TAX = { categoryPath: ["Music", "Rock"], tagSlugs: ["berlin", "music", "rock"] };
const CUTOFF = "2026-07-23"; // today + 7
const TODAY = "2026-07-16";

/* escapeXml */
assert.strictEqual(escapeXml("a & b < c > d"), "a &amp; b &lt; c &gt; d");

/* mondial detection + link routing */
assert.ok(isMondial2026Name("מונדיאל 2026 - חצי גמר"));
assert.ok(isMondial2026Name("World Cup 2026 Final"));
assert.ok(!isMondial2026Name("בריאן אדמס בברלין"));
assert.strictEqual(
  orderLink({ id: 5, name: "World Cup 2026 Final" }),
  "https://mondial2026.mega-events.co.il/order/5"
);
assert.strictEqual(
  orderLink({ id: 607, name: "בריאן אדמס" }),
  "https://www.mega-events.co.il/order/607"
);

/* expiration = day after event */
assert.strictEqual(expirationDateOf("2026-10-02"), "2026-10-03");
assert.strictEqual(expirationDateOf("2026-12-31T20:00:00"), "2027-01-01");

/* price: package formula (900+616+120+175 = 1811), Meta format */
const ev = baseEvent();
assert.strictEqual(feedPriceUSD(ev), 1811);
assert.strictEqual(formatPriceUSD(1811), "1811.00 USD");

/* price fallback: sold out (no available tickets) still uses cheapest ticket */
const soldOut = baseEvent({
  tickets_and_rates: [
    { category: "A", price: 120, id: "t1", description: "", available: false, colorOnTheMap: "" },
  ],
});
assert.strictEqual(feedPriceUSD(soldOut), 1811);

/* price fallback: no tickets at all → usual_price */
assert.strictEqual(feedPriceUSD(baseEvent({ tickets_and_rates: [] })), 2000);
assert.strictEqual(
  feedPriceUSD(baseEvent({ tickets_and_rates: [], usual_price: 0 })),
  null
);

/* plainText strips html + links */
assert.strictEqual(
  plainText("<p>שורה  אחת</p> https://x.co/a בסוף"),
  "שורה אחת בסוף"
);

/* buildFeedItem: full item */
const item = buildFeedItem(ev, TAX, CUTOFF, TODAY) as FeedItem;
assert.strictEqual(item.id, 607);
assert.strictEqual(item.title, "בריאן אדמס · ברלין · 2.10 · טיסה+מלון+כרטיס");
assert.strictEqual(item.availability, "in stock");
assert.strictEqual(item.price, "1811.00 USD");
assert.strictEqual(item.link, "https://www.mega-events.co.il/order/607");
assert.strictEqual(item.expiration_date, "2026-10-03");
assert.strictEqual(item.product_type, "Music > Rock");
assert.deepStrictEqual(item.custom_labels, ["berlin", "music", "rock", "", "available"]);
assert.deepStrictEqual(item.internal_labels, [
  "berlin", "music", "rock", "status:available",
]);
assert.deepStrictEqual(item.custom_numbers, [2026, 78, 2]); // year, days to 2.10, nights
assert.ok(item.description.length > 0 && item.description !== item.title);

/* sold-out event → out of stock + status label */
const soldItem = buildFeedItem(soldOut, TAX, CUTOFF, TODAY) as FeedItem;
assert.strictEqual(soldItem.availability, "out of stock");
assert.strictEqual(soldItem.custom_labels[4], "sold_out");

/* "Sold" tag → out of stock even with available tickets */
const taggedSold = buildFeedItem(baseEvent({ tags: "Sold" }), TAX, CUTOFF, TODAY) as FeedItem;
assert.strictEqual(taggedSold.availability, "out of stock");

/* event inside the 7-day booking window → out of stock (site won't sell it) */
const tooSoon = buildFeedItem(baseEvent({ date: "2026-07-20" }), TAX, CUTOFF, TODAY) as FeedItem;
assert.strictEqual(tooSoon.availability, "out of stock");

/* skip_flight event → hotel+ticket composition */
const noFlight = buildFeedItem(baseEvent({ skip_flight: true }), TAX, CUTOFF, TODAY) as FeedItem;
assert.ok(noFlight.title.endsWith("מלון+כרטיס") && !noFlight.title.includes("טיסה"));

/* campaign creative wins over card image; banner rides along */
const withCampaign = buildFeedItem(
  baseEvent({
    campaign_image_url: "https://cdn.example.com/auto/event-607-square.png?v=abc",
    campaign_banner_url: "https://cdn.example.com/auto/event-607-banner.png?v=abc",
  }),
  TAX, CUTOFF, TODAY
) as FeedItem;
assert.strictEqual(
  withCampaign.image_link,
  "https://cdn.example.com/auto/event-607-square.png?v=abc"
);
assert.strictEqual(
  withCampaign.additional_image_link,
  "https://cdn.example.com/auto/event-607-banner.png?v=abc"
);
assert.strictEqual(withCampaign.has_campaign, true);
const campaignXml = toXml([withCampaign]);
assert.ok(campaignXml.includes("<g:additional_image_link>"));

/* no campaign → original card image, no additional link */
assert.strictEqual(item.image_link, "https://example.com/bryan.jpg");
assert.strictEqual(item.additional_image_link, null);
assert.strictEqual(item.has_campaign, false);
assert.ok(!toXml([item]).includes("additional_image_link"));

/* campaign image works even when the event has no card image */
const campaignOnly = buildFeedItem(
  baseEvent({
    card_image_url: "",
    campaign_image_url: "https://cdn.example.com/auto/event-607-square.png?v=abc",
  }),
  TAX, CUTOFF, TODAY
) as FeedItem;
assert.strictEqual(campaignOnly.has_campaign, true);

/* skips: no price / no image */
assert.deepStrictEqual(
  buildFeedItem(baseEvent({ tickets_and_rates: [], usual_price: 0 }), TAX, CUTOFF, TODAY),
  { skipped: "no computable price" }
);
assert.deepStrictEqual(
  buildFeedItem(baseEvent({ card_image_url: "" }), TAX, CUTOFF, TODAY),
  { skipped: "no image" }
);

/* nightsOf */
assert.strictEqual(nightsOf({ def_date_depart: "2026-10-01", def_date_return: "2026-10-03" }), 2);
assert.strictEqual(nightsOf({ def_date_depart: "", def_date_return: "" }), 0);

/* XML: declaration, namespace, escaping, exact availability strings */
const xml = toXml([item]);
assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
assert.ok(xml.includes('xmlns:g="http://base.google.com/ns/1.0"'));
assert.ok(xml.includes("<g:id>607</g:id>"));
assert.ok(xml.includes("<g:availability>in stock</g:availability>"));
assert.ok(xml.includes("<g:price>1811.00 USD</g:price>"));
assert.ok(xml.includes("<g:custom_label_4>available</g:custom_label_4>"));
assert.ok(xml.includes("<custom_number_0>2026</custom_number_0>"));
assert.ok(xml.includes("<internal_label>status:available</internal_label>"));
const amp = buildFeedItem(
  baseEvent({ name: "AC/DC & Friends <live>" }),
  { categoryPath: [], tagSlugs: [] },
  CUTOFF,
  TODAY
) as FeedItem;
const ampXml = toXml([amp]);
assert.ok(ampXml.includes("AC/DC &amp; Friends &lt;live&gt;"));
assert.ok(!ampXml.includes("<g:product_type>"), "empty product_type omitted");

/* CSV: BOM, header, quoting */
const csv = toCsv([amp]);
assert.ok(csv.charCodeAt(0) === 0xfeff, "UTF-8 BOM present");
assert.ok(csv.includes("id,title,description,availability"));
assert.ok(csv.includes('"'), "title with comma/quote-worthy chars gets quoted");

console.log("metaCatalog: all assertions passed ✅");
