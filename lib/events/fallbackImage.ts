import { unstable_cache as nextCache } from "next/cache";
import { Event } from "@/lib/app.types";
import { getArtistImageIndex } from "@/lib/artists";
import {
  fetchLogoLibrary,
  getFootballTeamImageIndex,
  libraryUrlFor,
} from "@/lib/football";
import {
  eventBelongsToTeam,
  normalizeName,
  teamFixtureRole,
} from "@/lib/eventNameMatch";

/**
 * Event image → person image fallback
 * (docs/superpowers/specs/2026-07-01-event-photo-artist-fallback-design.md).
 *
 * An event with no image of its own (`art_image_url` and `card_image_url` both
 * empty) borrows its matching artist's / football team's imagery in place:
 * - the person's BLOB card-art (art_* set) - so event cards render the exact
 *   same blob card as the artist catalog/carousel; and
 * - the person's hero photo into `card_image_url` - used by the order-header
 *   circle and OG image (and by cards when the person has no blob art).
 * Zero component changes - the existing `art_image_url ? blob : photo` logic
 * picks the right variant.
 */

// Merged artist+team index, names normalized once (case/accent/punctuation -
// same normalizeName as getEventsByName) and sorted longest-first so the most
// specific person wins when several match (keeps "Sia" from grabbing an
// "Asia" event). Cached once per ISR window, invalidated with `events`.
const getPersonImageIndex = nextCache(
  async () => {
    const [artists, teams] = await Promise.all([
      getArtistImageIndex(),
      getFootballTeamImageIndex(),
    ]);
    return [...artists, ...teams]
      .map((p) => ({ ...p, name: normalizeName(p.name) }))
      .sort((a, b) => b.name.length - a.name.length);
  },
  ["person-image-index"],
  { tags: ["events"], revalidate: 3600 },
);

// "" / null / undefined all count as absent.
const hasOwnPhoto = (e: Event) =>
  Boolean(e.art_image_url) || Boolean(e.card_image_url);

/* ----------------------- match "logo VS logo" art ----------------------- */

// Same fixture split the backoffice creative generator uses (lib/creative/
// auto.ts): "ברצלונה - ריאל מדריד", "Barcelona vs Real Madrid", en/em dashes.
// A leading "Competition:" prefix is dropped like eventNameMatch.fixtureSides.
const FIXTURE_SPLIT = /\s+[-–—]\s+|\s+vs\.?\s+/i;

const fixturePair = (source?: string | null): [string, string] | null => {
  const parts = (source ?? "")
    .replace(/^[^:]+:\s*/, "")
    .split(FIXTURE_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
};

// football_logos library, cached once per ISR window like the person index.
const getLogoLibrary = nextCache(
  async () => fetchLogoLibrary(),
  ["football-logo-library"],
  { tags: ["events"], revalidate: 3600 },
);

/**
 * Site-side mirror of the feed's match creative: when BOTH sides of a fixture
 * name resolve in the football_logos library, the event card renders
 * "home crest VS away crest" (EventArt awayImageUrl) instead of a photo.
 * Manual event art (a backoffice-uploaded art_image_url) still wins - the
 * gate runs BEFORE the photo fallback below fills art_image_url itself.
 */
async function enrichEventsWithMatchArt(events: Event[]): Promise<void> {
  const candidates = events.filter(
    (e) =>
      !e.art_image_url &&
      (fixturePair(e.name) || fixturePair(e.name_english)),
  );
  if (!candidates.length) return;
  const lib = await getLogoLibrary();
  if (!lib.length) return;
  for (const event of candidates) {
    for (const source of [event.name, event.name_english]) {
      const pair = fixturePair(source);
      if (!pair) continue;
      // Each side passed as both english and hebrew - only the matching
      // script's comparisons can hit (see libraryUrlFor).
      const home = libraryUrlFor(pair[0], pair[0], lib);
      const away = libraryUrlFor(pair[1], pair[1], lib);
      if (home && away && home !== away) {
        event.match_home_logo_url = home;
        event.match_away_logo_url = away;
        break;
      }
    }
  }
}

/** Fills `card_image_url` in place for photo-less events. Never throws - on any
 *  failure events render exactly as they do today. */
export async function enrichEventsWithFallbackImages(
  events: Event[],
): Promise<Event[]> {
  try {
    // Match art first: it applies to fixtures WITH their own card photo too
    // (a matched "logo VS logo" beats a generic stock photo, feed parity),
    // so it must not sit behind the photo-less early-return below.
    await enrichEventsWithMatchArt(events);
    if (!events.some((e) => !hasOwnPhoto(e))) return events;
    const index = await getPersonImageIndex();
    if (!index.length) return events;
    for (const event of events) {
      if (hasOwnPhoto(event)) continue;
      const name = normalizeName(event.name_english);
      if (!name) continue;
      // Same case-insensitive substring rule getEventsByName uses in reverse,
      // so an event shown on a person's page resolves to that same person.
      // eventBelongsToTeam refines it for football fixtures so an "Inter Milan"
      // game doesn't borrow AC Milan's ("Milan") imagery.
      const candidates = index.filter(
        (p) => name.includes(p.name) && eventBelongsToTeam(name, p.name),
      );
      // A fixture matches BOTH clubs ("AS Roma vs Inter Milan") and the
      // longest-first order would hand the art to whichever club has the longer
      // name (Inter). The event is the HOME team's game - its crest wins;
      // non-fixtures (artists) have no home side and keep longest-first.
      const match =
        candidates.find((p) => teamFixtureRole(name, p.name) === "home") ??
        candidates[0];
      if (!match) continue;
      // Gallery first: a deterministic per-event pick (same `id % length`
      // rule the backoffice creative generator uses) so ten photo-less
      // events of one artist show ten different images instead of the same
      // art everywhere. Stable per event across renders - no churn.
      //
      // Gallery images come out of the backoffice cut-out upload pipeline -
      // transparent PNGs. As a raw card photo they render as floating
      // torsos on a dark panel (2026-08-11 prod bug), so they enter the
      // BLOB art system instead: art_image_url with color/shape left unset
      // → getEventArt derives them from the event id → every event gets
      // the brand blob card in its own random color/shape.
      if (match.gallery.length) {
        event.art_image_url = match.gallery[event.id % match.gallery.length];
        continue;
      }
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
