# Euro Trip - Phase 1 (core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can open `/euro-trip`, pick or build a 2-3 event trip, choose tickets, one multi-city flight and a hotel per city, and save it as a 24h hold - with the live site unchanged.

**Architecture:** Pure rules/dates/price/recommend modules in `lib/itinerary/` (vitest). Pages under `app/euro-trip/` with their own `ItineraryProvider`. The existing ticket and hotel steps are reused **unchanged** by rendering them inside a per-event / per-stay `OrderContext.Provider` adapter. A new multi-city flight API and a new group confirm API write one `reservations` row per event in one bulk insert. Backoffice (master) adds the settings table, reservation group columns, a settings screen and a group panel.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (service client `lib/supabase.ts`), Amadeus (`app/api/flights/amadeusClient.ts`), RateHawk via `POST /api/hotels`, vitest 4, Tailwind + Mantine + shadcn.

**Spec:** `docs/superpowers/specs/2026-10-21-multi-event-itinerary-design.md` (read it first; § numbers below refer to it). Mock: `docs/superpowers/specs/2026-10-21-multi-event-itinerary/mock.html`.

## Global Constraints

- Work in `C:/Users/doraz/OneDrive/Desktop/Work/MegaEvent/MYT_Git_Shered/myt-main-itinerary` on branch `feat/multi-event-itinerary` (Part A). Part B in `.../MYT_Git_Shered/myt-backoffice` on `master`. Commit freely; **never push** without Dor; **never `git merge`**; no AI co-author line in commits.
- **Do not change behaviour of live code.** Files you may NOT edit: everything under `app/order/`, `app/api/confirm-order/` (except Task A16's lines), `app/api/payment/`, `app/api/flights/search/`, `app/api/hotels/`, `app/api/revalidate/`, `app/hooks/`, `components/ui/FlightCard.tsx`, `components/ui/hotelCard.tsx`, `components/ui/EventTicketCard.tsx`, `lib/homepage/merge.ts`. The only live-file edit in this plan is Task A16.
- Customer-facing name: **"Build Your Euro Trip"**; Hebrew copy "בנו את היורו טריפ שלכם". Code name: `itinerary`.
- Settings defaults (verbatim, spec §8.1): `enabled` false, `payments_enabled` false, `tier_2_pct` 30, `tier_3_pct` 50, `max_events` 3, `max_km` 1000, `best_km` 600, `ok_gap_days` 5, `max_gap_days` 10, `max_span_days` 21, `max_auto_routes` 12.
- Same city = stay points within **30 km**. Savings line only when ≥ **$50**. Max travellers **9**.
- Switch: pages on when `settings.enabled || process.env.VERCEL_ENV !== "production"`. Pages never read `searchParams`, `cookies()` or `headers()` on the server; `?events=` is read on the client.
- Eligible events (spec §4): from `getCachedEvents()` (already listed-only), not `isTicketOnlyEvent`, not `isEventSoldOut`, `location.country_code !== "US"`, date ≥ today + `AVAILABILITY_WINDOW_DAYS` (3).
- Dates are `YYYY-MM-DD` strings; take `event.date.slice(0, 10)`. Day math in UTC.
- Hotel searches only through the reused `HotelSelection`, for the stay whose tab is open (supplier limit: 10/min account-wide).
- Tests: `npx vitest run <file>`; vitest only picks up `lib/**/*.test.ts`, header `import { describe, expect, it } from "vitest";`, fixtures cast `as unknown as Event`. Type gate: `npx tsc --noEmit` (the build ignores TS errors). Build: `yarn build` (OneDrive `.next` flake: delete `.next`, retry once; never run dev and build together).
- Copy is Hebrew, RTL, logical properties (no hardcoded left/right). `next/image`, Mantine/shadcn/Tailwind - no new UI libs.

## Review Focus

1. **A route whose event sold out or left the catalog between the card and the click** → the builder drops it with a notice ("האירוע כבר לא זמין") and re-evaluates the route. Test: Task A10 (`reconcileRoute`).
2. **Manchester match sold as "טיסה ללונדון" next to a London concert** → two stays (262 km > 30) but no flight leg (same `city_iata`). Test: Task A4.
3. **Party size changed on the tickets step after flight/hotels were chosen** → flight and every hotel cleared; the price never mixes sizes. Test: Task A11 (adapter clears) + Task A14 (`canContinue`, `livePerTraveller`).
4. **Move day / return / depart pushed past their bounds** → clamped; every stay keeps ≥ 1 night. Test: Task A4 (`clampTripDates`).
5. **Confirm sent twice (double click, retry)** → one group; the second call returns the first group (the client-made `group` uuid is the idempotency key + the unique index of Task 18). Test: Task 15.

---

## Part A - myt-main (branch `feat/multi-event-itinerary`)

### Task 1 (A1): Types and settings (pure)

**Files:**
- Create: `lib/itinerary/types.ts`, `lib/itinerary/settings.ts`
- Modify: `lib/app.types.ts` (append `ItineraryFlight`; additive)
- Test: `lib/__tests__/itinerarySettings.test.ts`

**Interfaces:**
- Produces:
  - `type ItinerarySettings = { enabled: boolean; paymentsEnabled: boolean; tier2Pct: number; tier3Pct: number; maxEvents: number; maxKm: number; bestKm: number; okGapDays: number; maxGapDays: number; maxSpanDays: number; maxAutoRoutes: number }`
  - `const DEFAULT_ITINERARY_SETTINGS: ItinerarySettings`
  - `parseItinerarySettings(rows: { key: string; value: unknown }[] | null | undefined): ItinerarySettings` - DB keys snake_case (`payments_enabled`, `tier_2_pct`, `max_auto_routes`, ...); unknown keys ignored; wrong type or out of range → default (pcts 0-90, maxEvents 2-3, km 50-5000, days 1-30, maxAutoRoutes 0-48).
  - `itineraryOn(s: ItinerarySettings, vercelEnv: string | undefined): boolean` = `s.enabled || vercelEnv !== "production"`.
  - `types.ts`: `CompatStatus = "best" | "same" | "ok" | "warn" | "blocked"`; `CompatReason = {code:"first"} | {code:"full"} | {code:"same_day";with:string} | {code:"span";days:number} | {code:"too_far";km:number;from:string} | {code:"gap_too_long";days:number;from:string} | {code:"long_gap";days:number} | {code:"same_city"} | {code:"best"} | {code:"fits"}`; `Compat = { status: CompatStatus; reason: CompatReason; km?: number; nearCity?: string }`; `TripDates = { depart: string; ret: string; moves: Record<string, string> }` (move key `` `${a.id}>${b.id}` ``); `Stay = { key: string; point: LodgingPoint; city: LodgingCity; events: Event[]; from: string; to: string }`; `TripLeg = { kind: "out" | "mid" | "ret"; from: string; to: string; date: string; key?: string; km?: number }` (IATA, `"TLV"` at the ends); `TrainLeg = { key: string; fromName: string; toName: string; date: string; km: number }`.
  - `lib/app.types.ts`: `export type ItineraryFlight = Flight & { legs: FlightSegment[]; trainLegs: { from: string; to: string; date: string }[] };`

- [ ] **Step 1: Failing tests** - `parseItinerarySettings(null)` deep-equals defaults; `[{key:"tier_2_pct",value:25},{key:"enabled",value:true}]` → `tier2Pct 25`, `enabled true`; `max_km` `"x"` or `99999` → 1000; unknown key ignored; `itineraryOn(defaults,"production")` false; `itineraryOn(defaults,"preview")` true; `itineraryOn(defaults,undefined)` true; `itineraryOn({...defaults,enabled:true},"production")` true.
- [ ] **Step 2:** `npx vitest run lib/__tests__/itinerarySettings.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS; `npx tsc --noEmit` → no new errors.
- [ ] **Step 5: Commit** `feat(itinerary): settings + shared types`

### Task 2 (A2): Geography and eligibility

**Files:** Create `lib/itinerary/geo.ts`, `lib/itinerary/eligibility.ts`; Test `lib/__tests__/itineraryGeo.test.ts`

**Interfaces:**
- Consumes: `lodgingLocation`, `defaultCity` (`lib/events/lodging.ts:60,111`), `isTicketOnlyEvent`, `isEventSoldOut` (`lib/events/price.ts:67,213`), `AVAILABILITY_WINDOW_DAYS` (`lib/eventsData.ts:152`).
- Produces:
  - `haversineKm(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}): number` (rounded integer, R 6371).
  - `eventPoint(e: Event)` = `e.event_location ?? e.location`.
  - `stayPoint(e: Event): { point: LodgingPoint; city: LodgingCity }` = `lodgingLocation(e, defaultCity(e))` and that city.
  - `sameCity(a: Event, b: Event): boolean` = `haversineKm(stayPoint(a).point, stayPoint(b).point) <= 30`.
  - `eventDay(e: Event): string` = `e.date.slice(0, 10)`; `dayDiff(a: string, b: string): number` (b − a, whole days, UTC).
  - `eventKind(e: Event): "music" | "football"` - music when `e.type` contains `"music"`.
  - `isItineraryEligible(e: Event, todayIso: string): boolean` (Global Constraints list).

- [ ] **Step 1: Failing tests** - Paris (48.86, 2.35) → London (51.50, −0.13) = 343 ± 2; Paris → Madrid (40.42, −3.70) > 1000; `sameCity` true for two London points 5 km apart, false London ↔ Manchester; `eventPoint` prefers `event_location`; `isItineraryEligible` false for `package_mode: "ticket_only"`, for `country_code: "US"`, for no available tickets, for date = today + 2; true for a package event today + 30.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(itinerary): geo + eligibility`

