/**
 * Validation script for the Meta ACTIVITIES catalog builders/serializer.
 * Run with: npx tsx lib/feed/__tests__/activitiesCatalog.test.ts
 */
import assert from "node:assert";
import type { Event } from "../../app.types";
import {
  activityCategoryOf,
  buildActivityItem,
  cityOnly,
  isDirectVideoUrl,
  toActivitiesCsv,
  type ActivityItem,
} from "../activitiesCatalog";

const baseEvent = (over: Partial<Event> = {}): Event =>
  ({
    id: 329,
    name: "גאנס אנד רוזס",
    name_english: "Guns N' Roses",
    type: "music_event",
    date: "2026-10-02",
    location: { latitude: 0, longitude: 0, name: "ברלין, גרמניה", city_iata: "BER" },
    map_image_url: "",
    description: "",
    card_image_url: "https://example.com/gnr.jpg",
    // A product only reaches the catalogue with a campaign creative, so the
    // baseline event carries one — see the "branded or not at all" rule.
    campaign_image_url: "https://cdn.example.com/auto/event-329-square.png",
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

const MUSIC = { categoryPath: ["Music", "Rock"], tagSlugs: ["berlin", "music", "rock"] };
const SPORT = { categoryPath: ["Sports", "Football"], tagSlugs: ["world-cup"] };
const CUTOFF = "2026-07-23";

/* city strips the country */
assert.strictEqual(cityOnly("ברלין, גרמניה"), "ברלין");
assert.strictEqual(cityOnly(undefined), "");

/* activity_category from event type, then taxonomy for tx_event */
assert.strictEqual(activityCategoryOf({ type: "music_event" }, MUSIC), "Concert");
assert.strictEqual(activityCategoryOf({ type: "sports_event" }, SPORT), "Sports");
assert.strictEqual(activityCategoryOf({ type: "sports_live_event_dynamic" }, SPORT), "Sports");
assert.strictEqual(activityCategoryOf({ type: "tx_event" }, MUSIC), "Concert");
assert.strictEqual(activityCategoryOf({ type: "tx_event" }, SPORT), "Sports");
assert.strictEqual(
  activityCategoryOf({ type: "tx_event" }, { categoryPath: [], tagSlugs: [] }),
  "Other"
);
/* untagged tx_event falls back to the CMS artist/team match */
const NO_TAX = { categoryPath: [], tagSlugs: [] };
assert.strictEqual(activityCategoryOf({ type: "tx_event" }, NO_TAX, "artist"), "Concert");
assert.strictEqual(
  activityCategoryOf({ type: "tx_event" }, NO_TAX, "football-team"),
  "Sports"
);
/* taxonomy still wins over the hint */
assert.strictEqual(activityCategoryOf({ type: "tx_event" }, SPORT, "artist"), "Sports");

/* untagged artist event still gets a targeting label */
const untagged = buildActivityItem(
  baseEvent({ type: "tx_event" }),
  NO_TAX,
  CUTOFF,
  "artist"
) as ActivityItem;
assert.strictEqual(untagged.activity_category, "Concert");
assert.strictEqual(untagged.custom_label_0, "music");
assert.strictEqual(untagged.activity_sub_categories, "");

/* untagged football fixture → Sports + Football sub-category */
const fixture = buildActivityItem(
  baseEvent({ type: "tx_event", name: "באיירן מינכן - ר.ב. לייפציג" }),
  NO_TAX,
  CUTOFF,
  "football-team"
) as ActivityItem;
assert.strictEqual(fixture.activity_category, "Sports");
assert.strictEqual(fixture.activity_sub_categories, "Football");
assert.strictEqual(fixture.custom_label_0, "sport");
/* sports titles carry no package suffix */
assert.ok(!fixture.title.includes("טיסה+מלון"));

/* DB category names carry stray whitespace — must not leak into the feed */
const padded = buildActivityItem(
  baseEvent({ type: "sports_event" }),
  { categoryPath: ["Sport", "Football "], tagSlugs: [] },
  CUTOFF
) as ActivityItem;
assert.strictEqual(padded.activity_sub_categories, "Football");
assert.strictEqual(padded.custom_label_1, "football");

/* concert item: full mapping, package suffix, city-only location */
const item = buildActivityItem(baseEvent(), MUSIC, CUTOFF) as ActivityItem;
assert.strictEqual(item.id, 329);
assert.strictEqual(item.title, "גאנס אנד רוזס · ברלין · 2.10 · טיסה+מלון+כרטיס");
assert.strictEqual(item.price, "1811.00 USD"); // 900 + 616 + 120 + 175
assert.strictEqual(item.link, "https://www.mega-events.co.il/order/329");
assert.strictEqual(item.brand, "Mega Events");
assert.strictEqual(item.activity_category, "Concert");
assert.strictEqual(item.performers, "גאנס אנד רוזס");
assert.strictEqual(item.location_names, "ברלין");
assert.strictEqual(item.activity_sub_categories, "Rock");
assert.strictEqual(item.activity_date, "2026-10-02");
assert.strictEqual(item.custom_label_0, "music");
assert.strictEqual(item.custom_label_1, "rock");
/* feed-tag slugs land in labels 2-4 (the CMO's campaign filters) */
assert.strictEqual(item.custom_label_2, "berlin");
assert.strictEqual(item.custom_label_3, "music");
assert.strictEqual(item.custom_label_4, "rock");
assert.ok(item.description.length > 0 && item.description !== item.title);

/* legacy auto-slugged Hebrew tags ("item-N") are noise → dropped from labels */
const legacyTags = buildActivityItem(
  baseEvent(),
  { categoryPath: ["Music"], tagSlugs: ["item-4", "pop"] },
  CUTOFF
) as ActivityItem;
assert.strictEqual(legacyTags.custom_label_2, "pop");
assert.strictEqual(legacyTags.custom_label_3, "");
/* no invented social proof — we have no ratings system */
assert.strictEqual(item.rating_count, 0);
assert.strictEqual(item.user_rating, 0);

/* sports item: no package suffix (matches the verified file) */
const sport = buildActivityItem(
  baseEvent({ id: 530, name: "אנגליה", type: "sports_event", location: { latitude: 0, longitude: 0, name: "ארלינגטון-דאלאס", city_iata: "DFW" } }),
  SPORT,
  CUTOFF
) as ActivityItem;
assert.strictEqual(sport.title, "אנגליה · ארלינגטון-דאלאס · 2.10");
assert.strictEqual(sport.activity_category, "Sports");
assert.strictEqual(sport.activity_sub_categories, "Football");

/* activities feeds have no availability field → drop instead of marking */
assert.deepStrictEqual(
  buildActivityItem(baseEvent({ tags: "Sold" }), MUSIC, CUTOFF),
  { skipped: "sold out" }
);
assert.deepStrictEqual(
  buildActivityItem(baseEvent({ date: "2026-07-20" }), MUSIC, CUTOFF),
  { skipped: "inside booking window" }
);
/* no tickets at all reads as sold out (checked before price) */
assert.deepStrictEqual(
  buildActivityItem(baseEvent({ tickets_and_rates: [], usual_price: 0 }), MUSIC, CUTOFF),
  { skipped: "sold out" }
);
// (the "no computable price" branch is defensive — any event that reaches it
// has already been caught by the sold-out check; priced in metaCatalog.test)
/* branded or not at all: neither a card photo nor a cut-out substitutes for
   the campaign creative — a raw provider image in a Meta ad is worth less than
   the product being withheld */
assert.deepStrictEqual(
  buildActivityItem(baseEvent({ campaign_image_url: null }), MUSIC, CUTOFF),
  { skipped: "no campaign creative" }
);
assert.deepStrictEqual(
  buildActivityItem(
    baseEvent({
      campaign_image_url: null,
      card_image_url: "",
      art_image_url: "https://cdn.example.com/art/sam-smith.png",
    }),
    MUSIC,
    CUTOFF
  ),
  { skipped: "no campaign creative" }
);

/* campaign creative wins over the card image */
const withCampaign = buildActivityItem(
  baseEvent({ campaign_image_url: "https://cdn.example.com/auto/event-329-square.png" }),
  MUSIC,
  CUTOFF
) as ActivityItem;
assert.strictEqual(
  withCampaign.image_link,
  "https://cdn.example.com/auto/event-329-square.png"
);

/* video: only direct FILE urls — player links would fail the row in Meta */
assert.ok(isDirectVideoUrl("https://cdn.example.com/v/ariana-london.mp4"));
assert.ok(isDirectVideoUrl("https://cdn.example.com/v/clip.MOV"));
assert.ok(isDirectVideoUrl("https://cdn.example.com/v/clip.mp4?v=abc123"));
assert.ok(!isDirectVideoUrl("https://www.youtube.com/watch?v=abc123"));
assert.ok(!isDirectVideoUrl("https://vimeo.com/123456"));
assert.ok(!isDirectVideoUrl("http://cdn.example.com/v/clip.mp4"), "https only");
assert.ok(!isDirectVideoUrl("not a url"));
assert.ok(!isDirectVideoUrl(""));
assert.ok(!isDirectVideoUrl(null));

const withVideo = buildActivityItem(
  baseEvent({ campaign_video_url: "https://cdn.example.com/v/gnr.mp4" }),
  MUSIC,
  CUTOFF
) as ActivityItem;
assert.strictEqual(withVideo.video_url, "https://cdn.example.com/v/gnr.mp4");
const playerLink = buildActivityItem(
  baseEvent({ campaign_video_url: "https://youtu.be/abc123" }),
  MUSIC,
  CUTOFF
) as ActivityItem;
assert.strictEqual(playerLink.video_url, "", "player link dropped, row still valid");

/* video column appears ONLY when some event has one (keeps the proven shape) */
const videoCsv = toActivitiesCsv([item, withVideo]);
assert.ok(videoCsv.split("\r\n")[0].endsWith(",video[0].url"));
assert.ok(videoCsv.split("\r\n")[1].endsWith(","), "item without video → empty cell");
assert.ok(videoCsv.split("\r\n")[2].endsWith(",https://cdn.example.com/v/gnr.mp4"));

/* CSV: verified header + the appended tag-label columns, no BOM, CRLF, quoting */
const csv = toActivitiesCsv([item]);
assert.strictEqual(
  csv.split("\r\n")[0],
  "id,image_link,brand,description,title,price,link,rating_count,user_rating," +
    "activity_category,performers,location_names,activity_sub_categories," +
    "activity_date,custom_label_0,custom_label_1,custom_label_2," +
    "custom_label_3,custom_label_4"
);
assert.ok(csv.charCodeAt(0) !== 0xfeff, "no BOM");
assert.ok(csv.endsWith("\r\n"));
assert.ok(csv.includes('"'), "description with commas is quoted");
assert.ok(!csv.includes("availability"), "no e-commerce columns");

console.log("activitiesCatalog: all assertions passed ✅");
