/**
 * Validation script for the event-owned crest rule (standardizeEventCrest).
 * Run with: npx tsx lib/events/__tests__/crestArt.test.ts
 * (Matches the repo's script-style tests - see ./galleryArt.test.ts.)
 *
 * Regression: 2026-09-18. Event 1079 ("Napoli vs Bodø/Glimt") carried its OWN
 * art_image_url - the Napoli crest, stadium background, no zoom dial. The
 * crest standard only ran on team rows and on photo-less events, so this card
 * rendered the crest at scale 1 and it filled the whole image area.
 */
import assert from "node:assert";
import { FOOTBALL_CREST_ART } from "../../eventArt";
import { standardizeEventCrest } from "../crestArt";

const CREST =
  "https://x.supabase.co/storage/v1/object/public/templates/napoli-logo-footylogos.png";

// 1. THE REGRESSION - tight crest on the stadium photo, no dial set.
const napoli = {
  art_image_url: CREST,
  art_shape_index: 8,
  art_image_scale: null,
  art_image_offset_x: null,
  art_image_offset_y: null,
};
standardizeEventCrest(napoli);
assert.strictEqual(napoli.art_image_scale, FOOTBALL_CREST_ART.imageScale);
assert.strictEqual(napoli.art_image_offset_x, FOOTBALL_CREST_ART.imageOffsetX);
assert.strictEqual(napoli.art_image_offset_y, FOOTBALL_CREST_ART.imageOffsetY);
console.log("✓ Event-owned crest on the stadium: wears the crest standard");

// 2. A hand-set dial is ignored too - one knob moves every crest together.
const tuned = { ...napoli, art_image_scale: 1, art_image_offset_y: 0 };
standardizeEventCrest(tuned);
assert.strictEqual(tuned.art_image_scale, FOOTBALL_CREST_ART.imageScale);
assert.strictEqual(tuned.art_image_offset_y, FOOTBALL_CREST_ART.imageOffsetY);
console.log("✓ Per-event dial on a crest: overridden by the standard");

// 3. An artist cut-out on a brand blob keeps its own dials.
const artist = {
  art_image_url: "https://x/templates/ariana-0-cutout.png",
  art_shape_index: 2,
  art_image_scale: 1.2,
  art_image_offset_x: 4,
  art_image_offset_y: -3,
};
standardizeEventCrest(artist);
assert.deepStrictEqual(
  [artist.art_image_scale, artist.art_image_offset_x, artist.art_image_offset_y],
  [1.2, 4, -3],
);
console.log("✓ Blob-shape art: untouched");

// 4. A padded art_blobs cutout on the stadium reads right at contain-fit.
const padded = {
  art_image_url: "https://x/storage/v1/object/public/art_blobs/arsenal.png",
  art_shape_index: 8,
  art_image_scale: null,
  art_image_offset_x: null,
  art_image_offset_y: null,
};
standardizeEventCrest(padded);
assert.strictEqual(padded.art_image_scale, null);
console.log("✓ art_blobs cutout on the stadium: untouched");

// 5. Other photo backgrounds (cars / tennis) are not crest cards.
const f1 = { ...napoli, art_shape_index: 6, art_image_scale: null };
standardizeEventCrest(f1);
assert.strictEqual(f1.art_image_scale, null);
console.log("✓ Non-football photo background: untouched");

// 6. No art at all - nothing to do, nothing thrown.
const bare = { art_image_url: null, art_shape_index: null };
standardizeEventCrest(bare);
assert.strictEqual(bare.art_image_url, null);
console.log("✓ Event without art: untouched");

console.log("\nAll crestArt checks passed.");
