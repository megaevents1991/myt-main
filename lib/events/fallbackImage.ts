import { unstable_cache as nextCache } from "next/cache";
import { Event } from "@/lib/app.types";
import { getArtistImageIndex } from "@/lib/artists";
import { getFootballTeamImageIndex } from "@/lib/football";

/**
 * Event photo → person photo fallback
 * (docs/superpowers/specs/2026-07-01-event-photo-artist-fallback-design.md).
 *
 * An event with no photo of its own (`art_image_url` and `card_image_url` both
 * empty) borrows the hero image of its matching artist / football team by
 * filling `card_image_url` in place — the existing `art_image_url ? blob :
 * photo` card logic then renders it as a photo with zero component changes.
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
      .map(({ name, url }) => ({ name: name.toLowerCase(), url }))
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
      if (match) event.card_image_url = match.url;
    }
  } catch (error) {
    console.error("[fallbackImage] enrichment failed:", error);
  }
  return events;
}
