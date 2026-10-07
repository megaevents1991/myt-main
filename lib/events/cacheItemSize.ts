/**
 * How big a value is to Next's data cache - the number `unstable_cache` is judged by.
 *
 * Next stores the value as a JSON STRING inside its cache entry and measures the entry
 * (node_modules/next/dist/server/lib/incremental-cache/index.js: `JSON.stringify(data).length`,
 * refused above `2 * 1024 * 1024`). So every quote and backslash of the value is counted
 * twice, and a catalog that is 1.6M characters as JSON weighs about 1.8M there.
 *
 * Over the limit the write is dropped WITHOUT an error in production: the value is simply
 * never cached and every render fetches it again (the 2026-09-17 outage).
 */
export const DATA_CACHE_ITEM_LIMIT = 2 * 1024 * 1024;

/** From here on the catalog is close enough to the limit to say so in the log. */
export const DATA_CACHE_ITEM_NEAR = 0.85;

export function dataCacheItemSize(value: unknown): number {
  const entry = {
    kind: "FETCH",
    data: { headers: {}, body: JSON.stringify(value), status: 200, url: "" },
    revalidate: 3600,
  };
  return JSON.stringify(entry).length;
}

export type DataCacheItemState = "ok" | "near" | "over";

export function dataCacheItemState(size: number): DataCacheItemState {
  if (size > DATA_CACHE_ITEM_LIMIT) return "over";
  if (size >= DATA_CACHE_ITEM_LIMIT * DATA_CACHE_ITEM_NEAR) return "near";
  return "ok";
}
