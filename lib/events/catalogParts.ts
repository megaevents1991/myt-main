/**
 * The events catalog is cached in PARTS, because Next's data cache refuses one item over
 * 2 MB - silently (lib/events/cacheItemSize.ts) - and the catalog in one piece reached 87%
 * of that at 440 events.
 *
 * An event belongs to a part by its id, never by its place in the list. So a part that was
 * refreshed a moment after the others still holds exactly its own events: put together,
 * the parts cannot show an event twice or lose one.
 */
export function catalogPart<T extends { id: number }>(
  events: T[],
  part: number,
  parts: number,
): T[] {
  return events.filter((event) => partOf(event.id, parts) === part);
}

function partOf(id: number, parts: number): number {
  return ((Math.trunc(id) % parts) + parts) % parts;
}

/**
 * The parts back into one catalog: soonest first, and events of the same day by id.
 * The database promised no order among events of one day, and gave a different one on
 * every read - which is why a list cut after N events could show another event each time.
 */
export function mergeCatalogParts<T extends { id: number; date: string }>(
  parts: T[][],
): T[] {
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const part of parts) {
    for (const event of part) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      merged.push(event);
    }
  }
  return merged.sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
  );
}
