// Ready package ("חבילה מוכנה") - the customer side's pure rules. Mirrors the
// backoffice's lib/ready-package.ts (spec there:
// docs/superpowers/specs/2026-10-04-ready-package-design.md).
//
// Some events carry ONE house-built package (ticket + flight + hotel). In
// `live` a click on the event card lands on the order summary with that
// package already chosen; in `preview` only the staff link (?ready=<token>)
// opens it and every customer still gets the regular flow.

import type { Event } from "@/lib/app.types";

export type ReadyPackageMode = "off" | "preview" | "live";

const MODES: readonly string[] = ["off", "preview", "live"];

/** `events.ready_package_mode` as read: anything but a known mode is "off". */
export function readyMode(value: unknown): ReadyPackageMode {
  return MODES.includes(String(value)) ? (value as ReadyPackageMode) : "off";
}

type ReadyEvent = Pick<Event, "ready_package_token" | "ready_package_mode">;

/**
 * Which ready-package token this page load opens; null = the regular flow.
 *
 * - `?orderId` (a held order) and `?pkg` (a partner's package) bring their own
 *   order and always win.
 * - `?build=1` asks for the regular flow outright.
 * - `live`: the event's package, with or without `?ready`.
 * - `preview`: only when `?ready` carries the event's own token.
 */
export function readyPackageEntry(
  event: ReadyEvent | null | undefined,
  search: string,
): string | null {
  const token = event?.ready_package_token;
  if (!token) return null;
  const mode = readyMode(event?.ready_package_mode);
  if (mode === "off") return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (params.get("orderId") || params.get("pkg")) return null;
  if (params.get("build") === "1") return null;
  if (mode === "live") return token;
  return params.get("ready") === token ? token : null;
}

/**
 * The per-person price the site shows for an event that opens on its ready
 * package. Only in `live` - a preview changes nothing a customer sees.
 */
export function readyPackageCardPrice(
  event: Pick<
    Event,
    "ready_package_token" | "ready_package_mode" | "ready_package_price_usd"
  >,
): number | null {
  if (!event.ready_package_token) return null;
  if (readyMode(event.ready_package_mode) !== "live") return null;
  const price = Number(event.ready_package_price_usd);
  return Number.isFinite(price) && price > 0 ? Math.ceil(price) : null;
}

/**
 * Top of the traveller picker: the site's own cap on tickets per order (the
 * ticket step's MAX_TICKETS, and the 1..9 traveller select of the flight
 * step). A ready package has no limit of its own - the backoffice prices it
 * for every size up to this, and a size it could not price is simply absent.
 * Mirrors the backoffice's READY_MAX_TRAVELERS_CAP.
 */
export const READY_MAX_TRAVELERS_CAP = 9;

/** Which pieces of a ready package the customer may swap ("החלפה" on that card). */
export type ReadySwap = { ticket: boolean; flight: boolean; hotel: boolean };

const SWAP_ALL: ReadySwap = { ticket: true, flight: true, hotel: true };
const SWAP_NONE: ReadySwap = { ticket: false, flight: false, hotel: false };

/**
 * Per piece: may the customer swap it. The package's own breakdown when it has
 * a whole one (three booleans); a package saved before the breakdown existed
 * follows `allow_edit` for every piece. Mirrors the backoffice's swapOf.
 */
export function swapOf(spec: unknown, allowEdit: boolean | null | undefined): ReadySwap {
  const raw =
    spec && typeof spec === "object" && !Array.isArray(spec)
      ? (spec as { swap?: unknown }).swap
      : undefined;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    if (
      typeof value.ticket === "boolean" &&
      typeof value.flight === "boolean" &&
      typeof value.hotel === "boolean"
    ) {
      return { ticket: value.ticket, flight: value.flight, hotel: value.hotel };
    }
  }
  return allowEdit === false ? SWAP_NONE : SWAP_ALL;
}

/**
 * How a party is roomed, from a hotel's room list (one entry per room):
 * "חדר זוגי", "2 חדרים זוגיים", "חדר ל-3 + חדר זוגי". Empty when unknown.
 */
export function roomsLabel(
  guests: { adults?: number; children?: unknown[] }[] | null | undefined,
): string {
  const sizes = (guests ?? [])
    .map((room) => Math.max(0, Math.floor(Number(room?.adults) || 0)) + (room?.children?.length ?? 0))
    .filter((size) => size > 0);
  if (sizes.length === 0) return "";
  const rooms = new Map<number, number>();
  for (const size of sizes) rooms.set(size, (rooms.get(size) ?? 0) + 1);
  const one = (size: number) =>
    size === 1 ? "חדר ליחיד" : size === 2 ? "חדר זוגי" : `חדר ל-${size}`;
  const several = (size: number, count: number) =>
    size === 1
      ? `${count} חדרים ליחיד`
      : size === 2
        ? `${count} חדרים זוגיים`
        : `${count} חדרים ל-${size}`;
  return [...rooms.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => (count === 1 ? one(size) : several(size, count)))
    .join(" + ");
}

/** Party sizes a house package is priced for: within its max, ascending. */
export function variantSizes(variants: unknown, maxTravelers: unknown): number[] {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) return [];
  const rawMax = Math.floor(Number(maxTravelers));
  const max =
    Number.isFinite(rawMax) && rawMax >= 1
      ? Math.min(rawMax, READY_MAX_TRAVELERS_CAP)
      : READY_MAX_TRAVELERS_CAP;
  return Object.entries(variants as Record<string, unknown>)
    .filter(([, value]) => !!value && typeof value === "object")
    .map(([key]) => Number(key))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= max)
    .sort((a, b) => a - b);
}

/**
 * The party size to serve: the one asked for when it is priced, else the size
 * the package was built for. Null = the package cannot open at all.
 */
export function pickPax(
  sizes: number[],
  asked: number | null | undefined,
  builtFor: number,
): number | null {
  if (asked != null && sizes.includes(asked)) return asked;
  return sizes.includes(builtFor) ? builtFor : null;
}

/** The next priced size up (+1) or down (-1) from `current`; null at the end. */
export function neighbourPax(
  sizes: number[],
  current: number,
  direction: 1 | -1,
): number | null {
  const sorted = [...sizes].sort((a, b) => a - b);
  const candidates =
    direction === 1
      ? sorted.filter((n) => n > current)
      : sorted.filter((n) => n < current).reverse();
  return candidates[0] ?? null;
}
