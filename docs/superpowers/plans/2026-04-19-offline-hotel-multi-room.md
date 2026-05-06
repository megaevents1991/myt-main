# Offline Hotel Multi-Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store full offline hotel row array on reservations, defer inventory decrement to payment success, surface all matched rooms in the backoffice reservation page.

**Architecture:** Three changes wired together. (1) Supabase schema gains `offline_hotel_ids integer[]`. (2) `confirm-order` writes the array and stops decrementing stock. (3) `payment` route decrements stock on the Pending → Paid transition only. (4) Backoffice `Reservation` type + detail page fetch the `offline_hotels` rows by ID and render all of them.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), TypeScript, React 19. No automated test runner in either project — verification is manual against dev + real Supabase.

**Spec:** [../specs/2026-04-19-offline-hotel-multi-room-design.md](../specs/2026-04-19-offline-hotel-multi-room-design.md)

**Projects touched:**
- `myt---main` (this repo) — paths below are relative to its root
- `myt---backoffice` — paths prefixed with `backoffice/`. Actual path on disk is `../myt---backoffice/...`

---

## Task 1: Add `offline_hotel_ids` column to `reservations` (Supabase)

**Files:**
- Create: `docs/superpowers/specs/2026-04-19-offline-hotel-multi-room.sql`

This SQL file is a record of the migration. The user runs it manually in the Supabase SQL editor — Supabase is shared between both projects and there is no migration tooling in this repo.

- [ ] **Step 1: Write the migration SQL**

Create `docs/superpowers/specs/2026-04-19-offline-hotel-multi-room.sql` with exactly this content:

```sql
-- 2026-04-19: multi-room offline hotel allocation
-- Adds an array column so multi-row matches (e.g. Triple + Double) can be
-- recorded on the reservation without losing rows 2..N.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS offline_hotel_ids integer[] NULL;

COMMENT ON COLUMN reservations.offline_hotel_ids IS
  'Offline hotel row IDs matched to this reservation. May repeat when a single row covers multiple requested rooms. offline_hotel_id (singular) is kept for backwards compatibility and holds offline_hotel_ids[0].';
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the Supabase project (`fandqafngybfdyslofmr`) → SQL Editor → paste the contents of `docs/superpowers/specs/2026-04-19-offline-hotel-multi-room.sql` → Run.

Verify:

```sql
SELECT column_name, data_type, udt_name
  FROM information_schema.columns
 WHERE table_name = 'reservations' AND column_name = 'offline_hotel_ids';
```

Expected row: `offline_hotel_ids | ARRAY | _int4`.

- [ ] **Step 3: Commit the SQL file**

```bash
git add docs/superpowers/specs/2026-04-19-offline-hotel-multi-room.sql
git commit -m "db: add reservations.offline_hotel_ids column"
```

---

## Task 2: Write `offline_hotel_ids` during order insert (main)

**Files:**
- Modify: `app/api/confirm-order/route.ts:22-54`

- [ ] **Step 1: Extend `hotelInfoForLink` typing and the insert payload**

In `app/api/confirm-order/route.ts`, replace the block currently at lines 22–54 (from the comment `// Surface offline inventory linkage…` through the closing `})` of `.insert({…})` and including the `.select().single()` chain) with:

