// Event card "blob" art - the brand swoosh shape sitting behind the artist
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
// Indices 6-8 are photo backgrounds (EventArt PHOTO_BACKGROUNDS) - reachable only
// via an explicit backoffice shapeIndex, never by the deterministic default.
export const EVENT_ART_SHAPES = 6;

// Real blob shapes exported from the Figma brand file (public/brand/blob-*.svg),
// each in its own viewBox. Lives here (plain lib) so SERVER components (picker
// tiles) can draw them too - EventArt ("use client") consumes the same array.
const BLOB_BASE_SHAPES: { d: string; w: number; h: number }[] = [
  {
    // blob-1 - angular lightning swoosh (violet original)
    d: "M376.567 312.293L311.733 247.245L360.413 239.179C395.964 233.277 409.983 189.739 384.522 164.305L331.689 111.226L370.84 104.771C398.3 100.259 409.156 66.545 389.487 46.8578L338.009 -4.75832C316.883 -25.942 286.807 -35.6261 257.394 -30.7155L185.469 -18.8338C158.009 -14.3216 147.154 19.3922 166.822 39.0795L194.851 67.1655L120.973 79.4455C85.4226 85.3477 71.4037 128.886 96.8645 154.319L133.914 191.587L46.4259 206.105C1.962 213.474 -15.5866 267.975 16.2236 299.904L99.5124 383.449C133.647 417.724 182.326 433.398 230.047 425.48L346.435 406.228C390.829 398.722 408.377 344.222 376.567 312.293Z",
    w: 400,
    h: 358,
  },
  {
    // blob-2 - four-point star flow (mint original)
    d: "M311.49 43.3357C307.568 14.9081 259.771 22.7798 196.776 58.596C179.306 -13.6957 151.603 -55.2606 127.922 -38.2394C104.241 -21.2181 91.9314 49.1704 95.8559 131.198C35.6311 184.076 -5.24942 239.816 -1.34339 268.128C2.57858 296.556 50.3756 288.684 113.371 252.868C130.86 321.145 157.627 359.699 180.55 343.223C203.473 326.746 215.732 260.141 212.981 181.334C273.956 128.235 315.428 71.8789 311.49 43.3357Z",
    w: 311,
    h: 311,
  },
  {
    // blob-3 - wide cross bloom (aqua original)
    d: "M414.973 186.331C410.064 153.061 341.982 130.658 251.657 128.637C228.526 39.1825 190.141 -23.6711 156.104 -20.5852C122.066 -17.4994 102.938 50.637 106.6 141.856C19.8136 160.072 -39.5599 193.893 -34.6713 227.028C-29.7628 260.298 38.3197 282.701 128.644 284.723C151.896 369.849 189.021 428.842 221.97 425.855C254.918 422.868 273.886 358.789 271.815 271.811C359.673 253.841 419.901 219.737 414.973 186.331Z",
    w: 315,
    h: 315,
  },
];

// 0-2 = originals, 3-5 = mirrored.
export const EVENT_ART_BLOB_SHAPES = [
  ...BLOB_BASE_SHAPES.map((s) => ({ ...s, mirror: false })),
  ...BLOB_BASE_SHAPES.map((s) => ({ ...s, mirror: true })),
];

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export type EventArt = { colorIndex: number; shapeIndex: number };

/**
 * Crest/cut-out source classifier - the ONE place that knows which art sources
 * honor the backoffice zoom/offset dial. Legacy art_blobs pipeline images are
 * padded cutouts that read right at plain contain-fit size, so they ignore the
 * dial. Every other source (football-logos library, templates bucket, any
 * future bucket) is a tightly-cropped image with no built-in padding - it MUST
 * honor the dial or it blows up to fill the card. Never re-check the URL
 * inline; use this so every surface treats a new bucket the same way.
 */
export const isTightCrest = (url?: string | null): boolean =>
  Boolean(url && !url.includes("/art_blobs/"));

/**
 * THE cross-site standard for football LOGO (crest) cards. Every crest -
 * template-uploaded or resolved from the football-logos library - renders
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
   * HeroCarousel - every other surface uses imageOffsetY above.
   */
  heroImageOffsetY: -20,
} as const;

/**
 * Deterministic color + shape for an event. `id` keeps it stable per card.
 * `overrides` (future backoffice fields) win when provided.
 */
export const getEventArt = (
  id: string | number,
  overrides?: Partial<EventArt>,
): EventArt => {
  const h = hash(String(id));
  return {
    colorIndex: overrides?.colorIndex ?? h % EVENT_ART_COLORS.length,
    // bit-shift so shape doesn't correlate with colour
    shapeIndex: overrides?.shapeIndex ?? (h >> 3) % EVENT_ART_SHAPES,
  };
};
