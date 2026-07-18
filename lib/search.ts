import type Fuse from "fuse.js";
import type { Event } from "@/lib/app.types";

const SPORTS_TYPES = new Set<Event["type"]>([
  "sports_event",
  "sports_event_dynamic",
  "sports_live_event_dynamic",
]);

// tx_event is a mixed feed (football + concerts). Football rows always read
// "TeamA vs TeamB" (english) or are World Cup / מונדיאל; concerts never do.
const isFootballTx = (e: Event): boolean =>
  e.type === "tx_event" &&
  (/ vs /i.test(e.name_english ?? "") ||
    /world cup/i.test(e.name_english ?? "") ||
    e.name?.includes("מונדיאל"));

/** Sports events vs everything else (concerts). Shared by search + filters. */
export const isSportsEvent = (e: Event): boolean =>
  SPORTS_TYPES.has(e.type) || isFootballTx(e);

const SPORTS_WORDS = "כדורגל ספורט משחק משחקים football";
const MUSIC_WORDS = "הופעה הופעות קונצרט מוזיקה מוסיקה אומן concert music";

/** Event + a searchable category-words field, so queries like "כדורגל" or
 *  "הופעות" match events by kind — not only by name/city. Add "categoryText"
 *  to the Fuse keys wherever this is used. */
export type SearchableEvent = Event & { categoryText: string };
export const withCategoryText = (events: Event[]): SearchableEvent[] =>
  events.map((e) => ({
    ...e,
    categoryText: `${isSportsEvent(e) ? SPORTS_WORDS : MUSIC_WORDS} ${e.tags ?? ""}`.trim(),
  }));

/**
 * Multi-term fuzzy search over a Fuse index.
 *
 * Fuse matches the whole query as a single pattern against each field, so a
 * combined query like "באד באני פריז" (artist + city) matches nothing — no one
 * field holds the full string. Here we split the query on whitespace and require
 * EVERY word to match (AND), each word free to match a different field. That way
 * "באד באני" hits the event name and "פריז" hits its location, and only the
 * event that satisfies all words is returned.
 *
 * Single-word queries behave exactly like `fuse.search(...)` — no regression.
 * Each Fuse instance keeps its own keys/threshold, so this works for events,
 * teams and artists alike.
 */
export function multiTermSearch<T>(fuse: Fuse<T>, query: string): T[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  if (terms.length === 1) return fuse.search(terms[0]).map((r) => r.item);

  // Per-word result sets; intersect them. First word drives relevance order.
  const [first, ...rest] = terms.map(
    (t) => new Set(fuse.search(t).map((r) => r.item))
  );
  return Array.from(first).filter((item) => rest.every((s) => s.has(item)));
}
