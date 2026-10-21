# Multi-event itinerary ("מסלולים") - design

**Date:** 2026-10-21 · **Owner:** Dor · **Branch:** `feat/multi-event-itinerary` (myt-main), backoffice on `master`
**Status:** design - direction approved on clickable mock v3 (see §3)

## 1. Intent

Customers already book one event as a package (ticket + flight + hotel). This feature lets them book **one trip
with 2-3 events in different cities** - e.g. Céline Dion in Paris on 12/05, Chelsea - Everton in London on
15/05, fly home from London. Music and football mix freely. The flight goes from Tel Aviv to the **first** event's
city and home from the **last** event's city; there is **a hotel in every city**.

It succeeds the `mondial` branch bundle, which proved the demand but stayed thin: open-jaw flight only, no hotels,
no travel between cities, no route suggestions, one reservation holding several events (its confirmation page and
emails show the first event only). We port its ideas, not its code.

Success = a customer can find or build a sensible 2-3 event trip, see one honest price, and order it; staff fully
control which routes the site recommends; **nothing in today's single-event flow changes for live customers.**

## 2. Goals, non-goals, anti-goals

Goals
- Three ways in: **recommended routes** (homepage row + route page), **edit a recommended route**, **build your
  own** from the whole catalog. The system blocks combinations that cannot work, and says why.
- One flow for the whole trip: tickets (per event) → flights (one search for all legs) → hotels (one per city) →
  summary → pay, in the site's own components and look.
- Staff control: recommended routes, their order on the homepage, and the global rules/discounts - from the
  backoffice, no code.

Non-goals (phase 1)
- US events (no hotel step there today), ticket-only events, `is_test` events.
- Offline (backoffice-inventory) flights and locked flights inside an itinerary - Amadeus only.
- Coupons and the partner/agent settlement flow on itinerary orders (attribution via `utm_source` still recorded).
- Trains/transfers sold by us. "I'll take the train" means the customer arranges it.
- More than 3 events.

Anti-goals (a failure even if it works)
- Any behavioural change to `/order/[eventId]`, `confirm-order`, `/api/payment`, the homepage rows that exist, or
  any API the backoffice calls. A live customer must not be able to tell the feature exists until we switch it on.
- A price on a route card that the flow does not honour.
- Burning the hotel supplier's shared limit (10 searches/minute for the whole account, see CLAUDE.md).

## 3. Customer experience

Mock v3 (throwaway, real catalog data, illustrative prices): `docs/superpowers/specs/2026-10-21-multi-event-itinerary/mock.html`.
The build uses the **real components**, not the mock's replicas: `EventArt`, the homepage event card, `EventDataHeader`
layout, `OrderContinueBar`, `TicketSelection` category cards + seat map, the `FlightCard` family, `HotelCard`.

### 3.1 Entry points
1. **Homepage row "מסלולים מומלצים"** - a new builtin homepage section. Route card = the homepage event card with
   a split art panel (one `EventArt` per event), a route pill ("פריז ← לונדון"), the events with dates, the
   "from" price per traveller, and a savings badge when real (§6.3). Last card: "בנו מסלול משלכם". Hidden
   unless the feature switch is on (§9).
