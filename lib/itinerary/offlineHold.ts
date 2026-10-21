/**
 * "Build Your Euro Trip" - a stay on OUR OWN hotel stock (`offline_hotels`, picked from
 * /api/offline-hotels in the reused hotel step), handled as the live order handles its one hotel,
 * plus the checks a trip adds because every own-stock field of the request is the client's word.
 *
 * COPY of app/api/confirm-order/route.ts - keep in sync:
 *  - the ids (route.ts:108-113): `offlineIds` when non-empty, else `[offlineId]`, else none;
 *  - the block-date check BEFORE the insert (route.ts:115-160): every linked row must exist and
 *    its check_in / check_out must EXACTLY equal the booked stay - else `OFFLINE_HOTEL_DATE_MISMATCH`;
 *    a failed read refuses the order too ("Failed to validate offline hotel");
 *  - the columns on the reservation (route.ts:388-390): `offline_hotel_id` (the first id),
 *    `offline_hotel_ids`, `offline_hotel_cost` (a booking-level total);
 *  - the hold AFTER the insert (route.ts:454 -> `holdOfflineInventory`, :742-805, hotel part):
 *    per row id, `consumed_rooms += how many times the id is listed` (one entry per room unit),
 *    read then write, failures logged - it never fails the order. Released only on cancellation.
 *    The read-then-write race stays (live parity; an atomic update needs a migration).
 * The trip's own checks, against the rows read in the same query (`judgeOfflineHotel`):
 *  - one id per room of the stay (`guests` = the rooms), never more ids than travellers;
 *  - every row is a live block (`is_deleted` false) of one of the stay's events (`event_ids`),
 *    as /api/offline-hotels offers them;
 *  - the rows hold the rooms (room capacity, lib/offlineRoomCapacity.ts) and have them left
 *    (`num_rooms - consumed_rooms` >= the rooms taken) - else `OFFLINE_HOTEL_SOLD_OUT`;
 *  - the price is the rows' own: Σ `price` over the ids (how /api/offline-hotels builds the
 *    rate's `show_amount` = the order's `price` and the meta's `rawPrice` = `offlineRawPrice`);
 *    the cost stored is that server sum, never the client's;
 *  - refundable by the rows' own earliest `last_cancellation_date` (the rate /api/offline-hotels
 *    builds), with the live 7-day rule (lib/hotelRateTerms.ts).
 * The live route is never imported or edited (its helpers are not exported). A trip's flights come
 * from the Amadeus multi-city search only, so the flight half of the live hold has no copy.
 *
 * The database calls are handed in (`OfflineHotelDb`), so the rules are unit-tested.
 */
import type { OrderHotel } from "@/lib/app.types";
import { nonRefundableAllowed } from "@/lib/hotelRateTerms";
import { getOfflineRoomCapacity } from "@/lib/offlineRoomCapacity";

type OfflineLink = Pick<
  OrderHotel,
  "offlineId" | "offlineIds" | "offlineRawPrice" | "checkin" | "checkout" | "price" | "guests"
>;

/** The `offline_hotels` ids the booking consumes (one per room unit), or null for a live hotel. */
export function offlineHotelIds(hotel: Partial<OfflineLink> | null | undefined): number[] | null {
  if (hotel?.offlineIds && hotel.offlineIds.length > 0) return hotel.offlineIds;
  if (hotel?.offlineId != null) return [hotel.offlineId];
  return null;
}

/**
 * The reservation's own-stock hotel columns (all null for a live hotel or no hotel). The cost is
 * the one the server verified against the rows (`judgeOfflineHotel`) - the caller puts it on the
 * hotel before the rows are built.
 */
export function offlineHotelColumns(hotel: Partial<OfflineLink> | null | undefined): {
  offline_hotel_id: number | null;
  offline_hotel_ids: number[] | null;
  offline_hotel_cost: number | null;
} {
  const ids = offlineHotelIds(hotel);
  return {
    offline_hotel_id: ids ? ids[0] : null,
    offline_hotel_ids: ids,
    offline_hotel_cost: ids ? (hotel?.offlineRawPrice ?? null) : null,
  };
}