### Task 3 (A3): Compatibility rules

**Files:** Create `lib/itinerary/rules.ts`; Test `lib/__tests__/itineraryRules.test.ts`

**Interfaces:**
- Consumes: A1, A2 (`haversineKm`, `eventPoint`, `sameCity`, `eventDay`, `dayDiff`).
- Produces:
  - `sortRoute(route: Event[]): Event[]` (by `eventDay`, then id).
  - `compatibility(route: Event[], candidate: Event, s: ItinerarySettings): Compat` - checks **in this order**: route length ≥ `maxEvents` → blocked `full`; empty route → ok `first`; same day as any route event → blocked `same_day` (`with` = that event's name); span of route + candidate > `maxSpanDays` → blocked `span`; against each neighbour after inserting by date: km on `eventPoint` (0 when `sameCity`) > `maxKm` → blocked `too_far` (`from` = neighbour's city name); days > `maxGapDays` → blocked `gap_too_long`; then max gap > `okGapDays` → warn `long_gap`; all neighbours `sameCity` → same `same_city`; farthest km ≤ `bestKm` and max gap ≤ 3 → best `best`; else ok `fits`. `km` / `nearCity` = the farthest neighbour.
  - `describeCompat(c: Compat): string` - first "אפשר להתחיל מכאן"; full "המסלול מלא - עד 3 אירועים"; same_day "באותו יום כמו {with}"; span "טיול של {days} ימים - ארוך מדי"; too_far "{km.toLocaleString()} ק״מ מ{from} - רחוק מדי"; gap_too_long "{days} ימים מ{from} - פער ארוך מדי"; long_gap "אפשרי - {days} ימים בין האירועים"; same_city "באותה עיר - בלי טיסה נוספת"; best "מומלץ - קרוב וזורם"; fits "מתאים למסלול".
  - `isAddable(c: Compat): boolean` = status !== "blocked".

- [ ] **Step 1: Failing tests** (fixtures: Céline Paris 2027-05-12, Chelsea London 2027-05-15, Gracie Amsterdam 2027-05-10, Real-Barça Madrid 2027-05-09, Arsenal London 2027-05-15, Inter-Lazio Milan 2027-05-23, Berlin 2027-05-13) - Gracie vs [Céline, Chelsea] → best; Arsenal → blocked same_day, `with` "צ'לסי - אברטון"; Madrid → blocked too_far with km > 1000; Inter-Lazio → warn long_gap 8; London 2027-05-17 vs [Chelsea] → same; any event vs a 3-event route → blocked full; 2027-06-10 vs [Céline] → blocked; Berlin between Paris and London → ok (checked against both neighbours); every `describeCompat` string exactly as above.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(itinerary): compatibility rules`

### Task 4 (A4): Trip dates, stays, legs

**Files:** Create `lib/itinerary/dates.ts`; Test `lib/__tests__/itineraryDates.test.ts`

**Interfaces:**
- Consumes: A2, A3 `sortRoute`.
- Produces:
  - `addDays(day: string, n: number): string`.
  - `moves(route: Event[]): { key: string; a: Event; b: Event }[]` - consecutive sorted pairs that are **not** `sameCity`.
  - `defaultTripDates(route: Event[]): TripDates` - depart = first − 1, ret = last + 1, each move = a + 1.
  - `tripDateBounds(route: Event[], d: TripDates): { depart: [string, string]; ret: [string, string]; moves: Record<string, [string, string]> }` - depart [first − 3, first], ret [last + 1, last + 3], move [a + 1, b].
  - `clampTripDates(route: Event[], d: TripDates): TripDates` - clamps each field; drops stale move keys; adds missing ones at default.
  - `stays(route: Event[], d: TripDates): Stay[]` - consecutive same-city events share a stay; `key` = first event id of the stay as a string.
  - `tripLegs(route: Event[], d: TripDates, train: ReadonlySet<string>): TripLeg[]` - out (TLV → first `location.city_iata`, depart); a mid leg per move **when the two `location.city_iata` differ and the key is not in `train`** (date = move day, km = `haversineKm` of `eventPoint`s); ret (last `city_iata` → TLV, ret).
  - `trainLegs(route: Event[], d: TripDates, train: ReadonlySet<string>): TrainLeg[]` (names from `stayPoint(...).point.name`).

- [ ] **Step 1: Failing tests** - [Céline, Chelsea]: `{depart:"2027-05-11", ret:"2027-05-16", moves:{"618>702":"2027-05-13"}}`; stays Paris 11→13, London 13→16; legs TLV→(Céline city_iata) 11/05, →(Chelsea city_iata) 13/05 km ≈ 343, →TLV 16/05; with train `{"618>702"}` → 2 legs + 1 train leg; [Chelsea 15/05, London event 17/05] → 1 stay, no mid leg; Manchester match (`location.city_iata` "LON", `event_location` Manchester, `lodging_mode: "event_city_only"`) + London event → 2 stays, **no mid leg**; the same match with the default `flight_city` lodging + London event → 1 stay; `clampTripDates` pulls depart "2027-05-13" → "2027-05-12", move "2027-05-20" → "2027-05-15", ret "2027-05-14" → "2027-05-16"; in every test each stay has `from < to`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(itinerary): trip dates, stays and legs`

