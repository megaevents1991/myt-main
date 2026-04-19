# Offline Hotel Multi-Room Allocation & Reservation Fidelity

**Date:** 2026-04-19
**Status:** Approved for implementation
**Affects:** `myt---main`, `myt---backoffice`, shared Supabase schema

## Problem

Offline hotel inventory is uploaded in per-room-type rows (e.g. one row for `Double`, another for `Triple`). For parties that do not fit in a single room type (5 pax needs Triple + Double), the platform must:

1. Present a single offline hotel option to the customer only when the full party can be accommodated with combined inventory rows from the same hotel.
2. Record every consumed inventory row on the reservation so operations can trace which specific rows were allocated.
3. Only decrement stock after payment succeeds (not at order creation).

Current behavior (partial):
- `/api/offline-hotels` already groups rows by `hid` and runs `matchRoomsToInventory` — this part works. If the hotel cannot satisfy the full party, it is dropped from results.
- `/api/confirm-order` stores only the first matched row in `offline_hotel_id` and decrements inventory **before payment completes**, so abandoned orders silently consume stock.
- Backoffice reservation page reads only `offline_hotel_id`, so multi-row matches display incompletely.

## Non-Goals

- Cross-hotel combinations (Double at Hotel A + Triple at Hotel B). Rooms must come from one hotel (one `hid`).
- Auto-splitting the customer's party into optimal rooms. The user chooses room configuration manually in the hotel step; the system matches what they requested.
- Changing `getRoomParams` defaults. Current output (`[3,2]` for 5 pax) is already correct.

## Design

### 1. Inventory decrement moves to payment success

**Current:** `app/api/confirm-order/route.ts` decrements `offline_hotels.consumed_rooms` and `flights.consumed_quantity` immediately after inserting the reservation row.

**Change:** Remove the decrement block from `confirm-order`. Add equivalent logic to `app/api/payment/[id]/[txId]/[promoCode]/route.ts`, gated on `isSuccess === true`, before (or after) the existing `update({ status: "Paid" })` call.

The payment route already reads the reservation (`orderData`). Extract `flight_order_info.offlineId` / `.numOfTravelers` and `hotel_order_info.offlineIds` / `.offlineId` from the stored JSON, run the same counting/decrement logic that lives today in `confirm-order`.

Failure of the decrement must not flip the payment result. Wrap in try/catch and log, identical to the current behavior.

### 2. Store full offline room ID array on the reservation

**Schema change (Supabase):**

```sql
ALTER TABLE reservations
  ADD COLUMN offline_hotel_ids integer[] NULL;
```

Keep `offline_hotel_id` for backwards compatibility (read by existing dashboard queries). Populate both going forward:
- `offline_hotel_id` = first element of the array (legacy)
- `offline_hotel_ids` = full array including repetition when the same row covers multiple requested rooms

**Code change:** In `confirm-order/route.ts`, read `hotel_order_info.offlineIds` (array already produced by `/api/offline-hotels`) and write it to the new column.

### 3. Backoffice reservation page shows all matched rooms

**Type change:** Add `offline_hotel_ids?: number[] | null` to `Reservation` in `backoffice/types/reservation.types.ts`.

**UI change:** In `backoffice/app/(dashboard)/reservations/[id]/page.tsx`, when the reservation is offline, query `offline_hotels` by the ID array:

```ts
const { data: rooms } = await supabase
  .from("offline_hotels")
  .select("id, hotel_name, room_type, price, check_in, check_out, meal_plan")
  .in("id", reservation.offline_hotel_ids ?? [reservation.offline_hotel_id].filter(Boolean));
```

Render each allocated row as its own line in the Hotel Information card: `{hotel_name} — {room_type} ({check_in} → {check_out}) — ${price}`. When the same row appears multiple times in the array, collapse to `{room_type} × N`.

Fallback: if `offline_hotel_ids` is null (legacy reservations), fall back to the single `offline_hotel_id` to preserve display for old data.

### 4. Shared type sync

Duplicate the `offline_hotel_ids` field in both `main/lib/app.types.ts` and `backoffice/types/reservation.types.ts` (or wherever the reservation row type lives in main, if at all). Follow the existing duplicate-and-keep-in-sync rule from root `CLAUDE.md`.

## Data Flow (after change)

```
Customer configures rooms → POST /api/offline-hotels
  → matchRoomsToInventory returns { rowIds: [11, 13], totalPrice }
  → Hotel shown in UI with combined price

Customer submits order → POST /api/confirm-order
  → Insert reservation:
      offline_hotel_id     = 11
      offline_hotel_ids    = [11, 13]
      hotel_order_info     = { ...isOffline: true, offlineIds: [11, 13], offlineRawPrice }
    (NO inventory decrement here)

CreditGuard callback → GET /api/payment/[id]/[txId]/[promoCode]
  → If isSuccess:
      1. Update reservation.status = "Paid"
      2. Decrement offline_hotels.consumed_rooms for each id in offline_hotel_ids
      3. Decrement flights.consumed_quantity by numOfTravelers if offline_flight_id set
```

## Edge Cases

- **Abandoned order:** Reservation stays Pending, no inventory consumed. Matches current behavior for online hotels.
- **Payment retry after failure:** Payment route is idempotent only to the extent of the status flip. Decrement must not run twice for the same reservation. Guard by checking current `status` before decrementing — only decrement on Pending → Paid transition.
- **Partial match:** `matchRoomsToInventory` already returns null and drops the hotel when any requested room cannot be satisfied. No partial bookings.
- **Legacy reservations:** Existing paid reservations have `offline_hotel_id` set and `offline_hotel_ids` null. Backoffice must handle both.

## Testing

Manual:
1. Configure 5 pax as `[{adults:3},{adults:2}]`. Event with Triple + Double inventory at same hid. Hotel appears with combined price.
2. Event with only Doubles. Hotel does not appear.
3. Complete booking → reservation row has `offline_hotel_ids = [tripleId, doubleId]`, inventory NOT yet decremented.
4. CreditGuard success callback → status becomes Paid, `consumed_rooms` incremented on both rows.
5. CreditGuard failure → status stays Pending, inventory unchanged.
6. Retry payment after success → inventory not double-decremented.
7. Backoffice reservation page shows both room types.

## Open Questions

None at spec approval time.