```ts
  // Surface offline inventory linkage as top-level columns so the backoffice
  // can query / JOIN without unpacking the order JSON blobs.
  const flightInfoForLink = validatedData.flight_order_info as
    | { offlineId?: number; offlineRawPrice?: number }
    | undefined;
  const hotelInfoForLink = validatedData.hotel_order_info as
    | {
        offlineId?: number;
        offlineIds?: number[];
        offlineRawPrice?: number;
      }
    | undefined;

  const offlineHotelIdsForLink: number[] | null =
    hotelInfoForLink?.offlineIds && hotelInfoForLink.offlineIds.length > 0
      ? hotelInfoForLink.offlineIds
      : hotelInfoForLink?.offlineId != null
      ? [hotelInfoForLink.offlineId]
      : null;

  const { data, error } = await (supabase as any)
    .from("reservations")
    .insert({
      main_contact_first_name: validatedData.main_contact_first_name,
      main_contact_last_name: validatedData.main_contact_last_name,
      main_contact_phone_number: validatedData.main_contact_phone_number,
      main_contact_email: validatedData.main_contact_email,
      more_pax_info: validatedData.more_pax_info,
      event_order_info: validatedData.event_order_info,
      flight_order_info: validatedData.flight_order_info,
      hotel_order_info: validatedData.hotel_order_info,
      user_shown_price: validatedData.user_shown_price,
      event_id: validatedData.event_id,
      payment_info: payNow ? {} : null,
      aff_partner_tracking_code: validatedData.aff_partner_tracking_code,
      final_purchase_price_ils: validatedData.final_purchase_price_ils,
      exchange_rate_usd_ils_100: validatedData.exchange_rate_usd_ils_100,
      gtmIdnts: gtmIdnts || null,
      status: onlySave ? "24Save" : "Pending",
      offline_flight_id: flightInfoForLink?.offlineId ?? null,
      offline_flight_cost: flightInfoForLink?.offlineRawPrice ?? null,
      offline_hotel_id: offlineHotelIdsForLink ? offlineHotelIdsForLink[0] : null,
      offline_hotel_ids: offlineHotelIdsForLink,
      offline_hotel_cost: hotelInfoForLink?.offlineRawPrice ?? null,
    })
    .select()
    .single();
```

- [ ] **Step 2: Build and type-check**

Run:
```bash
yarn build
```
Expected: build succeeds. If TypeScript complains about `offline_hotel_ids` not being known by Supabase's generated types, the existing file already uses `(supabase as any)` on the insert — this is unchanged and silences it. Any new error signals a regression; do not cast wider.

- [ ] **Step 3: Commit**

```bash
git add app/api/confirm-order/route.ts
git commit -m "feat: write offline_hotel_ids array on reservation insert"
```

---

## Task 3: Remove inventory decrement from `confirm-order` (main)

**Files:**
- Modify: `app/api/confirm-order/route.ts:75-137`

- [ ] **Step 1: Delete the decrement block**

In `app/api/confirm-order/route.ts`, delete lines 75–137 inclusive — the entire comment `// Best-effort: decrement offline inventory…` through the closing `}` of the `catch (decrementError)` block.

Nothing replaces it. The next statement is `// Generate referral tracking code only for non-agent bookings`; that comment now follows the insert error check directly.

- [ ] **Step 2: Build**

```bash
yarn build
```
Expected: build succeeds. No remaining references to `consumed_rooms` or `consumed_quantity` in this file:

```bash
grep -n "consumed_rooms\|consumed_quantity" app/api/confirm-order/route.ts
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/confirm-order/route.ts
git commit -m "refactor: move offline inventory decrement out of confirm-order"
```

---

## Task 4: Decrement offline inventory on payment success (main)

**Files:**
- Modify: `app/api/payment/[id]/[txId]/[promoCode]/route.ts`

- [ ] **Step 1: Add the decrement helper at the bottom of the file**

Open `app/api/payment/[id]/[txId]/[promoCode]/route.ts`. After the existing `export async function GET(...)` body, add this helper (outside the function, below it):

```ts
async function decrementOfflineInventory(orderData: OrderData) {
  try {
    const flightInfo = orderData.flight_order_info as
      | { offlineId?: number; numOfTravelers?: number }
      | undefined;
    if (flightInfo?.offlineId) {
      const { data: flightRow } = await supabase
        .from("flights")
        .select("consumed_quantity")
        .eq("id", flightInfo.offlineId)
        .single();
      if (flightRow) {
        await supabase
          .from("flights")
          .update({
            consumed_quantity:
              (flightRow.consumed_quantity || 0) +
              (flightInfo.numOfTravelers || 0),
          })
          .eq("id", flightInfo.offlineId);
      }
    }

    const hotelInfo = orderData.hotel_order_info as
      | { offlineId?: number; offlineIds?: number[] }
      | undefined;
    const offlineHotelIds: number[] =
      hotelInfo?.offlineIds && hotelInfo.offlineIds.length > 0
        ? hotelInfo.offlineIds
        : hotelInfo?.offlineId
        ? [hotelInfo.offlineId]
        : [];
    if (offlineHotelIds.length > 0) {
      const counts = new Map<number, number>();
      for (const rowId of offlineHotelIds) {
        counts.set(rowId, (counts.get(rowId) || 0) + 1);
      }
      for (const [rowId, count] of counts) {
        const { data: hotelRow } = await (supabase as any)
          .from("offline_hotels")
          .select("consumed_rooms")
          .eq("id", rowId)
          .single();
        if (hotelRow) {
          await (supabase as any)
            .from("offline_hotels")
            .update({
              consumed_rooms: (hotelRow.consumed_rooms || 0) + count,
            })
            .eq("id", rowId);
        }
      }
    }
  } catch (decrementError) {
    console.error("Failed to decrement offline inventory:", decrementError);
  }
}
```