### Task 5 (A5): Pricing

**Files:** Create `lib/itinerary/price.ts`; Test `lib/__tests__/itineraryPrice.test.ts`

**Interfaces:**
- Consumes: `getTotalMarkup` (`lib/events/price.ts:101`), `computePackagePrice` (`:134`), `cheapestAvailableTicketPrice` (`:182`); A1; A4 `stays`; A2 `dayDiff`.
- Produces:
  - `tierMarkups(route: Event[], s: ItinerarySettings): Map<number, number>` - USD per traveller: sort by `getTotalMarkup` desc (tie: earlier date first); index 0 full, 1 × (1 − tier2Pct/100), 2 × (1 − tier3Pct/100); cents.
  - `markupDiscount(route: Event[], s: ItinerarySettings): number` = Σ full − Σ tiered.
  - `estimateItinerary(route: Event[], d: TripDates, s: ItinerarySettings, estFlightUsd: number | null): { perTraveller: number; separate: number; saving: number | null }` - tickets = `cheapestAvailableTicketPrice(e.tickets_and_rates)`; flight = `estFlightUsd ?? 0.6 × Σ base_flight_price`; hotel per stay = (`base_hotel_price` of the stay's first event ÷ max(1, nights of its `def_date_depart` → `def_date_return`)) × stay nights; markups tiered; `separate` = Σ `computePackagePrice(e) ?? 0`; `saving` = separate − perTraveller when ≥ 50 else null; whole dollars.

- [ ] **Step 1: Failing tests** - markups 175/175 → [175, 122.5]; 175/250/175 → 250 full, then 122.5, 87.5; `markupDiscount` 52.5 for the pair; `estimateItinerary` on fixtures with set base prices = the hand-computed value; saving null when the difference is 49; `estFlightUsd` overrides the fallback.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(itinerary): tiered markup and estimates`

### Task 6 (A6): Auto recommendations

**Files:** Create `lib/itinerary/recommend.ts`; Test `lib/__tests__/itineraryRecommend.test.ts`

**Interfaces:**
- Consumes: A2 `isItineraryEligible`, `eventKind`; A3 `compatibility`, `sortRoute`; A2 `dayDiff`, `haversineKm`, `eventPoint`.
- Produces: `type RecommendedRoute = { ids: number[]; score: number }`; `recommendRoutes(events: Event[], s: ItinerarySettings, todayIso: string, limit = s.maxAutoRoutes): RecommendedRoute[]` - eligible only; pairs (a before b) whose `compatibility([a], b, s).status` ∈ {best, same, ok}; triples = a pair + a third with status ∈ {best, same, ok} against the pair; never two events with the same `name`; score (lower better) = Σ day gaps + Σ km / 200 − (2 when both kinds present) − (1 for 3 events); sort by score then first date; skip a duplicate event set; an event in at most 2 routes **of the same size** (pairs and triples counted separately - otherwise every triple loses to its own cheaper pairs); return ≤ `limit`.

- [ ] **Step 1: Failing tests** - on A3's fixtures: the Gracie → Céline → Chelsea triple present; no route has Madrid with Paris; no route has two "גרייסי אברמס"; no id in more than 2 pairs nor in more than 2 triples; with only [Gracie, Céline, Chelsea] as input the triple is returned; length ≤ limit; same input → same order.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(itinerary): auto route recommendations`

### Task 7 (A7): Settings server read + revalidate endpoint

**Files:** Create `lib/itinerary/settings.server.ts`, `app/api/itinerary/revalidate/route.ts`

**Interfaces:**
- Produces:
  - `ITINERARY_SETTINGS_TAG = "itinerary-settings"`
  - `getItinerarySettings(): Promise<ItinerarySettings>` - `unstable_cache`, key `["itinerary-settings"]`, tags `[ITINERARY_SETTINGS_TAG]`, revalidate 3600; `supabase.from("itinerary_settings").select("key, value")`; **any** error (incl. a missing table) → `console.warn` + `DEFAULT_ITINERARY_SETTINGS`; never throws.
  - `POST /api/itinerary/revalidate` - 401 unless header `x-hotel-secret` === `process.env.NEXT_SECRET_REVALIDATION_SECRET` (same check as `app/api/homepage-pools/route.ts:31-33`); then `revalidateTag(ITINERARY_SETTINGS_TAG)`, `revalidatePath("/euro-trip")`, `revalidatePath("/euro-trip/build")`; `{ ok: true }`; try/catch → 500.

- [ ] **Step 1:** implement (server only; the parser is covered by A1).
- [ ] **Step 2: Verify** with one `yarn dev` in the worktree: `curl -s -X POST localhost:3000/api/itinerary/revalidate` → 401; with the header → `{"ok":true}`.
- [ ] **Step 3: Commit** `feat(itinerary): settings read + revalidate endpoint`

### Task 8 (A8): Multi-city flight API

**Files:** Create `lib/itinerary/flightOffers.ts`, `app/api/itinerary/flights/route.ts`, fixture `lib/__tests__/fixtures/amadeus-multicity-offer.json` (hand-made 3-itinerary offer in the Amadeus shape); Test `lib/__tests__/itineraryFlightOffers.test.ts`

**Interfaces:**
- Consumes: `amadeus.shopping.flightOffersSearch.post(body, clientRef)` (`app/api/flights/amadeusClient.ts:203`); body pattern of `classicSearchBody` (`lib/flights/elal.ts:106`); A1.
- Produces:
  - `multiCityBody(legs: { from: string; to: string; date: string }[], adults: number, nonStop: boolean): Record<string, unknown>` = `{ currencyCode: "USD", originDestinations: legs.map((l, i) => ({ id: String(i + 1), originLocationCode: l.from, destinationLocationCode: l.to, departureDateTimeRange: { date: l.date } })), travelers: [1..adults].map(id => ({ id: String(id), travelerType: "ADULT" })), sources: ["GDS"], searchCriteria: { maxFlightOffers: 250, ...(nonStop ? { flightFilters: { connectionRestriction: { maxNumberOfConnections: 0 } } } : {}) } }`.
  - `offerToItineraryFlight(offer: AmadeusOffer, id: string, adults: number, carriers?: Record<string, string>): ItineraryFlight | null` - **mirrors `app/api/flights/search/route.ts:422-646` without importing or editing it** (copy `MAX_STOPS = 1`, `MAX_STOP_DURATION_HOURS = 4` with a comment pointing there): null when any itinerary has > 1 stop, any layover > 4 h, or the bag policy differs between itineraries; segments → `FlightSegment` as at `:522-546`; `legs` = one segment per itinerary; `outbound` = legs[0], `inbound` = legs[last]; `price` = `parseFloat(price.grandTotal)` + `45 × adults` when any itinerary has carrier HR operated by BZ or any of 6H / IZ / U8 (`:587-608`); `operatedBy` as `:610-638`; `trainLegs: []`.
  - `POST /api/itinerary/flights` body `{ legs: { from; to; date }[]; adults: number; nonStop?: boolean }` → 400 unless 2 ≤ legs ≤ 4, 1 ≤ adults ≤ 9, codes `/^[A-Z]{3}$/`, dates `YYYY-MM-DD` ≥ tomorrow and non-decreasing; `export const maxDuration = 30`; clientRef `MYT-IT-{Date.now()}`; `{ flights: ItineraryFlight[] }` sorted by price; Amadeus failure → 502 `{ error }`; try/catch → 500.

- [ ] **Step 1: Failing tests** - `multiCityBody` exact object for 3 legs / 2 adults / nonStop false and the nonStop filter when true; `offerToItineraryFlight(fixture)` → 3 legs, outbound = legs[0], inbound = legs[2], price = grandTotal; fixture variant with a 2-stop itinerary → null; a 5 h layover → null; carrier "U8" on one itinerary → price + 45 × adults.
- [ ] **Step 2:** FAIL. **Step 3:** implement both files. **Step 4:** PASS.
- [ ] **Step 5: Verify** on `yarn dev`: POST TLV→PAR 2027-05-11, PAR→LON 2027-05-13, LON→TLV 2027-05-16, adults 2 → 200, `flights.length > 0`, every `legs.length === 3` (one Amadeus call).
- [ ] **Step 6: Commit** `feat(itinerary): multi-city flight search`

### Task 9 (A9): Hub page `/euro-trip` + route card

**Files:** Create `lib/itinerary/routeCard.ts`, `app/euro-trip/page.tsx`, `components/euro-trip/RouteCard.tsx`, `components/euro-trip/EuroTripHub.tsx`; Test `lib/__tests__/itineraryRouteCard.test.ts`

**Interfaces:**
- Consumes: `getCachedEvents()`, A7 `getItinerarySettings`, A1 `itineraryOn`, A6 `recommendRoutes`, A5 `estimateItinerary`, A4 `defaultTripDates`, `stays`; `EventArt` (`components/ui/EventArt.tsx:31`), `PackageIcons` (`components/ui/PackageIcons.tsx:24`), `lib/viewState.ts`, `app/hooks/useSessionState.ts`.
- Produces:
  - `type RouteCardData = { ids: number[]; title: string; events: { id: number; name: string; day: string; cityName: string; art: { imageUrl: string | null; awayImageUrl: string | null; variant: "blob" | "photo"; colorIndex?: number; shapeIndex?: number; imageScale?: number | null; bgScale?: number | null; imageOffsetX?: number | null; imageOffsetY?: number | null } }[]; cities: string[]; nights: number; stays: number; perTraveller: number; saving: number | null; kinds: ("music" | "football")[]; firstDay: string }`
  - `toRouteCard(route: Event[], s: ItinerarySettings): RouteCardData` - art fields exactly as the homepage card (`components/ClientSideHomepage.tsx:1910-1932`): `imageUrl = match_away_logo_url ? match_home_logo_url : art_image_url || card_image_url`, `awayImageUrl = match_away_logo_url`, `variant = art_image_url ? "blob" : "photo"`; title = distinct stay city names joined " ← " (`cityName(e, defaultCity(e))`).
  - `<RouteCard data />` - the homepage card shell (classes of `ClientSideHomepage.tsx:1907-1991`): split art (one `EventArt` per event, `h-40 sm:h-44`, 2px separators), route pill "✈ {title}", `h3` = names joined " + ", dates line (`DD/MM city • …`), badge "חוסכים ${saving} מול {n} חבילות נפרדות" when `saving`, price block "מחיר ממוצע / ${perTraveller} / לנוסע · {n} כרטיסים, {stays>1 ? stays+' מלונות' : 'מלון'} וטיסות", `PackageIcons cycle`, CTA strip "לפרטים והזמנה"; `<Link href="/euro-trip/build?events=…">`.
  - `app/euro-trip/page.tsx`: `export const revalidate = 3600`; `notFound()` when `!itineraryOn(settings, process.env.VERCEL_ENV)`; metadata title "Build Your Euro Trip | מגה איבנטס", `robots: { index: false, follow: false }` unless `settings.enabled`; hero (h1 "Build Your Euro Trip", line "2-3 אירועים בטיול אחד · טיסה לעיר הראשונה וחזרה מהאחרונה · מלון בכל עיר", CTA "בנו טריפ משלכם" → `/euro-trip/build`), `<EuroTripHub cards />`, a 3-step "איך זה עובד" strip.
  - `<EuroTripHub cards>` (client): search (names/cities), month chips, הכל / הופעות / כדורגל / מיקס, sort (מומלץ / מחיר / תאריך), "הצג עוד" (12 a page), last tile "בנו טריפ משלכם"; view saved under `viewStateKey("/euro-trip", "hub")`; first render = defaults, stored view applied after mount.

- [ ] **Step 1: Failing tests** - `toRouteCard([Céline, Chelsea], defaults)`: title "פריז ← לונדון", nights 5, stays 2, a match event gets `awayImageUrl`, saving null when below 50.
- [ ] **Step 2:** FAIL → implement `routeCard.ts` → PASS.
- [ ] **Step 3:** implement `RouteCard`, `EuroTripHub`, `page.tsx`.
- [ ] **Step 4: Verify** (dev, browser pane, desktop + 375px): `/euro-trip` shows cards with the real art of the current catalog; filters/sort/"הצג עוד" work and survive a refresh; no console errors.
- [ ] **Step 5: Commit** `feat(euro-trip): hub page and route cards`

### Task 10 (A10): Builder shell, provider, route step, self-build, day planner

**Files:** Create `lib/itinerary/url.ts`, `app/euro-trip/build/page.tsx`, `components/euro-trip/build/ItineraryProvider.tsx`, `TripHeader.tsx`, `RouteStep.tsx`, `SelfBuild.tsx`, `DayPlanner.tsx`, `ItineraryFlow.tsx`; Test `lib/__tests__/itineraryUrl.test.ts`

**Interfaces:**
- Consumes: A2-A5, A7, `getCachedEvents`, `EventArt`, `OrderContinueBar` (`app/order/OrderContinueBar.tsx:76`, props `slots/total/primaryLabel/primaryDisabled/onPrimary/skip?/isFinalStep`, `ContinueSlot` `:16`).
- Produces:
  - `parseEventsParam(raw: string | null, max = 3): number[]` (positive ints, dedupe, keep order, cap); `reconcileRoute(ids: number[], catalog: Map<number, Event>): { route: Event[]; dropped: number[] }`.
  - `page.tsx` (server, `revalidate = 3600`, `notFound()` when off): eligible `catalog: Event[]` + `settings` → `<ItineraryProvider catalog settings><Suspense><ItineraryFlow /></Suspense></ItineraryProvider>`.
  - `ItineraryProvider` - one `useReducer`, state `{ step: "build" | "tickets" | "flights" | "hotels" | "summary"; mode: "route" | "custom"; route: Event[]; dates: TripDates; pax: number (2); tickets: Record<number, OrderTicket | undefined>; train: string[]; flight: ItineraryFlight | null; hotels: Record<string, OrderHotel | undefined>; activeEvent: number; activeStay: number }`; actions (exact signatures) `addEvent(e: Event)`, `removeEvent(id: number)`, `setMode(m: "route" | "custom")`, `setDates(d: TripDates)`, `setPax(n: number)`, `setTicket(eventId: number, t: OrderTicket | undefined)`, `setEventData(e: Event)`, `toggleTrain(key: string)`, `setFlight(f: ItineraryFlight | null)`, `setHotel(stayKey: string, h: OrderHotel | undefined)`, `goStep(step)`, `setActiveEvent(i: number)`, `setActiveStay(i: number)`. Reducer invariants: any route / dates / pax / train change runs `clampTripDates` and clears `flight` + `hotels`; route change drops tickets of removed events. Hook `useItinerary()`.
  - On mount: read `?events=` from `window.location.search` → `parseEventsParam` → `reconcileRoute` → mode "route" when ids else "custom"; dropped → notification "האירוע כבר לא זמין"; route changes → `history.replaceState` `?events=`.
  - `RouteStep` (mode route): timeline (flight TLV → city, stop cards with `EventArt` 76px, name, `DD/MM/YY · {weekday}`, city, ×; connectors "נשארים ב{city} · N ימים" / "{A} ← {B} · N ק״מ · מעבר DD/MM"; flight home); link "מעדיפים לבחור לבד מכל האירועים?" → custom; "אפשר לשלב גם": eligible events within ±`maxGapDays` of the route, other dates of a route event's name hidden, `describeCompat` chip, "+ הוספה" / disabled "לא מתאים".
  - `SelfBuild` (mode custom): 3-slot tray ("אירוע ראשון / אירוע שני / אירוע שלישי (לא חובה)", ×), search "לאן טסים? אמן, קבוצה או עיר...", month chips, הכל / כדורגל / הופעות, grid of compact cards (EventArt 118px, name, date • city, chip once the route is non-empty, "מחיר ממוצע לחבילה $X", "+ הוספה למסלול" / "✓ במסלול · הסרה" / disabled "לא מתאים למסלול"), compatible first.
  - `DayPlanner` (≥ 2 events): day cells (event days numbered), night bands per stay, steppers depart / "מעבר ל{city}" / return within `tripDateBounds`.
  - `TripHeader`: overlapping round `EventArt` avatars, cities title, `DD/MM/YY – DD/MM/YY | N אירועים · M לילות` ("אירוע אחד" for 1).
  - `ItineraryFlow`: header + current step + `OrderContinueBar` (slots כרטיסים / טיסות / מלונות; `total` = `estimateItinerary().perTraveller` (Task A14 switches it to `livePerTraveller` once that is non-null); labels "בחר והמשך לכרטיסים" / "בחר והמשך לטיסות" / "בחר והמשך למלונות" / "בחר והמשך למלון ב{city}" / "בחר והמשך לסיכום"; disabled "בחרו לפחות 2 אירועים" when route < 2, plus a link "או רק {name} - להזמנה הרגילה" → `/order/{id}` when route = 1; `isFinalStep` false).

- [ ] **Step 1: Failing tests** - `parseEventsParam("618,702,618,abc,-1,5,9")` → `[618, 702, 5]`; `reconcileRoute([618, 999], new Map([[618, celine]]))` → route [celine], dropped [999].
- [ ] **Step 2:** FAIL → implement `url.ts` → PASS.
- [ ] **Step 3:** implement provider + components.
- [ ] **Step 4: Verify** (dev, browser): `/euro-trip/build?events=<two compatible ids>` shows the timeline; a blocked event cannot be added; removing to one disables the CTA and shows the regular-order link; self-build: two picks → planner, stepper bounds hold; URL updates; refresh keeps the route.
- [ ] **Step 5: Commit** `feat(euro-trip): builder - route step, self-build, day planner`

### Task 11 (A11): Tickets step through an `OrderContext` adapter

**Files:** Create `lib/itinerary/adapter.ts`, `components/euro-trip/build/orderContextAdapter.ts`, `components/euro-trip/build/TicketsStep.tsx`; Test `lib/__tests__/itineraryAdapter.test.ts`

**Interfaces:**
- Consumes: `OrderContext` (`app/app.context.ts:151`; type via `React.ContextType<typeof OrderContext>` - `AppContext` is not exported; do **not** export it), `TicketSelection` (`app/order/TicketSelection.tsx:240`, unchanged; it reads `eventTicket, setEventTicket, event, setEvent, setCurrentMinTicketPrice, personLink, returnToSummary, readyPackage, numberOfEventTickets, setNumberOfEventTickets, setPlaneTickets, setFlight, setHotel, orderResume`).
- Produces:
  - `ticketAdapterFields(i: { event: Event; ticket: OrderTicket | undefined; pax: number }): { event: Event; eventTicket: OrderTicket | undefined; numberOfEventTickets: number; returnToSummary: false; readyPackage: undefined; personLink: undefined; orderResume: undefined }`.
  - `adapterForEvent(i, cb: { setTicket(t: OrderTicket | undefined): void; setPax(n: number): void; setEvent(e: Event): void; clearTravel(): void }): React.ContextType<typeof OrderContext>` - fields above + `setEventTicket`, `setEvent`, `setNumberOfEventTickets` (→ `setPax`), `setCurrentMinTicketPrice: () => {}`, `setPlaneTickets` / `setFlight` / `setHotel` → `cb.clearTravel()`; cast once at this boundary.
  - `TicketsStep`: event tabs (avatar, name, `DD/MM · city`, ✓ when the ticket's `quantity === pax`); active event → `<OrderContext.Provider key={id} value={adapterForEvent(...)}><TicketSelection initialEvent={event} /></OrderContext.Provider>`.

- [ ] **Step 1: Failing test** - `ticketAdapterFields({event, ticket: undefined, pax: 3})` → `numberOfEventTickets 3`, `returnToSummary false`, `readyPackage undefined`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** (browser): a route with a tx_event and a static event - each tab shows the real seat map and category cards; a pick marks ✓; quantity changed in one tab shows in the other and clears flight/hotels (continue-bar slots); `git diff --stat origin/main -- app/order app/hooks` empty.
- [ ] **Step 4: Commit** `feat(euro-trip): tickets step reuses the live ticket step`

### Task 12 (A12): Flights step

**Files:** Create `components/euro-trip/build/FlightsStep.tsx`, `components/euro-trip/build/ItineraryFlightCard.tsx`

**Interfaces:**
- Consumes: A4 `tripLegs`, `trainLegs`; A8 `POST /api/itinerary/flights`; `FlightMeta` (`components/ui/FlightCard.tsx:412`) per leg; the `/api/flights/pricing` call as made in `app/order/OrderForm.tsx:236`.
- Produces:
  - `FlightsStep`: search on (legs, pax) change, debounced 400 ms, aborting the previous; sort tabs הטוב ביותר / הזול ביותר / ישראלי (ישראלי = every carrier in LY / IZ / 6H); callout for a mid leg < 600 km: "טיסה אחת לכל המסלול. {A}–{B} זה {km} ק״מ - ברכבת כ-{h} שעות ממרכז העיר למרכז העיר. מעדיפים רכבת? כבו את קטע הביניים." (h = (km / 170 + 0.5).toFixed(1)); states: loading, empty "לא מצאנו טיסות לתאריכים האלה - נסו להזיז יום", 429 "עומס זמני, מנסים שוב…" with one retry.
  - `ItineraryFlightCard({ flight, selected, basePrice, onSelect, onToggleTrain })`: `FlightTicketCard`'s chrome (selected mint border; badge "הפחיתו ${d}- לנוסע ממחיר החבילה" / "+${d} לנוסע" / "כלול במחיר החבילה" vs `basePrice` = first offer of the default sort, per traveller), one `FlightMeta` per leg, under each mid leg a toggle "אגיע ברכבת ({km} ק״מ)", and a row per train leg "{A} ← {B} ברכבת · DD/MM · כ-{h} שעות · בכוחות עצמכם, לא כלול".
  - Continue: price the chosen offer through `/api/flights/pricing` like `OrderForm`; `setFlight({ ...priced, trainLegs })`.

- [ ] **Step 1:** implement.
- [ ] **Step 2: Verify** (browser): Paris → London shows 3-leg cards; the train toggle re-searches and shows 2 flown legs + a train row; select + continue → flights slot ✓; no console errors.
- [ ] **Step 3: Commit** `feat(euro-trip): multi-city flights step with train toggle`

### Task 13 (A13): Hotels step through the adapter, one stay at a time

**Files:** Create `lib/itinerary/stayAdapter.ts`, `components/euro-trip/build/HotelsStep.tsx`; Test `lib/__tests__/itineraryStayAdapter.test.ts`

**Interfaces:**
- Consumes: A4 `stays`, `tripLegs`, `trainLegs`; `getDefaultDateRange(event, flight)` (`lib/getDefaultDateRange.ts:50`); `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx:57`) and `HotelSelection` (`app/order/HotelSelection.tsx:105`), unchanged (it reads `setHotel, planeTickets, flight, event, setSelectedHotelFilters, setSkipHotel, setSkippedHotelPricePerGuest, flightSkipped, numberOfEventTickets, personLink, returnToSummary, lodgingCity, setLodgingCity, hotelSegments, setHotelSegments, splitNights, setSplitNights, hotel, packageLocked, readyPackage`).
- Produces:
  - `stayEvent(e: Event, city: LodgingCity): Event` = `{ ...e, lodging_mode: city === "event" ? "event_city_only" : "flight_city", lodging_default: city }`.
  - `stayFlight(stayIndex: number, flight: ItineraryFlight, route: Event[], d: TripDates, train: ReadonlySet<string>): Flight` - `outbound` = the segment arriving into stay `stayIndex`, `inbound` = the segment leaving it; a train boundary → synthetic `FlightSegment` with `departureTime = arrivalTime = "{date}T12:00:00"`, empty stops, `duration "0"`.
  - `HotelsStep`: city tabs ("מלון ב{city} · DD/MM–DD/MM · N לילות", ✓ when chosen); active stay only: `<HotelFetchProvider key={stay.key}><OrderContext.Provider value={…}><HotelSelection /></…></…>` with `event = stayEvent(stay.events[0], stay.city)`, `flight = stayFlight(...)`, `numberOfEventTickets = pax`, `hotel = hotels[stay.key]`, `setHotel(h) → setHotel(stay.key, h)`, `lodgingCity = stay.city`, `flightSkipped false`, `returnToSummary false`, `readyPackage undefined`, `packageLocked false`, `hotelSegments []`, `splitNights []`, the other setters no-ops. Keep each visited stay's provider mounted (hidden) so going back costs no search.

- [ ] **Step 1: Failing tests** - [Céline, Chelsea] with a fixture flight (TLV→CDG lands 2027-05-11 09:55; CDG→LHR departs 2027-05-13 13:05; LHR→TLV departs 2027-05-16 22:40): `getDefaultDateRange(stayEvent(céline,"flight"), stayFlight(0,…))` → [2027-05-11, 2027-05-13]; stay 1 → [2027-05-13, 2027-05-16]; with the move as a train on 2027-05-13 → same dates; outbound landing 06:30 → check-in 2027-05-10 (existing early-landing rule).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** (browser + network): the hotels step fires **one** `/api/hotels` request for the first city; the second tab fires one more; going back fires none; each chosen hotel shows ✓; `git diff --stat origin/main -- app/order app/hooks` empty.
- [ ] **Step 4: Commit** `feat(euro-trip): hotels step reuses the live hotel step per city`

### Task 14 (A14): Summary, travellers form, draft

**Files:** Create `lib/itinerary/progress.ts`, `lib/itinerary/travellers.ts`, `lib/itinerary/draft.ts`, `components/euro-trip/build/SummaryStep.tsx`, `components/euro-trip/build/TravellersForm.tsx`; Modify `components/euro-trip/build/ItineraryProvider.tsx` (draft) and `ItineraryFlow.tsx` (live total); Tests `lib/__tests__/itineraryProgress.test.ts`, `itineraryTravellers.test.ts`, `itineraryDraft.test.ts`

**Interfaces:**
- Consumes: A10 state, A5 `tierMarkups`, `markupDiscount`; `OrderData` contact fields (`lib/app.types.ts:571-575`); the validation of `app/order/OrderReview.tsx` (read, mirror - do not import from or edit it); `lib/order/draft.ts` as the pattern.
- Produces:
  - `canContinue(state): { build: boolean; tickets: boolean; flights: boolean; hotels: boolean }` - build: route ≥ 2; tickets: every event has a ticket with `quantity === pax`; flights: flight set; hotels: every stay has a hotel.
  - `livePerTraveller(state, s: ItinerarySettings): number | null` - null until tickets + flight + all hotels exist; else Σ ticket price + `flight.price / pax` + Σ hotel price per traveller (same per-traveller rule as the regular summary) + Σ `tierMarkups`.
  - `type TravellersInput = { contact: { firstName: string; lastName: string; phone: string; email: string }; others: { firstName: string; lastName: string }[] }`; `validateTravellers(t, pax): Record<string, string>` (same rules and Hebrew messages as the regular summary); `toOrderContactFields(t)` → `main_contact_first_name`, `main_contact_last_name`, `main_contact_phone_number`, `main_contact_email`, `more_pax_info`.
  - Draft: key `myt:itinerary-draft`, `ITINERARY_DRAFT_VERSION = 1`, TTL 30 min; `serializeDraft(state, now: number): string`; `parseDraft(raw: string | null, now: number, catalog: Map<number, Event>): Partial<State> | null` (rejects other versions / expired; drops events not in catalog, a flight whose first leg already left, all hotels; never carries prices).
  - `SummaryStep`: panels events / flights (train legs marked) / hotels; `TravellersForm`; terms checkbox (link `/terms`); price box (כרטיסים, טיסות, מלונות, שירות, "הנחת מסלול −${markupDiscount}", "סה״כ לנוסע", "סה״כ ל-{pax} נוסעים"); buttons "שמרו לי ל-24 שעות" and "לתשלום מאובטח" (disabled with "בקרוב" while `!settings.paymentsEnabled`). The draft is restored in an effect after mount (never initial state).

- [ ] **Step 1: Failing tests** - `canContinue` per stage; `livePerTraveller` null with a missing hotel, exact sum otherwise; `validateTravellers` errors for a Hebrew name, a bad email, a missing traveller row; `parseDraft` rejects version 0 and a 31-minute-old draft, drops an id missing from the catalog.
- [ ] **Step 2:** FAIL → implement the three libs → PASS.
- [ ] **Step 3:** implement the components and wire the draft in `ItineraryProvider`.
- [ ] **Step 4: Verify** (browser): full walk to the summary; refresh keeps the trip (flight/hotels asked again); price box = `livePerTraveller` × pax; Hebrew form errors.
- [ ] **Step 5: Commit** `feat(euro-trip): summary, travellers form, refresh-safe draft`

### Task 15 (A15): Confirm (24h hold) - group reservations

**Files:** Create `lib/itinerary/confirm.ts`, `lib/itinerary/priceFloor.ts`, `lib/itinerary/insertGroup.ts`, `lib/itinerary/emails.ts`, `app/api/itinerary/confirm/route.ts`; Test `lib/__tests__/itineraryConfirm.test.ts`

**Interfaces:**
- Consumes: A2-A5, A14; `getEvents(id)` (`lib/eventsData.ts:172`); `validateLiveTicketsOffer(data)`, `validateOwnStock(data)` (`app/api/confirm-order/utils.ts:306,366`, imported, called per event with a single-event `OrderData` built by `toSingleEventOrderData`); `snapshotTicketCost`, `withDeadline` (`lib/ticket-cost.ts:35`); `orderHotelSellable` (`lib/hotelRateTerms.ts:97`); `lib/exchangeRateService.ts`; `supabase`; the mail helper `confirm-order` uses for its ops email.
- Produces:
  - `type TripSubmission = { group: string /* client-generated uuid v4 = itinerary_group = idempotency key */; route: number[]; dates: TripDates; pax: number; tickets: Record<number, OrderTicket>; flight: ItineraryFlight; hotels: Record<string, OrderHotel>; travellers: TravellersInput; clientPerTraveller: number; utmSource?: string; payNow?: boolean }`.
  - `toSingleEventOrderData(sub, event): OrderData` (only the fields the per-event validators read).
  - `serverPerTraveller(sub: TripSubmission, route: Event[], markups: Map<number, number>): number`; `totalsMatch(server: number, client: number): boolean` (|Δ| ≤ 1).
  - `buildGroupRows(sub, route, ctx: { group: string; rateIls: number; markups: Map<number, number>; status: "24Save" | "Pending" }): Record<string, unknown>[]` - one row per event in date order: `event_id`, `event_order_info` (that event's ticket, single-event shape), `flight_order_info` (the full `ItineraryFlight` on seq 1, `{}` otherwise), `hotel_order_info` (the stay's hotel on the first event of each stay, `{}` otherwise), contact fields, `aff_partner_tracking_code` from `utmSource`, `final_purchase_price_ils` shares (Σ = round(total × rate); remainder on seq 1), `exchange_rate_usd_ils_100`, `status`, `itinerary_group`, `itinerary_seq` 1..N, `itinerary_of` N. `payment_info` stays `null` (a non-null `payment_info` reads as paid elsewhere).
  - `validateItineraryPriceFloor(route, sub, markups): Promise<string | null>` - per event: trusted cheapest ticket re-read from the DB (as `utils.ts:214-219`) + its tiered markup, × pax; reject when its ILS share < floor × rate × 0.6.
  - `insertGroup(rows): Promise<{ ids: number[] } | { error: string }>` - one `supabase.from("reservations").insert(rows).select("id, itinerary_seq")`; **no column stripping**; any error → `{ error }`.
  - `POST /api/itinerary/confirm` → `{ group, ids }`: settings `itineraryOn` else 404 → shape check (400) → idempotency: `sub.group` must be a uuid v4; rows already having `itinerary_group = sub.group` → return them → re-read each event with `getEvents(id)`; all `isItineraryEligible` and `compatibility` of each against the others not blocked (400 "המסלול השתנה") → `clampTripDates(route, dates)` equals the submitted dates → per-event validators → `orderHotelSellable` per stay (400 `HOTEL_NOT_REFUNDABLE`) → `serverPerTraveller` + `totalsMatch` (409 "המחיר עודכן") → floor → `insertGroup` (a unique-violation `23505` on `(itinerary_group, itinerary_seq)` = a concurrent duplicate → re-read and return that group) with status `24Save` (`Pending` only when `settings.paymentsEnabled && payNow`) → `snapshotTicketCost` per row (best effort, `withDeadline`, update the row) → ops email for the group + customer hold email **without a pay link** ("קיבלנו את הבקשה. נציג יחזור אליכם תוך 24 שעות.") - email errors logged, never fail the request; try/catch → 500.

- [ ] **Step 1: Failing tests** - `buildGroupRows` for [Céline, Chelsea]: 2 rows, seq 1/2, `itinerary_of` 2, flight only on seq 1, Σ `final_purchase_price_ils` = round(total × rate), the London hotel on the Chelsea row; [Chelsea, London event] → one hotel row; `totalsMatch(1000, 1000.9)` true, `(1000, 1002)` false; `serverPerTraveller` = hand sum.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Verify** on dev **after Task B1's migration ran** (before it: expect a clean `{ error }` 500 - check that once): a hold from the browser → two `reservations` rows sharing `itinerary_group`, status `24Save`; double click / resend with the same `group` → still two rows. Report the test group id to Dor (ops ignore it).
- [ ] **Step 4: Commit** `feat(euro-trip): group confirm with 24h hold`

### Task 16 (A16): Guards in live code (the only live edit)

**Files:** Modify `app/api/find-order/route.ts`; the hold-email builder in `app/api/confirm-order/utils.ts` (around `:1075`, the `/order/{eventId}?orderId=` link)

- [ ] **Step 1:** `find-order`: after fetching rows, filter **in JS** `rows.filter((r) => !r.itinerary_group)` - never add the column to the SQL select/filter (works whether or not the column exists). Hold-email builder: when the row has `itinerary_group`, return early (no single-event pay link). Nothing else.
- [ ] **Step 2: Verify** - `npx tsc --noEmit` clean; `git diff origin/main -- app/api/find-order app/api/confirm-order` shows only these lines; a regular held order still resumes on dev.
- [ ] **Step 3: Commit** `fix(order): never resume a Euro Trip row as a single-event order`

### Task 17 (A17): Final verification (Part A)

- [ ] `npx vitest run` → all green.
- [ ] `npx tsc --noEmit` → no new errors vs `origin/main` (compare counts).
- [ ] `yarn build` → green.
- [ ] `git diff --stat origin/main -- app/order app/hooks app/api/confirm-order app/api/payment app/api/flights/search app/api/hotels lib/homepage components/ui` → only Task A16's lines.
- [ ] Browser walk on dev (desktop + 375px): hub → card → build → tickets → flights (train toggle) → hotels (2 cities) → summary → 24h hold. Screenshots to Dor.
- [ ] Commit fixes; **stop and report** - push only when Dor says.

---

## Part B - myt-backoffice (`master`)

### Task 18 (B1): Migrations

**Files:** Create `supabase/migrations/20261021120000_itinerary_core.sql`, `supabase/rollback/20261021120000_itinerary_core.sql`

- [ ] **Step 1:** Migration (header comment: spec path, who reads/writes): `create table if not exists public.itinerary_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid);` + `alter table ... enable row level security;` (no policies - service role only, like `marketing_settings` in `20261008120000_marketing_dashboard.sql:109-115`); `alter table public.reservations add column if not exists itinerary_group uuid, add column if not exists itinerary_seq smallint, add column if not exists itinerary_of smallint;` `create unique index if not exists reservations_itinerary_group_seq_uidx on public.reservations (itinerary_group, itinerary_seq) where itinerary_group is not null;` (also serves lookups by group) `comment on column` for each. Rollback drops the index, the columns and the table.
- [ ] **Step 2: Commit** `feat(itinerary): settings table + reservation group columns`. **Do not push** - the migration runs on push to master; that waits for Dor and the push-coordinator protocol.

### Task 19 (B2): Settings screen

**Files:** Create `lib/actions/itinerary-settings-actions.ts`, `app/(dashboard)/templates/euro-trip/settings/page.tsx` + its client form; Modify the Templates navigation to add "Euro Trip"

**Interfaces:**
- Produces: `readItinerarySettings()` (defaults merged; same keys/defaults/ranges as A1); `saveItinerarySettings(form): Promise<{ ok: true } | { error: string }>` - validates ranges, upserts `onConflict: "key"`, `logAudit`, then POSTs main `/api/itinerary/revalidate` with `x-hotel-secret` (the same env `revalidateMain` uses); a failed revalidate is reported, not thrown.
- Form: switches "Euro Trip פעיל באתר" / "תשלום פעיל", number fields with Hebrew labels + helper text ("אירוע שני: % הנחה על דמי השירות", "מרחק מקסימלי בין ערים (ק״מ)", ...).

- [ ] **Step 1:** implement (pattern `lib/actions/marketing-actions.ts:24-33,158-178`, `app/(dashboard)/marketing/settings-tab.tsx`).
- [ ] **Step 2: Verify** after B1 runs: save → rows change; main dev `/euro-trip` follows `enabled` after the revalidate call.
- [ ] **Step 3: Commit** `feat(itinerary): Euro Trip settings screen`

### Task 20 (B3): Reservations - group chip and panel

**Files:** Modify `lib/actions/reservation-actions.ts` (`RESERVATION_LIST_COLUMNS` += `itinerary_group, itinerary_seq, itinerary_of`; add `getItineraryGroup(group: string)`), `app/(dashboard)/reservations/reservations-table.tsx`, `app/(dashboard)/reservations/[id]/page.tsx`; Create `app/(dashboard)/reservations/[id]/itinerary-panel.tsx`; Modify `types/app.types.ts` (`ItineraryFlight`, mirror of A1) and `types/reservation.types.ts` (the three columns)

- [ ] **Step 1:** List: chip "יורו טריפ {seq}/{of}". Detail: panel "יורו טריפ" - sibling reservations (link, event, status, `final_purchase_price_ils`), the trip total, every leg of the seq-1 `flight_order_info.legs` + `trainLegs`; the existing outbound/inbound block untouched.
- [ ] **Step 2:** type-sync check (`/sync-types`) → only the intended additions.
- [ ] **Step 3: Verify** with A15's test group: chips on both rows, panel links both, legs listed.
- [ ] **Step 4: Commit** `feat(itinerary): Euro Trip group in reservations`