/** How many rooms each block row gives up: an id listed twice is two rooms of that row. */
export function roomCounts(ids: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

/** The row, as read before the insert (the live check's columns + the ones a trip checks). */
export type BlockRow = {
  id: number;
  check_in: string;
  check_out: string;
  price?: number | string | null;
  room_type?: string | null;
  num_rooms?: number | null;
  consumed_rooms?: number | null;
  event_ids?: number[] | null;
  is_deleted?: boolean | null;
  last_cancellation_date?: string | null;
};

/** The columns `readBlocks` selects. */
export const BLOCK_COLUMNS =
  "id, check_in, check_out, price, room_type, num_rooms, consumed_rooms, event_ids, is_deleted, last_cancellation_date";

/**
 * The live `datesMismatch`: no booked dates, a linked row missing, or a row whose dates are not
 * exactly the booked stay's.
 */
export function blockDatesMismatch(hotel: Partial<OfflineLink>, uniqueIds: number[], rows: BlockRow[]): boolean {
  const checkin = hotel.checkin;
  const checkout = hotel.checkout;
  return (
    !checkin ||
    !checkout ||
    uniqueIds.length !== rows.length ||
    rows.some((r) => r.check_in !== checkin || r.check_out !== checkout)
  );
}

type DbError = { code?: string; message?: string } | null;

/** What the check says. `ok.cost` = the rows' own price for the stay (null for a live hotel). */
export type OfflineVerdict =
  | { result: "ok"; cost: number | null }
  | { result: "mismatch"; rows: BlockRow[] }
  | { result: "changed"; reason: string }
  | { result: "sold_out"; rowId: number; left: number; asked: number }
  | { result: "not_refundable" }
  | { result: "error"; error: DbError };

/** The live `rateIsRefundable` on the block's own deadline (bare date or local time, compared as text). */
const deadlineAhead = (deadline: string, now: Date | number): boolean =>
  deadline > new Date(now).toISOString().slice(0, 19);

/**
 * Judges one stay's own-stock hotel on its rows (pure). `ctx.eventIds` = the stay's events (the
 * hotel step searched the first one's blocks); `ctx.pax` = the trip's party.
 */
export function judgeOfflineHotel(
  hotel: Partial<OfflineLink>,
  ctx: { pax: number; eventIds: number[]; now: Date | number },
  rows: BlockRow[],
): OfflineVerdict {
  const ids = offlineHotelIds(hotel);
  if (!ids) return { result: "ok", cost: null };
  const rooms = Array.isArray(hotel.guests) ? hotel.guests : [];
  if (ids.length !== rooms.length || ids.length > ctx.pax) {
    return { result: "changed", reason: `${ids.length} block rooms for ${rooms.length} rooms / ${ctx.pax} travellers` };
  }
  const uniqueIds = Array.from(new Set(ids));
  if (blockDatesMismatch(hotel, uniqueIds, rows)) return { result: "mismatch", rows };
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    if (r.is_deleted === true) return { result: "changed", reason: `block ${r.id} is deleted` };
    if (!(r.event_ids ?? []).some((id) => ctx.eventIds.includes(id))) {
      return { result: "changed", reason: `block ${r.id} is not one of events ${ctx.eventIds.join(",")}` };
    }
  }
  // The rows hold the rooms: the biggest room in the biggest unit, and so on (the matcher's fit).
  const sizes = rooms.map((g) => (Number(g?.adults) || 0) + (g?.children?.length ?? 0)).sort((a, b) => b - a);
  const capacities = ids.map((id) => getOfflineRoomCapacity(byId.get(id)?.room_type)).sort((a, b) => b - a);
  if (sizes.some((size, i) => size > capacities[i])) {
    return { result: "changed", reason: `rooms ${sizes.join("+")} do not fit units ${capacities.join("+")}` };
  }
  for (const [rowId, asked] of roomCounts(ids)) {
    const r = byId.get(rowId);
    const left = (Number(r?.num_rooms) || 0) - (Number(r?.consumed_rooms) || 0);
    if (left < asked) return { result: "sold_out", rowId, left, asked };
  }
  const cost = Math.round(ids.reduce((sum, id) => sum + Number(byId.get(id)?.price), 0) * 100) / 100;
  if (!Number.isFinite(cost) || cost <= 0) return { result: "changed", reason: `blocks have no price` };
  const near = (v: unknown) => Math.abs(Number(v) - cost) < 0.01;
  if (!near(hotel.price)) return { result: "changed", reason: `price ${hotel.price}, the blocks' ${cost}` };
  if (hotel.offlineRawPrice != null && !near(hotel.offlineRawPrice)) {
    return { result: "changed", reason: `cost ${hotel.offlineRawPrice}, the blocks' ${cost}` };
  }
  const deadlines = uniqueIds.map((id) => byId.get(id)?.last_cancellation_date).filter((d): d is string => !!d);
  const deadline = deadlines.length ? [...deadlines].sort()[0] : "";
  if (!(deadline && deadlineAhead(deadline, ctx.now)) && !nonRefundableAllowed(hotel.checkin, ctx.now)) {
    return { result: "not_refundable" };
  }
  return { result: "ok", cost };
}

export type OfflineHotelDb = {
  /** `offline_hotels.select(BLOCK_COLUMNS).in("id", ids)`. */
  readBlocks: (ids: number[]) => PromiseLike<{ data: BlockRow[] | null; error: DbError }>;
  /** `offline_hotels.select("consumed_rooms").eq("id", id).single()`. */
  readConsumed: (id: number) => PromiseLike<{ data: { consumed_rooms: number | null } | null; error?: DbError }>;
  /** `offline_hotels.update({ consumed_rooms }).eq("id", id)`. */
  writeConsumed: (id: number, consumedRooms: number) => PromiseLike<{ error?: DbError }>;
};

/**
 * One stay's own-stock hotel, before the insert: one read of its rows, then `judgeOfflineHotel`.
 * A live hotel (no ids) needs no read. A failed read is `error` (the live route answers 500).
 */
export async function checkOfflineHotel(
  hotel: Partial<OfflineLink> | null | undefined,
  ctx: { pax: number; eventIds: number[]; now: Date | number },
  db: OfflineHotelDb,
): Promise<OfflineVerdict> {
  const ids = offlineHotelIds(hotel);
  if (!hotel || !ids) return { result: "ok", cost: null };
  try {
    const { data, error } = await db.readBlocks(Array.from(new Set(ids)));
    if (error) return { result: "error", error };
    return judgeOfflineHotel(hotel, ctx, data ?? []);
  } catch (e) {
    return { result: "error", error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Holds the stay's rooms, after the insert: `consumed_rooms += count` per block row. Never throws;
 * a failure is logged (the live rule - the order stands, ops reconcile).
 */
export async function holdOfflineHotel(hotel: Partial<OfflineLink> | null | undefined, db: OfflineHotelDb): Promise<void> {
  const ids = offlineHotelIds(hotel);
  if (!ids) return;
  try {
    for (const [rowId, count] of roomCounts(ids)) {
      const { data: row } = await db.readConsumed(rowId);
      if (row) await db.writeConsumed(rowId, (row.consumed_rooms || 0) + count);
    }
  } catch (e) {
    console.error("[itinerary/confirm] Failed to hold offline inventory:", e);
  }
}
