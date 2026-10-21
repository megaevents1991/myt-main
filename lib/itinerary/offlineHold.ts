/**
 * "Build Your Euro Trip" - a stay on OUR OWN hotel stock (`offline_hotels`, picked from
 * /api/offline-hotels in the reused hotel step), handled exactly as the live order handles its
 * one hotel. COPY of app/api/confirm-order/route.ts - keep in sync:
 *  - the ids (route.ts:98-113): `offlineIds` when non-empty, else `[offlineId]`, else none;
 *  - the block-date check BEFORE the insert (route.ts:115-160): every linked row must exist and
 *    its check_in / check_out must EXACTLY equal the booked stay - else `OFFLINE_HOTEL_DATE_MISMATCH`;
 *    a failed read refuses the order too ("Failed to validate offline hotel");
 *  - the columns on the reservation (route.ts:388-390): `offline_hotel_id` (the first id),
 *    `offline_hotel_ids`, `offline_hotel_cost` (`offlineRawPrice`, a booking-level total);
 *  - the hold AFTER the insert (route.ts:454 -> `holdOfflineInventory`, :742-805, hotel part):
 *    per row id, `consumed_rooms += how many times the id is listed` (one entry per room unit),
 *    read then write, failures logged - it never fails the order. Released only on cancellation.
 * The live route is never imported or edited (its helpers are not exported). A trip's flights
 * come from the Amadeus multi-city search only, so the flight half of the live hold has no copy.
 *
 * The database calls are handed in (`OfflineHotelDb`), so the rules are unit-tested.
 */
import type { OrderHotel } from "@/lib/app.types";

type OfflineLink = Pick<OrderHotel, "offlineId" | "offlineIds" | "offlineRawPrice" | "checkin" | "checkout">;

/** The `offline_hotels` ids the booking consumes (one per room unit), or null for a live hotel. */
export function offlineHotelIds(hotel: Partial<OfflineLink> | null | undefined): number[] | null {
  if (hotel?.offlineIds && hotel.offlineIds.length > 0) return hotel.offlineIds;
  if (hotel?.offlineId != null) return [hotel.offlineId];
  return null;
}

/** The reservation's own-stock hotel columns (all null for a live hotel or no hotel). */
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

export type BlockRow = { id: number; check_in: string; check_out: string };

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

export type OfflineHotelDb = {
  /** `offline_hotels.select("id, check_in, check_out").in("id", ids)`. */
  readBlocks: (ids: number[]) => PromiseLike<{ data: BlockRow[] | null; error: DbError }>;
  /** `offline_hotels.select("consumed_rooms").eq("id", id).single()`. */
  readConsumed: (id: number) => PromiseLike<{ data: { consumed_rooms: number | null } | null; error?: DbError }>;
  /** `offline_hotels.update({ consumed_rooms }).eq("id", id)`. */
  writeConsumed: (id: number, consumedRooms: number) => PromiseLike<{ error?: DbError }>;
};

/**
 * The block-date check of one stay's hotel, before the insert: "ok" for a live hotel or a block
 * that matches, "mismatch" (-> OFFLINE_HOTEL_DATE_MISMATCH), "error" when the blocks could not be
 * read (the live route answers 500 then).
 */
export async function checkOfflineHotel(
  hotel: Partial<OfflineLink> | null | undefined,
  db: OfflineHotelDb,
): Promise<{ result: "ok" } | { result: "mismatch"; rows: BlockRow[] } | { result: "error"; error: DbError }> {
  const ids = offlineHotelIds(hotel);
  if (!hotel || !ids) return { result: "ok" };
  const uniqueIds = Array.from(new Set(ids));
  try {
    const { data, error } = await db.readBlocks(uniqueIds);
    if (error) return { result: "error", error };
    const rows = data ?? [];
    return blockDatesMismatch(hotel, uniqueIds, rows) ? { result: "mismatch", rows } : { result: "ok" };
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
