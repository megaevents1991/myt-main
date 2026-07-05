import { unstable_cache as nextCache } from "next/cache";
import { Event } from "@/lib/app.types";
import { getArtistImageIndex } from "@/lib/artists";
import { getFootballTeamImageIndex } from "@/lib/football";

/**
 * Event image → person image fallback
 * (docs/superpowers/specs/2026-07-01-event-photo-artist-fallback-design.md).
 *
 * An event with no image of its own (`art_image_url` and `card_image_url` both
 * empty) borrows its matching artist's / football team's imagery in place:
 * - the person's BLOB card-art (art_* set) — so event cards render the exact
 *   same blob card as the artist catalog/carousel; and
 * - the person's hero photo into `card_image_url` — used by the order-header
 *   circle and OG image (and by cards when the person has no blob art).
 * Zero component changes — the existing `art_image_url ? blob : photo` logic
 * picks the right variant.
 */

// Merged artist+team index, names lowercased once and sorted longest-first so
// the most specific person wins when several match (keeps "Sia" from grabbing
// an "Asia" event). Cached once per ISR window, invalidated with `events`.
const getPersonImageIndex = nextCache(
  async () => {
    const [artists, teams] = await Promise.all([
      getArtistImageIndex(),
      getFootballTeamImageIndex(),
    ]);
    return [...artists, ...teams]
      .map((p) => ({ ...p, name: p.name.toLowerCase() }))
      .sort((a, b) => b.name.length - a.name.length);
  },
  ["person-image-index"],
  { tags: ["events"], revalidate: 3600 }
);

// "" / null / undefined all count as absent.
const hasOwnPhoto = (e: Event) => Boolean(e.art_image_url) || Boolean(e.card_image_url);

/** Fills `card_image_url` in place for photo-less events. Never throws — on any
 *  failure events render exactly as they do today. */
export async function enrichEventsWithFallbackImages(
  events: Event[]
): Promise<Event[]> {
  try {
    if (!events.some((e) => !hasOwnPhoto(e))) return events;
    const index = await getPersonImageIndex();
    if (!index.length) return events;
    for (const event of events) {
      if (hasOwnPhoto(event)) continue;
      const name = event.name_english?.toLowerCase();
      if (!name) continue;
      // Same case-insensitive substring rule getEventsByName uses in reverse,
      // so an event shown on a person's page resolves to that same person.
      const match = index.find((p) => name.includes(p.name));
      if (!match) continue;
      if (match.art) {
        event.art_image_url = match.art.imageUrl;
        event.art_color_index = match.art.colorIndex;
        event.art_shape_index = match.art.shapeIndex;
        event.art_image_scale = match.art.imageScale;
        event.art_bg_scale = match.art.bgScale;
        event.art_image_offset_x = match.art.offsetX;
        event.art_image_offset_y = match.art.offsetY;
      }
      if (match.url) event.card_image_url = match.url;
    }
  } catch (error) {
    console.error("[fallbackImage] enrichment failed:", error);
  }
  return events;
}
