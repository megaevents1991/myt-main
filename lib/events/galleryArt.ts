/**
 * The ONE rule for turning a person's gallery into event card-art. Lives in
 * its own leaf module (no supabase / next-cache imports) so it stays
 * unit-testable - see __tests__/galleryArt.test.ts.
 */
import type { PersonImageEntry } from "@/lib/cms/people";

/**
 * Deterministic gallery pick for a photo-less event - ARTISTS ONLY.
 *
 * An artist gallery comes out of the backoffice cut-out upload pipeline
 * (transparent `-cutout-*.png`), so it belongs in the BLOB art system:
 * art_image_url with color/shape left unset -> getEventArt derives them from
 * the event id -> ten photo-less events of one artist show ten different
 * cut-outs instead of the same art everywhere. Stable per event across
 * renders (the same `id % length` rule the backoffice creative generator
 * uses) - no churn.
 *
 * A FOOTBALL TEAM gallery is different content: plain venue / matchday photos
 * uploaded under Templates. Dropped into the blob slot they render as a
 * rectangular photo floating on a brand blob, AND they preempt the crest
 * standard (FOOTBALL_CREST_ART) every team card is supposed to wear - which
 * is what broke every Barcelona card the day its gallery was filled
 * (2026-08-24 prod bug). Teams keep the crest. The backoffice creative
 * generator already loads gallery "only for artists" (lib/creative/auto.ts);
 * this is the site-side half of that same rule.
 */
export const galleryArtFor = (
  match: Pick<PersonImageEntry, "kind" | "gallery">,
  eventId: number,
): string | null =>
  match.kind === "artist" && match.gallery.length
    ? match.gallery[eventId % match.gallery.length]
    : null;
