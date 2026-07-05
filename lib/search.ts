import type Fuse from "fuse.js";

/**
 * Multi-term fuzzy search over a Fuse index.
 *
 * Fuse matches the whole query as a single pattern against each field, so a
 * combined query like "באד באני פריז" (artist + city) matches nothing — no one
 * field holds the full string. Here we split the query on whitespace and require
 * EVERY word to match (AND), each word free to match a different field. That way
 * "באד באני" hits the event name and "פריז" hits its location, and only the
 * event that satisfies all words is returned.
 *
 * Single-word queries behave exactly like `fuse.search(...)` — no regression.
 * Each Fuse instance keeps its own keys/threshold, so this works for events,
 * teams and artists alike.
 */
export function multiTermSearch<T>(fuse: Fuse<T>, query: string): T[] {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  if (terms.length === 1) return fuse.search(terms[0]).map((r) => r.item);

  // Per-word result sets; intersect them. First word drives relevance order.
  const [first, ...rest] = terms.map(
    (t) => new Set(fuse.search(t).map((r) => r.item))
  );
  return Array.from(first).filter((item) => rest.every((s) => s.has(item)));
}
