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