- [ ] **Step 2: Call the helper only on the Pending → Paid transition**

Still in `app/api/payment/[id]/[txId]/[promoCode]/route.ts`, replace the block from `const orderData = data as OrderData;` (line 60) through the final `.update(updateObj)…` call (line 81) with:

```ts
  const orderData = data as OrderData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateObj = { payment_info: result, status: isSuccess ? "Paid" : "Pending" } as any;

  if (!orderData.confirmation_email_sent) {
    await sendUserEmail({
      orderData,
      isPaymentSuccess: isSuccess,
      payNow: true,
      partnerTrackingCode: promoCode,
      orderId: parseInt(id),
    });

    updateObj["confirmation_email_sent"] = true;
  }

  // Idempotency guard: only decrement on the first Pending → Paid flip. If the
  // reservation is already Paid we are replaying a callback and must not
  // consume stock again.
  const shouldDecrement = isSuccess && orderData.status !== "Paid";

  await supabase
    .from("reservations")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  if (shouldDecrement) {
    await decrementOfflineInventory(orderData);
  }
```

Note: `orderData.status` is read from the DB row fetched at the top of the function. If `OrderData` does not already declare `status`, extend the type locally as shown below in Step 3.

- [ ] **Step 3: Ensure `OrderData` exposes `status`**

Run:

```bash
grep -n "status" lib/app.types.ts | head
```

If `OrderData` / `Reservation` type in `lib/app.types.ts` does not include `status?: string`, add it to the type. Find the `OrderData` type definition and add `status?: string;` alongside the other optional metadata fields (next to `confirmation_email_sent` if present).

If the grep shows `status` already on the type, skip this step.

- [ ] **Step 4: Build**

```bash
yarn build
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/api/payment/[id]/[txId]/[promoCode]/route.ts lib/app.types.ts
git commit -m "feat: decrement offline inventory on payment success only"
```

---

## Task 5: Update backoffice `Reservation` type

**Files:**
- Modify: `../myt---backoffice/types/reservation.types.ts:47-50`

- [ ] **Step 1: Add the array field**

In `../myt---backoffice/types/reservation.types.ts`, find the block:

```ts
  // Offline inventory linkage — populated when the reservation consumed a
  // Mega-owned flight / hotel row. Top-level for cheap JOINs and filtering.
  offline_flight_id?: number | null;
  offline_flight_cost?: number | null;
  offline_hotel_id?: number | null;
  offline_hotel_cost?: number | null;
```

Replace it with:

```ts
  // Offline inventory linkage — populated when the reservation consumed a
  // Mega-owned flight / hotel row. Top-level for cheap JOINs and filtering.
  // offline_hotel_ids holds every row consumed by the booking (may repeat when
  // one row covers multiple requested rooms). offline_hotel_id mirrors [0]
  // for backwards compatibility with pre-2026-04-19 reservations.
  offline_flight_id?: number | null;
  offline_flight_cost?: number | null;
  offline_hotel_id?: number | null;
  offline_hotel_ids?: number[] | null;
  offline_hotel_cost?: number | null;
```

- [ ] **Step 2: Build the backoffice project**

```bash
cd ../myt---backoffice
yarn build
```
Expected: build succeeds.

- [ ] **Step 3: Commit (in backoffice repo)**

```bash
cd ../myt---backoffice
git add types/reservation.types.ts
git commit -m "types: add offline_hotel_ids to Reservation"
```

---

## Task 6: Fetch offline hotel rows in backoffice reservation page

**Files:**
- Modify: `../myt---backoffice/app/(dashboard)/reservations/[id]/page.tsx`

