/**
 * Validation script for the gallery → event card-art rule (galleryArtFor).
 * Run with: npx tsx lib/events/__tests__/galleryArt.test.ts
 * (Matches the repo's script-style tests - see ./price.test.ts.)
 *
 * Regression: 2026-08-24. Filling FC Barcelona's team gallery in the
 * backoffice turned every photo-less Barcelona event card into "brand blob +
 * rectangular stadium photo" - the team gallery was being pasted into the
 * cut-out slot and preempting the crest standard.
 */
import assert from "node:assert";
import { galleryArtFor } from "../galleryArt";

const artistGallery = [
  "https://cdn/templates/ariana-0-cutout.png",
  "https://cdn/templates/ariana-1-cutout.png",
  "https://cdn/templates/ariana-2-cutout.png",
];
const teamGallery = [
  "https://cdn/templates/team-gallery/barcelona-0.jpg",
  "https://cdn/templates/team-gallery/barcelona-1.jpg",
  "https://cdn/templates/team-gallery/barcelona-2.jpg",
  "https://cdn/templates/team-gallery/barcelona-3.jpg",
  "https://cdn/templates/team-gallery/barcelona-4.jpg",
];

// 1. Artist: deterministic id % length pick, stable across calls.
const artist = { kind: "artist" as const, gallery: artistGallery };
assert.strictEqual(galleryArtFor(artist, 7), artistGallery[1]);
assert.strictEqual(galleryArtFor(artist, 7), artistGallery[1]);
assert.strictEqual(galleryArtFor(artist, 9), artistGallery[0]);
console.log("✓ Artist gallery: deterministic per-event cut-out pick");

// 2. Artist without a gallery falls through to the person's art.
assert.strictEqual(galleryArtFor({ kind: "artist", gallery: [] }, 7), null);
console.log("✓ Empty artist gallery: falls through");

// 3. THE REGRESSION - a team gallery never becomes blob art, so the crest
//    standard (FOOTBALL_CREST_ART) still wins. Event 732 is the real
//    "FC Barcelona vs RC Deportivo de La Coruña" card from the bug report.
const team = { kind: "team" as const, gallery: teamGallery };
assert.strictEqual(galleryArtFor(team, 732), null);
for (const id of [1, 2, 3, 4, 5, 732, 1001]) {
  assert.strictEqual(galleryArtFor(team, id), null);
}
console.log("✓ Team gallery: never becomes card blob art (crest wins)");

console.log("\n✅ galleryArtFor rules hold");
