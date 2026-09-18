/**
 * The crest standard for art an EVENT carries itself. Lives in its own leaf
 * module (no supabase / next-cache imports) so it stays unit-testable - see
 * __tests__/crestArt.test.ts.
 */
import type { Event } from "@/lib/app.types";
import { FOOTBALL_CREST_ART, isTightCrest } from "../eventArt";

type EventCrestArt = Pick<
  Event,
  | "art_image_url"
  | "art_shape_index"
  | "art_image_scale"
  | "art_image_offset_x"
  | "art_image_offset_y"
>;

/**
 * FOOTBALL_CREST_ART was enforced on team rows (standardizeCrest) and on
 * photo-less events borrowing their team's art (getFootballTeamImageIndex) -
 * but an event whose OWN art_image_url is a crest (staff picked the team logo
 * in the backoffice event editor) skipped both, so its card rendered the
 * tight badge at scale 1 and it filled the image edge to edge (2026-09-18
 * prod bug, the Napoli Champions League cards).
 *
 * A tight (non-art_blobs) image on the football stadium background IS a crest
 * card: it wears the one standard size, whatever dial the event row holds -
 * same "one knob" rule as the team cards. Blob-shape art, padded art_blobs
 * cutouts and the other photo backgrounds are left alone. Mutates in place,
 * like the rest of the enrichment pass.
 */
export const standardizeEventCrest = (event: EventCrestArt): void => {
  if (event.art_shape_index !== FOOTBALL_CREST_ART.shapeIndex) return;
  if (!isTightCrest(event.art_image_url)) return;
  event.art_image_scale = FOOTBALL_CREST_ART.imageScale;
  event.art_image_offset_x = FOOTBALL_CREST_ART.imageOffsetX;
  event.art_image_offset_y = FOOTBALL_CREST_ART.imageOffsetY;
};