2. **`/itinerary?events=618,702`** - a route opened from a card or a link (staff can share it).
3. **`/itinerary`** (no events) - build-your-own.
Phase 4 option (needs Dor's go - it touches the live order page): a quiet "רוצים לשלב עוד אירוע בטיול?" link on
`/order/[eventId]` that opens `/itinerary?events=<id>`.

### 3.2 The route step ("המסלול")
- Header: overlapping round `EventArt` avatars, title = the cities ("פריז ← לונדון"), dates + nights.
- **Recommended mode**: a timeline - flight TLV→city 1, stop cards, between stops either "same city, N days" or
  "A ← B · 343 km · move on 13/05", flight home. Each stop has ×. Below: "אפשר לשלב גם" - candidates in the
  date window, each labelled (§4) with a + button, plus a link "מעדיפים לבחור לבד מכל האירועים?".
- **Self-build mode**: a tray of three slots (1 ← 2 ← 3, third optional), the search pill ("לאן טסים? אמן, קבוצה
  או עיר..."), month chips, הכל / כדורגל / הופעות, and a grid of event cards. After the first pick every card
  carries its label (מומלץ / באותה עיר / מתאים / אפשרי - פער ארוך / לא מתאים + reason) and "+ הוספה למסלול"
  or a disabled "לא מתאים למסלול". Compatible cards sort first.
- **Day planner ("תכנון הימים")** once there are 2 events: one cell per day (event days marked 1/2/3), a coloured
  band per city showing its nights, and steppers for outbound date, each move day, and return date (§5).
- Continue bar: slots כרטיסים / טיסות / מלונות, "סה״כ לנוסע", CTA "בחר והמשך לכרטיסים". With fewer than 2
  events the CTA is disabled ("בחרו לפחות 2 אירועים") and a link offers the regular order of the one event.

### 3.3 Tickets
Tabs per event (avatar, name, date, ✓). Each tab is the existing ticket step for that event: same seat map, same
category cards ("כלול במחיר" / "+$32 תוספת לכל כרטיס"), same live pricing. **One quantity for all events** =
number of travellers (1-9, same cap as `MAX_TICKETS`); the stepper on a selected card changes it for the trip.
A size a supplier cannot sell for some event is blocked for the whole trip (same `nearestFeasibleQuantity` logic).

### 3.4 Flights
One card per offer, each listing **all legs** (airline pill, times, airports, duration, direct/stops, baggage column),
the existing badge ("הפחיתו $X- לנוסע ממחיר החבילה" / "+$X לנוסע") relative to the default offer, sort tabs
הטוב ביותר / הזול ביותר / ישראלי. On a between-cities leg: toggle **"אגיע ברכבת"** - the leg leaves the
search (re-search as open-jaw) and shows as "A ← B ברכבת · בכוחות עצמכם, לא כלול". When the hop is under 600 km a
callout suggests the train with an honest duration. No "לא צריך טיסה" in phase 1.

### 3.5 Hotels
City tabs ("מלון בפריז · 11/05–13/05 · 2 לילות", ✓ when chosen). Each tab is the existing hotel step for that stay
(search pill, sort tabs, `HotelCard`, "+$X לאורח"). CTA walks city by city ("בחר והמשך למלון בלונדון"), then to the
summary. A city's search runs **only when its tab opens** (§7.2).

### 3.6 Summary + pay
Events (category × qty), flight legs (train legs marked), hotels, the traveller form / terms exactly as today, a
price box (§6) with the itinerary discount line and, when real, "N חבילות נפרדות: $X לנוסע. במסלול אחד: $Y".
Buttons: "לתשלום מאובטח" and "שמרו לי ל-24 שעות" (the 24h hold, same meaning as today). The 15-minute hold
timer behaves like the regular summary.

## 4. Compatibility rules

Evaluated on the route **sorted by event date**; a candidate is checked against its neighbours after insertion.
All numbers live in `itinerary_settings` (§8.1); defaults below.

| Check | Default | Result |
|---|---|---|
| route already has 3 events | `max_events` 3 | blocked "המסלול מלא" |
| same calendar day as a route event | - | blocked "באותו יום כמו X" |
| whole trip span (first→last event) | `max_span_days` 21 | blocked |
| distance to a neighbour (event coordinates) | `max_km` 1000 | blocked "N ק״מ מ-X - רחוק מדי" |
| days to a neighbour | `max_gap_days` 10 | blocked |
| days to a neighbour | > `ok_gap_days` 5 | allowed, labelled "אפשרי - פער ארוך" |
| all neighbours in the same city | - | "באותה עיר - בלי טיסה נוספת" |
| ≤ `best_km` 600 and ≤ 3 days | - | "מומלץ - קרוב וזורם" |
| otherwise | - | "מתאים למסלול" |

- Eligible events: listed, on sale, full package (`package_mode`), not US, not `is_test`, date ≥ 3 days out
  (same window as `getEvents`). Another date of an event already in the route (same name) is hidden.
- Distance = haversine on the event's own coordinates (`event_location` when set, else `location`). `max_km` is
  global in phase 1; the settings shape allows a per-region override later (Dor: Europe ~1000, America wider).
- The same rules run on the server at confirm time (§7.4) - the client labels are UX, not the gate.
- Pure module: `lib/itinerary/rules.ts` (`compatibility(route, candidate, settings)`), vitest.

## 5. Trip dates

- `depart` default = first event date − 1; range [first − 3, first].
- `return` default = last event date + 1; range [last + 1, last + 3].
- An event's **stay point** = `lodgingLocation(e, defaultCity(e))` (`lib/events/lodging.ts`) - the place the regular
  flow books by default (`choice` / `choice_split` / `event_city_only` events included; no split stay inside an
  itinerary). Two events are in the **same city** when their stay points are within 30 km (venues in one city do not
  read as two cities).
- For each consecutive pair in **different cities**: `move_i` default = event A + 1; range [A + 1, B]. Same-city
  consecutive events share one stay and have no move.
- Stays: city 1 = depart → move_1, city k = move_{k-1} → move_k, last = move_last → return. Every stay ≥ 1 night by
  construction.
- Flight legs: TLV→flight-city(1) on depart; flight-city(A)→flight-city(B) on move_i when the flight cities
  (`location.city_iata`) differ - a Manchester match sold as "טיסה ללונדון" next to a London event has no leg;
  flight-city(last)→TLV on return.
- Landing-aware hotel dates (the `getDefaultDateRange` rule): check-in = the day the leg lands (evening before when it
  lands before 08:00, `trustedArrival`), check-out = the next leg's departure day. Pure module `lib/itinerary/dates.ts`, vitest.

## 6. Pricing (per traveller, USD; ILS only at display/charge via the existing exchange-rate service)

### 6.1 Formula
`price = Σ ticket_e(category, qty) + flight(offer) + Σ hotel_stay + Σ markup_e × (1 − tier(e))`
- `ticket_e`: the live price exactly as that event's ticket step computes it today (same suppliers, same fallback buffer).
- `flight`: the chosen multi-city/open-jaw offer, with the existing adjustments (low-cost +$45, stop/layover filters).
- `hotel_stay`: the chosen rate for that stay, per traveller as today.
- `markup_e`: `getTotalMarkup(event)` (composed or legacy 175). **Tiers:** the event with the **highest** markup pays it
  in full; the others get `tier_2_pct` (30%) and `tier_3_pct` (50%) off, larger markup first. *(Call #1 in §13:
  price independent of pick order, protects margin. Dor said "full on the first"; chronological-first is a one-line switch.)*
- Hotel-skip fees and skip-flight paths do not exist in an itinerary.

### 6.2 Card / "from" price
Before any live search (homepage card, route step): cheapest ticket category per event + an **estimated** flight +
base hotel price per stay + tiered markup. `est_flight` = the route's cached daily multi-city quote (§8.2), falling
back to `0.6 × Σ base_flight_price` when missing; hotels = each event's `base_hotel_price` scaled to the stay's nights.
The card says "מחיר ממוצע ... לנוסע" like today's cards; the flow shows the live price. One pure estimator module,
so the backoffice route editor shows the same number.

### 6.3 Savings line
`separate = Σ computePackagePrice(e)` (base prices, the same numbers today's cards show) vs the itinerary's
**estimate** (§6.2) - like for like. Shown only where both sides are estimates: the route card badge
"חוסכים $X מול N חבילות נפרדות" and the route step, and only when the saving ≥ $50. The flow and the summary never
compare a live price with an estimate; there the only discount shown is the exact "הנחת מסלול" line (the markup tiers).

### 6.4 Price floor
A separate `validateItineraryPriceFloor` in `lib/itinerary/` - per event: trusted cheapest ticket + that event's
**tier-discounted** mandatory markup, with the same 40% slack. It reuses the trusted-ticket helper but does **not**
change `validatePurchasePriceFloor` (shared with `confirm-order`, whose slack assumes a row carrying flight + hotel).

## 7. Technical design (myt-main)

### 7.1 Routes and modules (all new unless stated)
- `app/itinerary/page.tsx` + client component - one page, steps in client state, `noindex` while the switch is off.
  Catalog from `getCachedEvents()`; selection in the URL (`?events=`) + client state. **Never read cookies/headers
  in this page** (see the 2026-09-17 outage notes).
- `app/itinerary/ItineraryContext.tsx` - its own context (route, dates, pax, per-event ticket, flight, per-stay
  hotel, step). It does **not** reuse `OrderContext`; shared presentational components get props. Where a shared
  component reads `OrderContext` directly, wrap it or extract a props-only inner component without changing its
  output in the regular flow.
- `lib/itinerary/rules.ts`, `dates.ts`, `price.ts`, `recommend.ts` - pure, vitest in `lib/__tests__/itinerary*.test.ts`.
- `app/api/itinerary/flights/route.ts` - POST `{legs:[{from,to,date}], adults, nonStop?}` → Amadeus
  `flightOffersSearch.post` with `originDestinations[]` (pattern: `lib/flights/elal.ts` `classicSearchBody`,
  `app/api/flights/bag-pricing`). Returns `ItineraryFlight[]` (§7.3). Same filters/adjustments as `/api/flights/search`,
  extracted into shared helpers **without changing** that route's output (test on a recorded response).
- Hotels: the existing `POST /api/hotels` per stay, unchanged (`withinSupplierLimit`, sellable-rate filtering,
  non-refundable window). Called through `fetchHotels` directly, one stay at a time - not via `HotelFetchProvider`
  (it holds one result set).
- Tickets: move `loadLive` from `app/hooks/useReadyTicketLive.ts` to `lib/tickets/liveOffers.ts` (pure move, the hook
  imports it back, behaviour identical) and use it per event with `priceTicketsForQuantity` / `toOrderTicket`.
- `app/api/itinerary/confirm`, `app/api/itinerary/payment`, `app/api/itinerary/confirmation/[group]/[result]` (§7.4-7.5).

### 7.2 Supplier limits
- Hotel search only for the stay whose tab is open; results cached in context per (city, dates, rooms); a change of
  dates/party invalidates only the affected stays. No preload of all cities.
- Flight search: one call per change of (legs, dates, party, train toggles), debounced; 429/`busy` handled like the
  regular steps.

### 7.3 Types (`lib/app.types.ts`, mirror in backoffice `types/app.types.ts`)
- `ItineraryFlight` = existing `Flight` **plus** `legs: FlightSegment[]` (all legs in order) and
  `trainLegs: {from,to,date}[]`. `outbound` = first leg, `inbound` = last leg, so every existing reader of `Flight`
  (backoffice detail page, emails) keeps working.
- Reservation columns `itinerary_group uuid`, `itinerary_seq smallint`, `itinerary_of smallint` (§8.3).

### 7.4 Confirm
`POST /api/itinerary/confirm` with the whole trip. Server side, in order:
1. Re-validate the route with `rules.ts` + current settings; every event eligible (§4).
2. Per event: the same validators `confirm-order` uses (LiveTickets offer, own stock, ticket cost snapshot, price
   floor with tiered markup) - imported from `app/api/confirm-order/utils.ts`, not copied.
3. Per stay: `orderHotelSellable`.
4. Recompute the total server-side from the submitted pieces: tickets and markups are priced on the server; the flight
   offer and hotel rates are taken as submitted - **the same trust as `confirm-order` today** (the flight was
   re-priced through `/api/flights/pricing` before the summary, as in the regular flow; no extra supplier search at
   confirm). Reject when the client total differs from the server sum by more than $1 (rounding). There is no
   existing tolerance to reuse.
5. Insert **one `reservations` row per event** in **one bulk insert** (a single statement - the group is written
   whole or not at all). Its own insert helper, **fail closed**: if the group columns are missing the order fails
   (never `insertReservation`'s silent column stripping - an orphan row could not be paid as a group). Rows share
   `itinerary_group`:
   - `event_order_info`: that event's ticket in the normal single-event shape - every existing reader works.
   - `flight_order_info`: the full `ItineraryFlight` on **seq 1 only**; other rows `{}` (today's "no flight"
     convention) - the backoffice shows the group link (§8.3).
   - `hotel_order_info`: each stay on the **first** event of that city; others `{}`.
   - `final_purchase_price_ils` per row = its share (its ticket + its markup share + flight on seq 1 + its hotel);
     Σ rows = the charged total exactly (rounding remainder on seq 1).
   - `status`: `Pending` (pay now) or `24Save` (hold) on all rows.
6. One ops email for the group; the customer email lists every event (new template reusing the existing sections).

### 7.5 Payment
`POST /api/itinerary/payment {group}` charges Σ rows in **one** CreditGuard transaction; success/cancel URLs →
`/api/itinerary/confirmation/{group}/...` → a group variant `recordGroupPayment`: **one** gateway query, the payment
written to **every** row of the group in one update (idempotent, same rules as `validateAndRecordPayment`), **one**
combined customer email. `validateAndRecordPayment` itself is not changed. Then `/confirmation/itinerary/{group}`
lists all events. Gated by `payments_enabled`; while off, the summary offers only the 24h hold.

### 7.5.1 The 24h hold of an itinerary
- Until launch (phases 1-2) the switch is off in production, so holds exist only from internal testing on preview.
  An itinerary hold email has **no pay link** ("נציג יחזור אליכם") - sales converts it by phone.
- Protective guards (small, behaviour-preserving for single orders): `/api/find-order` and the hold-email builder
  skip rows that have an `itinerary_group`, so a grouped row can never be resumed into the single-event checkout.
- Launch (phase 3) adds `/itinerary?hold=<group>`: restores the held trip from its rows and pays it through §7.5.

### 7.6 Draft / refresh
Mirror the trip into `sessionStorage` (`myt:itinerary-draft`, versioned, 30 min), same rules as `lib/order/draft.ts`:
restored in an effect, never trusted for price.

## 8. Backoffice + CMS (myt-backoffice, `master`) - required, not optional

Dor: staff must **fully control** "מסלולים מומלצים" - what appears, in what order, built easily.

### 8.1 Settings - `itinerary_settings` (key/value jsonb, the `marketing_settings` pattern)
`enabled` (row + `/itinerary`), `payments_enabled`, `tier_2_pct` 30, `tier_3_pct` 50, `max_events` 3, `max_km` 1000,
`best_km` 600, `ok_gap_days` 5, `max_gap_days` 10, `max_span_days` 21, `max_auto_routes` 12. Screen: Templates →
מסלולים → הגדרות. Main reads it server-side with defaults, cached under a new tag `itinerary-settings` (carried
only by the homepage and `/itinerary`). The backoffice save calls a **new** main endpoint
`POST /api/itinerary/revalidate` (secret header, same secret as today) that drops that tag - "off" takes effect on
the next request. `/api/revalidate` and the `events` tag are not touched (dropping `events` re-renders the whole site).

### 8.2 Routes - `itineraries` table
`id, title (null → generated "פריז ← לונדון"), event_ids int[] (2-3, date order), status ('live'|'hidden'|'draft'),
source ('staff'|'auto'), sort int, score numeric, est_flight_usd numeric null, est_flight_at timestamptz null,
created_by, timestamps`.
- **Auto routes**: a daily backoffice cron runs the same scoring as `recommend.ts` over the eligible catalog (pairs
  and triples labelled "מומלץ"/"מתאים", best score first, no duplicate event sets, an event in at most 2 auto routes)
  and upserts `source='auto'` rows; staff hide or promote them. It refreshes `est_flight_usd` with one Amadeus
  multi-city quote per live route, under a daily cap.
- **Staff routes**: editor = pick 2-3 events with the same labels as the site, see the estimated price + savings
  line, set title, publish/hide/sort. A route whose event is sold out/removed is skipped on the site.
- The site shows: live staff routes (sort), then live auto routes (score), up to `max_auto_routes`.

### 8.3 Reservations
- Migration: `reservations.itinerary_group uuid null`, `itinerary_seq smallint null`, `itinerary_of smallint null`
  (+ index on group). Main adds them to `insertReservation`'s optional keys (survives a missing column).
- List: a small "מסלול 1/2" chip. Detail: an "מסלול" panel linking the sibling reservations, the trip total, and the
  full leg list from `flight_order_info.legs` (the existing outbound/inbound block keeps working).

### 8.4 Homepage board
New builtin section key `itineraries` in `HOMEPAGE_SECTION_KEYS` (main) and `types/homepage.types.ts` + `SECTION_META`
(backoffice). Pins = `homepage_items` kind `itinerary` (ref `itinerary:<id>`), merged by `lib/homepage/merge.ts` -
**the merge stays byte-identical in both repos**. What does change:
- migration: widen the `homepage_items.kind` CHECK constraint (today event/artist/team/review only);
- main: `HomepageItemKind` + `REF_RE` accept `itinerary:` refs (`lib/homepageLayout.ts`), `buildPools` gains an
  `itineraries` pool, and `rows.ts` `showFlags` marks itinerary refs showable (`defaultShowable` is false for a ref
  with no flags);
- the gate is in the **render**: a key missing from the table is appended visible by `getHomepageLayout`, so
  `ClientSideHomepage` renders the `itineraries` case only when `itinerary_settings.enabled`.
Deploy main first (unknown keys are dropped there), then the backoffice.

## 9. Isolation and rollout

- Everything new lives under `app/itinerary`, `app/api/itinerary/*`, `lib/itinerary/*`, plus additive types, the
  homepage section case, and the two behaviour-preserving extractions (`loadLive`, flight-offer helpers) - each with
  a test proving identical output before/after.
- One switch, in the DB: `itinerary_settings.enabled` (row + page; the page answers 404 when off), plus
  `payments_enabled`. On Vercel **preview** deployments and in local dev (`VERCEL_ENV !== 'production'`) the page
  and row are always on - that is how staff preview. No preview token, so `/itinerary` never reads
  `searchParams`/cookies on the server and stays cached (the 2026-09-17 lesson); `?events=` is read on the client.
- Migrations are additive (new tables, nullable columns) and run on backoffice `master` push - the only shared
  production change before launch, harmless to the live site.
- Test on the Vercel **preview** of `feat/multi-event-itinerary` (pushed when Dor says push). Preview uses production
  data and suppliers: holds only (`payments_enabled` off) until Dor approves one real payment.
- Into `main` only through a PR Dor approves (no `git merge`, per the global rules).

## 10. Cross-project impact
- Types: `ItineraryFlight`, new reservation columns → `/sync-types`.
- Tables: `itinerary_settings`, `itineraries` (backoffice writes, main reads); `reservations` new columns (main
  writes, backoffice reads); `homepage_items` new kind.
- New main routes the backoffice calls: `GET /api/itinerary/quote?events=` (estimator for the editor) and
  `POST /api/itinerary/revalidate` (settings save), both behind the existing `x-hotel-secret`.
- Migrations: `itinerary_settings`, `itineraries`, reservation columns, wider `homepage_items.kind` CHECK.
- `lib/homepage/merge.ts` stays identical in both repos.
- Small guards in live code: `/api/find-order` + hold email skip grouped rows (§7.5.1); the `loadLive` move and the
  flight-helper extraction are behaviour-preserving with tests.

## 11. Phases
1. **Core** - main: rules/dates/price modules + tests, `/itinerary` self-build + route page, tickets/flights/hotels
   steps, summary, confirm with 24h hold, settings read with defaults. Backoffice: migrations, settings screen,
   reservation group panel.
2. **Recommended routes** - `itineraries` table, editor, auto cron, homepage section + board.
3. **Payment** - group payment, confirmation page, emails; one real paid order by Dor; switch on.
4. **Later** - entry link from `/order/[eventId]`, per-region `max_km`, coupons/partners on itineraries, US events.

## 12. Tests
- vitest: rules (every row of §4, same city, inserted in the middle), dates (ranges, stays, legs, Manchester→London,
  early landing), price (tiers, savings threshold, floor), recommend (dedupe, caps).
- Unchanged-output tests: `/api/flights/search` after the helper extraction; `useReadyTicketLive` after the move.
- E2E on preview (Playwright): build a 2-event route → tickets → flights with the train toggle → two hotels → 24h
  hold; assert two reservations with one group, Σ prices = total, flight on seq 1 only.
- Regression: a regular `/order/[id]` path to the summary on preview, before and after.

## 13. Calls made in this doc (Dor to confirm)
1. The highest-markup event pays full markup; discounts go to the others (Dor said "first").
2. Card price = estimate (cached daily multi-city quote + base hotel prices), not a live search per card.
3. Phase 1 excludes coupons, agent settlement, offline/locked flights, US and ticket-only events.
4. One reservation per event; the flight on the first reservation, each hotel on the first event in its city.
5. The feature switch lives in the DB (`itinerary_settings.enabled`), not in env; always on in preview/dev.
6. The savings line only on cards/route step (estimate vs estimate), only when ≥ $50; never in the summary.
7. Before launch an itinerary hold is converted by sales (no pay link); `find-order` and the hold email skip grouped rows.
8. Confirm trusts the submitted flight offer and hotel rates like `confirm-order` does today; no re-search at confirm.
9. Same city = stay points within 30 km; the stay uses the event's default lodging city, no split stay inside a trip.

## 13.1 Open - Dor's answer needed
**Affiliates on an itinerary.** The backoffice pays commission per reservation; a `fixed_per_ticket` affiliate would
earn N× on an N-event trip, while events 2-3 carry a discounted markup. Commission per trip or per event? And does an
affiliate's `user_discount` apply to itinerary orders (phase 1 has no coupons)?

## 14. Left to the builder
Component composition and file split inside `app/itinerary`; copy beyond the strings above; debounce values; the
scoring weights in `recommend.ts` (prefer short gaps, short distance, music+football mix, fewer moves); Amadeus
request tuning (max offers, sources); visual details, as long as they use the site's components.
