/**
 * Event tag vocabulary - single source of truth for `events.tags`.
 *
 * The backoffice writes this column from TWO places with historically different
 * wordings: the event detail select ("LastTickets", "Popular", "Restock",
 * "VIPevent", "VIPavailable", "Sold") and the events-table quick-tag popover
 * ("Hot", "Selling Fast", "Limited Availability", "New", "Sold"). Anything this
 * map didn't know rendered as NO badge at all, so the whole quick-tag set was
 * silently invisible on the site.
 *
 * Matching is normalized (case + spaces/underscores/dashes stripped) so
 * "Last Tickets", "last-tickets" and "LastTickets" are the same tag.
 */

/** Canonical tags, in the order the backoffice should offer them. */
export const EVENT_TAGS = [
  "Sold",
  "LastTickets",
  "Limited Availability",
  "Selling Fast",
  "Hot",
  "Popular",
  "Restock",
  "New",
  "VIPevent",
  "VIPavailable",
] as const;

export type EventTag = (typeof EVENT_TAGS)[number];

/** Visual treatment of a tag. "lastTickets" = the outlined pulsing-dot pill. */
export type EventTagStyle =
  | "lastTickets"
  | "urgent"
  | "new"
  | "vip"
  | "soldout";

export type EventTagInfo = { style: EventTagStyle; label: string };

const normalize = (tag: string) => tag.toLowerCase().replace(/[\s_-]+/g, "");

// Keyed by normalized tag. Several backoffice wordings intentionally share a
// look - they differ only in the Hebrew label the customer reads.
const TAG_INFO: Record<string, EventTagInfo> = {
  sold: { style: "soldout", label: "SOLD OUT" },
  lasttickets: { style: "lastTickets", label: "כרטיסים אחרונים" },
  limitedavailability: { style: "lastTickets", label: "מלאי מוגבל" },
  sellingfast: { style: "urgent", label: "נמכר במהירות" },
  popular: { style: "urgent", label: "נמכר במהירות" },
  hot: { style: "urgent", label: "מבוקש במיוחד" },
  restock: { style: "new", label: "חזר למלאי" },
  new: { style: "new", label: "תאריך חדש" },
  vipevent: { style: "vip", label: "חבילת VIP" },
  vipavailable: { style: "vip", label: "אופציית VIP" },
};

// Match priority when a row carries several tags (the backoffice events-table
// stores them comma-separated): scarcity beats hype beats freshness beats VIP.
const PRIORITY = EVENT_TAGS.map(normalize);

/**
 * Resolves a raw `events.tags` value to its badge treatment (null = unknown).
 * Accepts a single tag or a comma-separated list and returns the highest
 * priority tag it recognizes.
 */
export const getEventTagInfo = (tag?: string | null): EventTagInfo | null => {
  if (!tag) return null;
  const present = new Set(tag.split(",").map(normalize).filter(Boolean));
  const key = PRIORITY.find((t) => present.has(t));
  return key ? (TAG_INFO[key] ?? null) : null;
};

/** True when the tag marks an event worth surfacing (promo banners, etc.). */
export const isFeaturedTag = (tag?: string | null) => {
  const style = getEventTagInfo(tag)?.style;
  return style !== undefined && style !== "soldout";
};