This page currently fetches a single reservation and renders it. It does not fetch `offline_hotels` rows. We add a fetch for the matched rows and expose them to the render.

- [ ] **Step 1: Read the current data-fetch block to locate the integration point**

Open `../myt---backoffice/app/(dashboard)/reservations/[id]/page.tsx` and find where the reservation is fetched (it will be a `useEffect` or async server call with `supabase.from("reservations").select(...)`). Note the variable that holds the reservation (likely `reservation`) and whether the component is a client or server component (`"use client"` at top).

- [ ] **Step 2: Add the `offline_hotels` fetch**

After the reservation is loaded and not null, add an additional fetch. If the page is a client component using `useEffect`, add a second `useEffect` keyed on the reservation. If it is a server component, await the fetch alongside the reservation.

Client component variant (use when `"use client"` is at the top of the file):

```tsx
const [offlineRooms, setOfflineRooms] = useState<
  Array<{
    id: number;
    hotel_name: string;
    room_type: string;
    price: string | number;
    check_in: string;
    check_out: string;
    meal_plan: string | null;
  }>
>([]);

useEffect(() => {
  if (!reservation) return;
  const ids =
    reservation.offline_hotel_ids && reservation.offline_hotel_ids.length > 0
      ? reservation.offline_hotel_ids
      : reservation.offline_hotel_id != null
      ? [reservation.offline_hotel_id]
      : [];
  if (ids.length === 0) {
    setOfflineRooms([]);
    return;
  }
  const uniqueIds = Array.from(new Set(ids));
  (async () => {
    const { data } = await supabase
      .from("offline_hotels")
      .select("id, hotel_name, room_type, price, check_in, check_out, meal_plan")
      .in("id", uniqueIds);
    setOfflineRooms(data ?? []);
  })();
}, [reservation]);
```

Server component variant (use when the file is a server component — no `"use client"`):

```tsx
const offlineHotelIds =
  reservation.offline_hotel_ids && reservation.offline_hotel_ids.length > 0
    ? reservation.offline_hotel_ids
    : reservation.offline_hotel_id != null
    ? [reservation.offline_hotel_id]
    : [];
const uniqueOfflineHotelIds = Array.from(new Set(offlineHotelIds));

const { data: offlineRooms } = uniqueOfflineHotelIds.length
  ? await supabase
      .from("offline_hotels")
      .select("id, hotel_name, room_type, price, check_in, check_out, meal_plan")
      .in("id", uniqueOfflineHotelIds)
  : { data: [] as Array<{ id: number; hotel_name: string; room_type: string; price: string | number; check_in: string; check_out: string; meal_plan: string | null }> };
```

Also compute the count of each row for the collapsed display:

```tsx
const offlineRoomCounts = new Map<number, number>();
const sourceIds =
  reservation.offline_hotel_ids && reservation.offline_hotel_ids.length > 0
    ? reservation.offline_hotel_ids
    : reservation.offline_hotel_id != null
    ? [reservation.offline_hotel_id]
    : [];
for (const rowId of sourceIds) {
  offlineRoomCounts.set(rowId, (offlineRoomCounts.get(rowId) || 0) + 1);
}
```

- [ ] **Step 3: Render the matched rooms inside the Hotel Information card**

In the same file, locate the Hotel Information `<Card>` (around line 513, the one whose header is `<span>Hotel Information</span>`). Inside its `<CardContent>`, immediately before the closing `</CardContent>`, add:

