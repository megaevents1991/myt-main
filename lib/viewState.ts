/**
 * View state that survives a refresh - and a Back from an order page.
 *
 * Lists on this site (a category's events, a team's fixtures, the homepage's "more
 * events") kept their filters, sort and "show more" count in React state only, so F5
 * or Back returned the visitor to the unfiltered first page. They are now mirrored
 * into sessionStorage (this browser tab only) under `myt:view:<pathname>:<name>`.
 *
 * Never the URL: these pages are ISR, and reading search params would either need a
 * Suspense boundary around the whole list or turn the page dynamic.
 *
 * The parsers are pure (lib/__tests__/viewState.test.ts). A stored value is only ever
 * a hint - whatever does not pass its parser is ignored and the screen opens as usual.
 */

export const viewStateKey = (pathname: string, name: string) =>
  `myt:view:${pathname || "/"}:${name}`;

/** A stored value as its parser understands it, or null (nothing stored, junk, wrong shape). */
export function parseStoredView<T>(
  raw: string | null,
  parse: (value: unknown) => T | null,
): T | null {
  if (raw === null) return null;
  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Browser only. Private mode / blocked storage reads as "nothing stored". */
export function readStoredView<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    if (typeof window === "undefined") return null;
    return parseStoredView(window.sessionStorage.getItem(key), parse);
  } catch {
    return null;
  }
}

/** `null` forgets the key - a screen back at its defaults leaves nothing behind. */
export function writeStoredView(key: string, value: unknown | null) {
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / blocked storage - the screen simply does not remember */
  }
}

/** Parser for a value that must be one of a fixed list (a sort key, a tab). */
export const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): T | null =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : null;

/** Parser for a whole number inside a range (a "show more" count). */
export const intBetween =
  (min: number, max: number) =>
  (value: unknown): number | null =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
      ? value
      : null;

/* ── The category page's event browser (components/CategoryEventsBrowser.tsx) ── */

export const BROWSER_SORTS = ["date", "price_asc", "price_desc"] as const;
export type BrowserSort = (typeof BROWSER_SORTS)[number];

export type BrowserView = {
  query: string;
  city: string;
  months: string[];
  dateFrom: string;
  dateTo: string;
  maxPrice: string;
  sort: BrowserSort;
  hideSoldOut: boolean;
  tags: string[];
  /** How many cards "הצג עוד" had opened. */
  visible: number;
  advancedOpen: boolean;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const MAX_VISIBLE = 2000;

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.length <= max ? value : null;
const textList = (value: unknown, max: number, test?: RegExp): string[] | null =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((v) => typeof v === "string" && v.length <= 120 && (!test || test.test(v)))
    ? (value as string[])
    : null;
const day = (value: unknown): string | null =>
  value === "" || (typeof value === "string" && ISO_DAY.test(value)) ? value : null;

/** The stored browser view when every field has the right shape - otherwise null (all or nothing). */
export function parseBrowserView(value: unknown): BrowserView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const query = text(v.query, 100);
  const city = text(v.city, 120);
  const months = textList(v.months, 36, ISO_MONTH);
  const dateFrom = day(v.dateFrom);
  const dateTo = day(v.dateTo);
  const maxPrice = text(v.maxPrice, 20);
  const sort = oneOf(BROWSER_SORTS)(v.sort);
  const tags = textList(v.tags, 40);
  const visible = intBetween(1, MAX_VISIBLE)(v.visible);
  if (
    query === null ||
    city === null ||
    months === null ||
    dateFrom === null ||
    dateTo === null ||
    maxPrice === null ||
    sort === null ||
    tags === null ||
    visible === null ||
    typeof v.hideSoldOut !== "boolean" ||
    typeof v.advancedOpen !== "boolean"
  ) {
    return null;
  }
  return {
    query,
    city,
    months,
    dateFrom,
    dateTo,
    maxPrice,
    sort,
    hideSoldOut: v.hideSoldOut,
    tags,
    visible,
    advancedOpen: v.advancedOpen,
  };
}

/**
 * The stored view against what the page offers TODAY: a city, a month or a tag that
 * is no longer on the page is dropped (it would only empty the grid), and a price cap
 * outside the slider's range goes back to "any price".
 */
export function fitBrowserView(
  view: BrowserView,
  page: {
    all: string;
    cities: ReadonlySet<string>;
    months: ReadonlySet<string>;
    tags: ReadonlySet<string>;
    priceBounds: { min: number; max: number } | null;
  },
): BrowserView {
  const cap = Number(view.maxPrice);
  const capFits =
    view.maxPrice !== page.all &&
    !!page.priceBounds &&
    Number.isFinite(cap) &&
    cap >= page.priceBounds.min &&
    cap <= page.priceBounds.max;
  return {
    ...view,
    city: view.city === page.all || page.cities.has(view.city) ? view.city : page.all,
    months: view.months.filter((m) => page.months.has(m)),
    tags: view.tags.filter((t) => page.tags.has(t)),
    maxPrice: capFits ? view.maxPrice : page.all,
  };
}
