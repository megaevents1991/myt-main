// Event card "blob" art — the brand swoosh shape sitting behind the artist
// image. For now color + shape are chosen deterministically from the event id
// (stable across renders, varied across cards). Later the backoffice will set
// these per event; pass explicit `colorIndex` / `shapeIndex` to override.

// Brand neon palette (matches the --brand-* tokens in globals.css).
export const EVENT_ART_COLORS = [
  "var(--brand-mint)",
  "var(--brand-aqua)",
  "var(--brand-violet)",
  "var(--brand-coral)",
  "var(--brand-gold)",
  "var(--brand-orange)",
] as const;

// Number of blob shape variants available in EventArt (3 Figma shapes × 2 mirrors).
// Indices 6-8 are photo backgrounds (EventArt PHOTO_BACKGROUNDS) — reachable only
// via an explicit backoffice shapeIndex, never by the deterministic default.
export const EVENT_ART_SHAPES = 6;

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export type EventArt = { colorIndex: number; shapeIndex: number };

/**
 * Crest/cut-out source classifier — the ONE place that knows which art sources
 * honor the backoffice zoom/offset dial. Legacy art_blobs pipeline images are
 * padded cutouts that read right at plain contain-fit size, so they ignore the
 * dial. Every other source (football-logos library, templates bucket, any
 * future bucket) is a tightly-cropped image with no built-in padding — it MUST
 * honor the dial or it blows up to fill the card. Never re-check the URL
 * inline; use this so every surface treats a new bucket the same way.
 */
export const isTightCrest = (url?: string | null): boolean =>
  Boolean(url && !url.includes("/art_blobs/"));

/**
 * THE cross-site standard for football LOGO (crest) cards. Every crest —
 * template-uploaded or resolved from the football-logos library — renders
 * with this exact background and size on the homepage card, team hero and OG
 * image. Per-team zoom dials are deliberately IGNORED for crests: three
 * production bugs (Inter, Bayern/Roma, PSG) came from per-team drift. One
 * knob, changed here, moves every crest together.
 */
export const FOOTBALL_CREST_ART = {
  /** EventArt photo-background index for the football stadium photo. */
  shapeIndex: 8,
  imageScale: 0.6,
  imageOffsetX: 0,
  imageOffsetY: -12,
  /**
   * Hero-carousel-only vertical position. The hero card is much taller than
   * the catalog cards, so the shared -12% reads low there; the crest sits a
   * bit higher to look centered (the "like Arsenal" look). Applies ONLY in
   * HeroCarousel — every other surface uses imageOffsetY above.
   */
  heroImageOffsetY: -20,
} as const;

/**
 * Deterministic color + shape for an event. `id` keeps it stable per card.
 * `overrides` (future backoffice fields) win when provided.
 */
export const getEventArt = (
  id: string | number,
  overrides?: Partial<EventArt>
): EventArt => {
  const h = hash(String(id));
  return {
    colorIndex: overrides?.colorIndex ?? h % EVENT_ART_COLORS.length,
    // bit-shift so shape doesn't correlate with colour
    shapeIndex: overrides?.shapeIndex ?? (h >> 3) % EVENT_ART_SHAPES,
  };
};