```tsx
{offlineRooms && offlineRooms.length > 0 && (
  <div>
    <p className="text-sm font-medium">Mega inventory rooms</p>
    <div className="space-y-1">
      {offlineRooms.map((room) => {
        const count = offlineRoomCounts.get(room.id) || 1;
        return (
          <div key={room.id} className="text-sm">
            <span className="font-medium">{room.hotel_name}</span>
            {" — "}
            {room.room_type}
            {count > 1 ? ` × ${count}` : ""}
            {" ("}
            {new Date(room.check_in).toLocaleDateString()}
            {" → "}
            {new Date(room.check_out).toLocaleDateString()}
            {") — $"}
            {Number(room.price).toFixed(2)} / room
            {room.meal_plan ? ` — ${room.meal_plan}` : ""}
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: Build the backoffice project**

```bash
cd ../myt---backoffice
yarn build
```
Expected: build succeeds.

- [ ] **Step 5: Commit (in backoffice repo)**

```bash
cd ../myt---backoffice
git add app/\(dashboard\)/reservations/\[id\]/page.tsx
git commit -m "feat: list all offline rooms on reservation detail page"
```

---

## Task 7: End-to-end manual verification

No automated test suite exists. Verify in dev against the real Supabase project.

- [ ] **Step 1: Seed / confirm offline inventory for a test event**

Pick an existing test event (or the Bruno Mars one, event 400). Ensure `offline_hotels` has at least:
- One row with `room_type = 'Triple'`, `num_rooms - consumed_rooms >= 1`, same `hid` as another row.
- One row with `room_type = 'Double'`, same `hid`, `num_rooms - consumed_rooms >= 1`.

Use the backoffice offline-hotels editor or the Supabase dashboard.

- [ ] **Step 2: Boot both apps**

```bash
# terminal 1 — main
yarn dev
# terminal 2 — backoffice
cd ../myt---backoffice && yarn dev
```

- [ ] **Step 3: Walk the booking flow as 5 pax**

In the main app, open the event page. In the hotel step set room configuration to `[{adults:3},{adults:2}]`. Confirm that:
- The offline hotel appears in the list with combined price (Triple + Double).
- If you change inventory to remove the Triple, the offline hotel disappears.

Complete the booking through the review step. Submit the order. Note the reservation ID from the confirmation / URL.

- [ ] **Step 4: Verify DB state before payment**

Query in Supabase SQL editor:

```sql
SELECT id, status, offline_hotel_id, offline_hotel_ids
  FROM reservations WHERE id = <new id>;

SELECT id, room_type, num_rooms, consumed_rooms
  FROM offline_hotels WHERE id = ANY(
    (SELECT offline_hotel_ids FROM reservations WHERE id = <new id>)
  );
```

Expected: reservation `status = 'Pending'`, `offline_hotel_ids` is an array with 2 entries (e.g. `{13, 11}`), `offline_hotel_id` equals the first entry. The `offline_hotels.consumed_rooms` values are UNCHANGED from before the booking.

- [ ] **Step 5: Complete the payment callback**

Walk the CreditGuard payment to success using the test gateway. Then re-run the two queries from Step 4.

Expected: `status = 'Paid'`, and each row in `offline_hotels` that appears in `offline_hotel_ids` has `consumed_rooms` incremented by the count of occurrences in the array.

- [ ] **Step 6: Replay-safe check**

Hit the same `/api/payment/<id>/<txId>/<promoCode>` URL a second time. Re-run the `offline_hotels` query.

Expected: `consumed_rooms` is NOT incremented a second time.

- [ ] **Step 7: Failure path**

Walk a fresh booking where CreditGuard returns failure. Query the reservation.

Expected: `status = 'Pending'`, `offline_hotels.consumed_rooms` unchanged.

- [ ] **Step 8: Backoffice visual check**

Open the reservation detail page in the backoffice. Confirm the Hotel Information card now shows a Mega inventory rooms section listing both rooms (Triple + Double) with hotel name, room type, dates, and per-room price.

- [ ] **Step 9: Legacy reservation check**

Pick a pre-2026-04-19 reservation whose `offline_hotel_ids` is NULL but `offline_hotel_id` is set. Open its detail page.

Expected: the fallback kicks in — the single offline room is listed. No crash, no empty render.

- [ ] **Step 10: Final commit (only if any doc updates)**

If verification uncovered doc updates, commit them now. Otherwise this task is informational only.

---

## Self-Review Notes

- All three issues from the spec are covered by Tasks 1–6. Task 7 is the verification pass.
- No placeholders. Every code step shows the full block.
- `decrementOfflineInventory` keeps the same shape it had in `confirm-order`, so the known behavior is preserved exactly — only the call site changed.
- `OrderData` is touched once (Task 4 Step 3) with a conditional guard in case `status` is already present.
- `offline_hotel_id` is kept in sync with `offline_hotel_ids[0]` so all existing dashboards, badges, and filters continue to work without touching them.
