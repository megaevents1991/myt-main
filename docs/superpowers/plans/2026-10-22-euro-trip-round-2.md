# Euro Trip Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Alon's round-2 notes: staff-titled trips from a backoffice "טריפים" tab, the ready trip as the live order flow (stepper per event, dates in the flight step, split-stay hotel cards, the live summary structure), and a planner with a side panel + search popup.

**Architecture:** Pure rules in `lib/itinerary/*` (vitest), thin client components in `components/euro-trip/build/*` that import the live order-flow pieces (props-only components) instead of re-drawing them; one new backoffice table + screen; the site reads it through a cached server reader.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Mantine (+ @mantine/dates), shadcn/ui (backoffice), Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-10-22-euro-trip-round-2-design.md` (phase 1: `docs/superpowers/specs/2026-10-21-multi-event-itinerary-design.md`).

## Global Constraints

- Main app: worktree `C:/Users/doraz/OneDrive/Desktop/Work/MegaEvent/MYT_Git_Shered/myt-main-itinerary`, branch `feat/multi-event-itinerary`. Backoffice: `C:/Users/doraz/OneDrive/Desktop/Work/MegaEvent/MYT_Git_Shered/myt-backoffice`, branch `master` (shared with other sessions: `git status` first, commit ONLY your paths with `git commit -- <paths>`).
- Commit freely; **never push**; **never `git merge`**; **never `git stash`**; no AI co-author / attribution line in commits; conventional messages (`feat(euro-trip): ...`, `feat(trips): ...`).
- Do not edit live files: `app/order/**`, `app/hooks/**`, `components/order/**`, `components/ui/**`, `app/api/hotels/**`, `app/api/confirm-order/**`, `app/api/payment/**`, `app/api/flights/search/**`. Import them. The ONE allowed live edit: `components/Header.tsx` (Task 4, one condition).
- Pure `lib/itinerary/*` modules must not import `lib/supabase.ts` or `lib/eventsData.ts`. Server-only readers are `*.server.ts`.
- Tests: `npx vitest run <file>` (only `lib/**/*.test.ts`; header `import { describe, expect, it } from "vitest";`; fixtures cast `as unknown as Event`). Type gate `npx tsc --noEmit` (baseline 0). Known failing legacy vitest files (ignore): supplier-offers, tixstock-map-rename, tixstock-quantity, crestArt, galleryArt. Build: `npx next build` with no dev server running (OneDrive `.next` flake: delete `.next`, retry once).
- Hebrew RTL copy, logical properties only (`ms-`/`me-`/`start`/`end`), Tailwind inline, Mantine/shadcn only - no new UI libraries.
- Prices: only through `lib/itinerary/progress.ts` (`livePrice`, `progressivePrice`, `hotelPerTraveller`) and `lib/itinerary/price.ts`. No second formula.
- Hotel searches (RateHawk, 10/min account-wide): only on the hotels step, sequential.
- ONE browser agent at a time; never two `next dev` in the worktree; never delete `.next` while a server runs.
- Copy strings in this plan are exact - use them verbatim.

## Review Focus

1. A ready-trip URL with one event that no longer fits must open the planner with the notice - never a tickets step with one event.
2. Changing dates in the flight picker and closing it WITHOUT "עדכון הטיסות" must not change `state.dates` (no flight cleared, no Amadeus search).
3. The hotels step opened twice (or after a swap) must not spend a second RateHawk search for the same stay/dates/party.
4. A staff trip whose event sold out, moved to the US, or now sits > max_km away must vanish from the hub, not show short or broken.
5. Stepper back-clicks only: a click on a future step does nothing; a click on "אירוע 2" from the hotels step returns to event 2's tickets with the flight/hotels kept.

---

### Task 1: Staff trips on the hub (main)

**Files:**
- Create: `lib/itinerary/staffRoutes.ts`, `lib/itinerary/routes.server.ts`, `lib/__tests__/itineraryStaffRoutes.test.ts`
- Modify: `lib/itinerary/routeCard.ts` (type), `components/euro-trip/RouteCard.tsx`, `lib/itinerary/hubView.ts`, `lib/__tests__/itineraryHubView.test.ts`, `app/euro-trip/page.tsx`, `app/api/itinerary/revalidate/route.ts`

**Interfaces:**
- Produces: `type StaffRouteRow = { id: number; title: string; event_ids: number[]; sort_order: number }`; `parseStaffRouteRows(data: unknown): StaffRouteRow[]`; `staffRouteCards(rows: StaffRouteRow[], events: Event[], s: ItinerarySettings, todayIso: string): RouteCardData[]`; `mergeRouteCards(staff: RouteCardData[], auto: RouteCardData[]): RouteCardData[]`; `RouteCardData.staffTitle?: string`; `ITINERARY_ROUTES_TAG = "itinerary-routes"`; `getStaffRoutesForPage(): Promise<StaffRouteRow[]>`.
- Consumes: table `public.itinerary_routes (id, title, event_ids bigint[], sort_order int, is_active bool)` (Task 9); `toRouteCard`, `fitRoute`, `isItineraryEligible`, `isMissingSettingsTable`.

- [ ] **Step 1: Write failing tests** in `itineraryStaffRoutes.test.ts` (reuse event fixtures from `itineraryRouteCard.test.ts` / `itineraryRecommend.test.ts`):
  - `parseStaffRouteRows drops malformed rows` - rows with title `" "`, 1 id, 4 ids, a non-numeric id, a missing id field are dropped; a good row keeps `title` trimmed and `event_ids` as numbers.
  - `a fitting staff row becomes a card with its title` - `staffRouteCards([row], events, s, today)` -> one card, `staffTitle === row.title`, `ids` in trip order.
  - `a row with an id missing from the catalog is skipped` -> `[]`.
  - `a row with an ineligible event is skipped` (sold out, or US, or < 3 days away) -> `[]`.
  - `a row whose events do not fit together is skipped` (two events > max_km apart) -> `[]`.
  - `mergeRouteCards puts staff first and drops the auto card with the same events` - auto cards `[A(1,2), B(3,4)]`, staff `[S(2,1)]` -> `[S, B]`.
  - In `itineraryHubView.test.ts`: `search matches a staff title` - a card with `staffTitle: "דון טוליבר והקלאסיקר"` is found by query `"קלאסיקר"`.
- [ ] **Step 2:** `npx vitest run lib/__tests__/itineraryStaffRoutes.test.ts lib/__tests__/itineraryHubView.test.ts` -> FAIL.
- [ ] **Step 3: Implement** `staffRoutes.ts` (pure), the `staffTitle` field, `hubCards` matching it. `RouteCard` `<h3>` shows `data.staffTitle ?? names` (keep `title={names}` and the aria-label with names).
- [ ] **Step 4: Implement** `routes.server.ts`: `unstable_cache` (key `["itinerary-routes"]`, revalidate 3600, tags `[ITINERARY_ROUTES_TAG]`) over a read of `itinerary_routes` (`id, title, event_ids, sort_order`, `is_active = true`, order `sort_order` then `id`) that throws `Object.assign(new Error(msg), { code })` on error; `getStaffRoutesForPage()` returns `[]` only when `isMissingSettingsTable(e)` (outside the cache) and rethrows anything else. Hub page: `mergeRouteCards(staffRouteCards(rows, events, settings, todayIso), autoCards)`. Revalidate route: add `revalidateTag(ITINERARY_ROUTES_TAG)`.
- [ ] **Step 5:** vitest (both files) PASS; `npx vitest run lib/__tests__/itinerary*` no new failures; `npx tsc --noEmit` 0.
- [ ] **Step 6: Commit** `feat(euro-trip): staff trips with their own title lead the hub`.

### Task 2: Flow steps, the date-pick order, the "עצמאית" label (main, pure)

**Files:**
- Create: `lib/itinerary/flowSteps.ts`, `lib/itinerary/datePick.ts`, `lib/__tests__/itineraryFlowSteps.test.ts`, `lib/__tests__/itineraryDatePick.test.ts`
- Modify: `lib/itinerary/flightsView.ts` (`trainToggleLabel`), `lib/__tests__/itineraryFlightsView.test.ts`

**Interfaces:**
- Produces:
  - `flowSteps(route: Event[]): string[]` -> `["אירוע 1", ..., "אירוע N", "טיסות", "מלונות", "סיום"]`.
  - `stepperIndex(s: Pick<ItineraryState, "step" | "activeEvent" | "route">): number` (1-based; `build` -> 0; tickets -> `activeEvent + 1`; flights -> N+1; hotels -> N+2; summary -> N+3).
  - `stepForIndex(index0: number, route: Event[]): { step: ItineraryStep; activeEvent: number } | null` (0-based Mantine index; `null` out of range; non-ticket steps return `activeEvent: 0`).
  - `type DatePickStep = { key: string; kind: "depart" | "move" | "ret"; label: string; value: string; min: string; max: string }`.
  - `datePickSteps(route: Event[], dates: TripDates, train: ReadonlySet<string>): DatePickStep[]` - trip order; key `"depart"`, each move's `TripMove.key`, `"ret"`; labels `טיסה הלוך ל<city>`, `מעבר ל<city>` (+ ` (עצמאית)` when `train.has(key)`), `חזרה מ<city>` with `<city>` = `stayCityName(stay.events[0])` of the stay flown to / moved to / left; `min`/`max` = `tripDateBounds`.
  - `applyDatePick(route: Event[], dates: TripDates, key: string, day: string): TripDates` - sets that key then `clampTripDates`; an unknown key changes nothing (still clamped).
- Consumes: `moves`, `stays`, `tripDateBounds`, `clampTripDates` (dates.ts), `stayCityName` (builder.ts).

- [ ] **Step 1: Failing tests:**
  - flowSteps: 2 events -> 5 labels; 3 events -> 6 labels, exact strings above.
  - stepperIndex: build 0; tickets activeEvent 1 of 3 -> 2; flights of 3 -> 4; summary of 2 -> 5.
  - stepForIndex: index 1 of 3-event route -> `{ step: "tickets", activeEvent: 1 }`; index 3 -> flights; index 5 -> summary; index 6 -> null; negative -> null.
  - datePickSteps: two-city route -> 3 steps `depart, move, ret`, labels with city names, min/max equal `tripDateBounds`; two events same city -> 2 steps; three cities -> 4 steps; train key -> label ends ` (עצמאית)`.
  - applyDatePick: in-range move day is kept; a day past `max` comes back clamped to `max`; unknown key -> `clampTripDates(route, dates)`.
  - flightsView: `trainToggleLabel(312)` -> `"אגיע עצמאית (312 ק״מ)"` (match the function's current signature/format for the km number).
- [ ] **Step 2:** run the three test files -> FAIL.
- [ ] **Step 3: Implement** the two modules and the label.
- [ ] **Step 4:** tests PASS; `npx vitest run lib/__tests__/itinerary*` no new failures; tsc 0.
- [ ] **Step 5: Commit** `feat(euro-trip): stepper steps per event and the trip's date-pick order`.

### Task 3: Stay hotels - search, default pick, OrderHotel (main, pure + one client helper)

**Files:**
- Create: `lib/itinerary/stayHotels.ts`, `lib/__tests__/itineraryStayHotels.test.ts`

**Interfaces:**
- Produces:
  - `isAnsweredSearch(res: HotelsData): boolean` - `Array.isArray(res.data?.data?.hotels)` and (no hotels, or `hotelsInfo` present without `"error"`).
  - `pickDefaultHotel(search: HotelsData): Hotel | null` - `applyFiltersAndSorting` with `{ priceRange: [0, MAX_SAFE_INTEGER], rating: [false, false, true, true, true], meal: ["withoutMeal"], kind: ["Hotel"], freeCancellation: ["withFreeCancellation", "withoutFreeCancellation"], distanceFromCenter: [0, MAX_SAFE_INTEGER], hotelsInfo }`, then `[...preferred, ...all].find(h => hotelsInfo[h.id] && h.rates?.length)`, else `null`.
  - `buildStayHotel(a: { city: LodgingCity; cityLabel: string; search: HotelsData; hotel: Hotel; rate?: Rate }): OrderHotel` - same fields as the live split stay's `buildSegmentHotel` (spec B5; `price = rate.payment_options.payment_types[0].show_amount`, `guests/checkin/checkout` from `search.data.debug.request`, `city`, `cityName: cityLabel`) then `withStayHotelExtras`.
  - `withStayHotelExtras(h: OrderHotel, search: HotelsData): OrderHotel` - `breakfast_offer` (`findBreakfastUpgrade` -> `{ rate, delta_usd }` or `null`) and `segment_card` (`images`: room images by `main_name + " " + bedding_type` first, then general, max 12; `distance` ceil; `guestRating`, `lat`, `lng`; `null` without metadata).
  - `class StaySearchFailed extends Error`; `searchStayHotels(params: FetchHotelsParams, signal: AbortSignal, opts?: { retryMs?: number; fetcher?: (p: FetchHotelsParams, s: AbortSignal) => Promise<HotelsData> }): Promise<HotelsData>` - up to 2 attempts, `retryMs` default 8000 between them, stops on abort, returns the first answered result, else throws `StaySearchFailed`.
- Consumes (import, do not copy): `fetchHotels`/`FetchHotelsParams` (`app/order/fetchHotels.ts`), `HotelsData` type, `applyFiltersAndSorting` (`lib/hotelFilter.ts`), `findBreakfastUpgrade` (`app/order/order-review.utils.ts`). If importing a live module drags a browser-only or supabase import into vitest, inject it (as `fetcher` does) rather than copying logic.

- [ ] **Step 1: Failing tests** (synthetic `HotelsData` fixtures):
  - `pickDefaultHotel takes the cheapest 3-5 star hotel` (a cheaper 2★ and a cheaper "Hostel" are skipped).
  - `pickDefaultHotel falls back to the first hotel with info and rates`; `returns null with no usable hotel`.
  - `buildStayHotel copies the rate price, the request's dates and guests, and the city label`.
  - `withStayHotelExtras puts the room's images before the hotel's, max 12`; `segment_card is null without metadata`; `breakfast_offer is null when no breakfast rate exists`.
  - `searchStayHotels retries once then throws StaySearchFailed` (fetcher fails twice, `retryMs: 0`); `returns an answered empty search without retrying`; `stops when the signal is aborted`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + tsc 0.
- [ ] **Step 5: Commit** `feat(euro-trip): stay hotel search and default pick like the split stay`.

### Task 4: The flow shell - stepper, entry on tickets, headers (main)

**Files:**
- Modify: `components/Header.tsx` (one condition), `components/euro-trip/build/ItineraryFlow.tsx`, `components/euro-trip/build/TripHeader.tsx`, `components/euro-trip/build/TicketsStep.tsx`, `components/euro-trip/build/ItineraryProvider.tsx`, `lib/itinerary/state.ts`, `lib/__tests__/itineraryState.test.ts`
- Delete: `components/euro-trip/build/RouteStep.tsx` (and anything only it used, if nothing else imports it)

**Interfaces:**
- Consumes: Task 2 `flowSteps`, `stepperIndex`, `stepForIndex`; live `Stepper` (`components/ui/Stepper.tsx`, props `currentStep, onStepperClick, steps, hideSteps`), live `EventDataHeader` (`components/ui/EventDataHeader.tsx`, prop `event`).
- Produces: reducer `load` - mode `route` with `route.length >= MIN_TRIP_EVENTS` -> `step: "tickets"`, `activeEvent: 0`; mode `custom` -> `step: "build"`. Provider dispatches mode `route` only when the URL's events ALL fit (`fitRoute` refused none) and there are >= 2; otherwise mode `custom` + the existing notice.

- [ ] **Step 1: Failing tests** in `itineraryState.test.ts`: `load in route mode with two events opens the tickets of event 1`; `load in custom mode stays on build`; `load in route mode with one event stays on build`. Update any existing test that expected route mode to land on `build`.
- [ ] **Step 2:** FAIL. **Step 3:** reducer + provider change. PASS.
- [ ] **Step 4: UI.**
  - `Header.tsx`: hidden also when `pathname?.startsWith("/euro-trip/build")`.
  - `ItineraryFlow`: draw `<Stepper currentStep={stepperIndex(state)} steps={flowSteps(route)} hideSteps={step === "build"} onStepperClick={(i) => { const t = stepForIndex(i, route); if (!t || i + 1 >= stepperIndex(state)) return; ... goStep / setActiveEvent }} />` at the top (it is the page's top bar now). On `tickets`: the live band `<div className="bg-muted">` with `<EventDataHeader event={openEvent} />` instead of `TripHeader`; other steps keep `TripHeader`. `StepBody` `build` -> `<SelfBuild />` always.
  - `TripHeader`: a quiet link-button `עריכת המסלול` (`setMode("custom")` then `goStep("build")`).
  - `TicketsStep`: remove its per-event tabs (the stepper is the navigation); everything else unchanged.
  - Delete `RouteStep.tsx`.
- [ ] **Step 5:** `npx vitest run lib/__tests__/itinerary*` no new failures; tsc 0; `npx next build` green.
- [ ] **Step 6: Commit** `feat(euro-trip): the ready trip opens on tickets under the order flow's stepper`.

### Task 5: Dates in the flights step + "עצמאית" wording (main)

**Files:**
- Create: `components/euro-trip/build/TripDatesPicker.tsx`
- Modify: `components/euro-trip/build/FlightsStep.tsx`, `components/euro-trip/build/ItineraryFlightCard.tsx` (wording only, if it says רכבת for the customer's own move)

**Interfaces:**
- Consumes: Task 2 `datePickSteps`, `applyDatePick`; provider `state.dates`, `setDates` (or the provider's existing dates setter), `state.train`; Mantine `Popover`, `DatePicker` (`@mantine/dates`, already a dependency).
- Produces: `TripDatesPicker({ route, dates, train, onCommit }: { route: Event[]; dates: TripDates; train: ReadonlySet<string>; onCommit: (d: TripDates) => void })`.

- [ ] **Step 1:** Build the picker: a field in the flight search-bar look (`ובאיזה תאריכים?` + the dates joined ` · ` as DD/MM). Popover: header `בחרו: <label of the current step>` + small numbered chips for every step (click one = edit that one); one `DatePicker` whose `minDate`/`maxDate` = the current step's `min`/`max`, whose `getDayProps` marks every staged date selected and the days between first and last in-range; a click = `applyDatePick` on a LOCAL draft and advance to the next step; after the last step the button `עדכון הטיסות` calls `onCommit(draft)` once and closes. Closing otherwise discards the draft. `onCommit` with dates equal to the current ones does nothing.
- [ ] **Step 2:** Put it at the top of `FlightsStep` (replacing the read-only dates line); commit -> `setDates`. Wording: where the flights step names a move the customer makes alone, use `הגעה עצמאית`; the "not included" reminder stays.
- [ ] **Step 3:** tsc 0; `npx next build` green.
- [ ] **Step 4: Commit** `feat(euro-trip): the trip's dates are picked in the flights step, in order`.

### Task 6: Hotels step on the split-stay cards (main)

**Files:**
- Rewrite: `components/euro-trip/build/HotelsStep.tsx`
- Modify: `components/euro-trip/build/ItineraryFlow.tsx` (hotels continue rule and label)

**Interfaces:**
- Consumes: Task 3 module; live `SegmentsList`, `SegmentHotelModal` (`components/order/SegmentsList.tsx`), `OrderIssueState` (find its path with grep), `withBreakfast`, `withoutBreakfast`, `segmentBreakfastOffer` (`app/order/order-review.utils.ts`), `getRoomParams` (`lib/getRoomParams.ts`), `stays`, `stayRanges`, `stayEvent`, `withStayBase`, `lodgingLocation`, `stayHotelReady`, `stayCityName`, provider `setHotel(stayKey, h)`.

- [ ] **Step 1:** HotelsStep: for each stay in trip order, a `SegmentsList` with ONE segment (spec B5: `event = withStayBase(stayEvent(stay.events[0], stay.city), range)`, `minPrice = event.base_hotel_price`, `persons = pax`, `hotels = ready ? [hotel] : null`, `loading` while that stay searches); between stays one muted line naming the move (`DD/MM · טיסה ל<city>` or `DD/MM · הגעה עצמאית ל<city>`).
- [ ] **Step 2:** On `shown` with a flight: stays without a ready hotel are searched ONE AFTER ANOTHER (`searchStayHotels`, `location = lodgingLocation(stayEvent, stay.city)`, `dateRange` = the stay's range, `guests = getRoomParams(pax)`, `eventId` = the stay's first event), each answer cached in a ref by `stay.key|checkin|checkout|pax`, then `pickDefaultHotel` -> `buildStayHotel` -> `setHotel`. Abort on unmount / range change. A stay already ready is neither searched nor replaced. Failure -> `OrderIssueState` `לא מצאנו מלון ב<city> לתאריכים האלה` with retry `נסו שוב` (no SegmentsList for that stay).
- [ ] **Step 3:** "החלפת מלון" -> `SegmentHotelModal` (`title = החלפת מלון · <city>`, `search` = the cached answer, `minPrice` as above, `persons = pax`, `selectedHotelId`), `onPick` -> add `guests/checkin/checkout` from the search, `city`, `cityName`, `withStayHotelExtras` -> `setHotel`. Breakfast add/remove -> `withBreakfast(h, segmentBreakfastOffer(h))` / `withoutBreakfast(h)`.
- [ ] **Step 4:** `ItineraryFlow`: on hotels the primary is `בחר והמשך לסיכום` once every stay is `stayHotelReady`, else `מחפשים מלונות...` while searching / `בחרו מלון ב<city>` for the first missing one; remove the stay-by-stay walk. Keep the keep-alive `HotelsPane`.
- [ ] **Step 5:** tsc 0; `npx next build` green.
- [ ] **Step 6: Commit** `feat(euro-trip): hotels arrive picked per city on the split-stay cards`.

### Task 7: Summary in the order summary's structure (main)

**Files:**
- Create: `lib/itinerary/summaryRows.ts`, `lib/__tests__/itinerarySummaryRows.test.ts`
- Rewrite: `components/euro-trip/build/SummaryStep.tsx` (keep its hold/terms/failure logic)
- Modify: `lib/itinerary/progress.ts` only to EXPORT the per-piece estimates it already computes (no formula change)

**Interfaces:**
- Produces: `summaryAdditions(state: ItineraryState, s: ItinerarySettings): { tickets: Record<number, number>; flight: number; hotels: Record<string, number> } | null` - per traveller, picked piece minus that piece's estimate in `progressivePrice`; any `|x| <= PACK_BOUNDARY_USD` -> 0; `null` when `livePrice` is null.
- Consumes: live `PriceSummary`, `EventSummary`, `HotelSummary` (single path), `MobileHeader` (`app/order/OrderSummary/*`), `FlightMeta` (`components/ui/FlightCard.tsx`), `Timer` (`components/ui/Timer`), `Checkbox`, `Label`, `Dialog*`, `Card`; existing `useTripHold`, `TravellersForm`, `HoldConfirmation`, `livePrice`, `canContinue`, `markupDiscount`/the trip discount.

- [ ] **Step 1: Failing tests:** `a ticket above its estimate shows the difference per traveller`; `a hotel within 4 dollars of its base shows 0`; `null before every piece is picked`.
- [ ] **Step 2:** FAIL; implement; PASS.
- [ ] **Step 3:** Rebuild the layout exactly as spec B6 (class strings from `OrderReview`: `max-w-[1200px] lg:px-6 mx-auto py-3`, `grid gap-4 items-start md:grid-cols-2`, summary column `space-y-4 order-1 md:order-2`, passengers column `space-y-6 order-2 md:order-1`, header `bg-main text-main-foreground py-4 px-6 flex flex-row justify-between items-center` with `<h2 className="text-2xl font-bold text-right">סיכום הזמנה</h2>` and `ההזמנה שמורה עבורך למשך <Timer/> דקות`, passengers Card `px-8 pt-6 pb-8` with `פרטי הנוסעים` / `יש להזין שמות כפי שמופיעים בדרכון`). Per event: name, place | DD/MM/YYYY, `EventSummary` (`numberOfEventTickets = pax`, the ticket's category/zoneLabel, `eventTicketPriceAddition = additions.tickets[id]`), `עריכה` -> that event's tickets. Flights: every leg with `FlightMeta`, independent moves as text lines, `עריכה` -> flights. Hotels: `HotelSummary` per stay (single path, `hotelPriceAddition = additions.hotels[key]`, `totalGuests = pax`), `עריכה` -> hotels. `PriceSummary`: `finalPurchasePrice` = party total, `numberOfPersons = pax`, `affDiscount` = the trip discount for the party, `isNumberOfPersonsEqual={false}`, `finalPurchasePriceILS={0}`, `recommendedPriceAllPax={0}`, `agentCommission={0}`. Terms, logos (`components/order/PaymentLogos`), then the CTA: `שמרו לי ל-24 שעות` (hold) - and the pay button only when `settings.paymentsEnabled`. Keep: `attempt()` gate, Timer `onElapsed` stable + expired dialog + `releaseHold`, `HoldConfirmation`, failure UIs. Phone: `MobileHeader` (timer band) instead of the desktop header timer.
- [ ] **Step 4:** vitest itinerary* no new failures; tsc 0; `npx next build` green.
- [ ] **Step 5: Commit** `feat(euro-trip): the summary keeps the order summary's structure`.

### Task 8: The planner - side panel + "הוסף אירוע" popup (main)

**Files:**
- Create: `components/euro-trip/build/TripPanel.tsx`, `components/euro-trip/build/EventPickerModal.tsx`
- Modify: `components/euro-trip/build/SelfBuild.tsx`, `components/euro-trip/build/DayPlanner.tsx` (export its `DateStepper` if the panel reuses it), `lib/itinerary/builder.ts`, `lib/__tests__/itineraryBuilder.test.ts`

**Interfaces:**
- Produces: `CatalogFilter.city: string` (`""` = all); `catalogCities(catalog: Event[]): string[]` (unique `eventCityName`, he-sorted); `filterCatalog` honours `city`.
- Consumes: provider `state`, `addEvent`, `removeEvent`, `setDates`, `goStep`, `settings`, `catalog`; `catalogItems`, `catalogMonths`, `CompatChip`, `KindTabs`, `defaultTripDates`/`tripDateBounds`/`moves`/`stays`, `progressivePrice`.

- [ ] **Step 1: Failing tests** (builder): `catalogCities lists each city once`; `filterCatalog keeps only the chosen city`; `an empty city keeps every event`.
- [ ] **Step 2:** FAIL; implement; PASS.
- [ ] **Step 3: TripPanel** (spec C2), title `הטריפ שלכם`: rows in trip order - `טיסה הלוך ל<city>` (date + day arrows), event rows (art, name, DD/MM · city, ×), `מעבר ל<city>` (date + arrows) or `נשארים ב<city>`, dashed empty slots `<n> · אירוע ראשון` / `אירוע שני` / `אירוע שלישי (לא חובה)` (button -> opens the popup), `חזרה מ<city>` (date + arrows), CTA `המשיכו לבחירת כרטיסים` (enabled at >= 2 events, `goStep("tickets")`) with `הערכה: $X לנוסע` under it; below 2 events the CTA is disabled with `בחרו עוד אירוע כדי להמשיך`.
- [ ] **Step 4: EventPickerModal** (spec C3): Mantine `Modal` (`fullScreen` below 1024px), focused search input `לאן טסים? אמן, קבוצה או עיר...`, chips month / kind / city, result rows (round art 44px, name, DD/MM/YY · city, `CompatChip`), NO price; a fitting row: `addEvent` + close; a non-fitting row disabled with its reason.
- [ ] **Step 5: SelfBuild layout:** `lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6`; catalog column (intro line, search, months, kinds, city chips, grid) then the panel (`lg:sticky lg:top-24`). Below lg: panel first, the catalog column hidden (`hidden lg:block`). Remove the old `Tray` and the top `DayPlanner`.
- [ ] **Step 6:** vitest itinerary* no new failures; tsc 0; `npx next build` green.
- [ ] **Step 7: Commit** `feat(euro-trip): the planner fills a side panel and picks events in a popup`.

### Task 9: Table `itinerary_routes` (backoffice)

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHMMSS>_itinerary_routes.sql` (timestamp now, must sort after `20261021193309` and be unique), `supabase/rollback/<same name>.sql`

- [ ] **Step 1:** Write the migration exactly per spec A1, in the style of `20261021193309_itinerary_core.sql` (header comment with date + spec path, numbered object notes with written-by / read-by, `create table if not exists`, CHECKs inside `do $$ ... exception when duplicate_object then null; end $$;`, RLS on, `revoke all on public.itinerary_routes from anon, authenticated;`, comments, an index on `(is_active, sort_order, id)`). Rollback: header "MANUAL ROLLBACK ...", `begin; drop table if exists public.itinerary_routes; commit;`.
- [ ] **Step 2:** `ls supabase/migrations | cut -c1-14 | sort | uniq -d` prints nothing.
- [ ] **Step 3: Commit** (paths only) `feat(trips): itinerary_routes table for staff Euro Trip routes`.

### Task 10: Trips - validator, status, server actions (backoffice)

**Files:**
- Create: `lib/itinerary/routes.ts`, `scripts/itinerary-routes-selftest.ts`, `lib/actions/itinerary-routes-actions.ts`

**Interfaces:**
- Produces:
  - `type ItineraryRouteInput = { id?: number; title: string; eventIds: number[]; sortOrder: number; isActive: boolean }`; `type ItineraryRouteRow = ItineraryRouteInput & { id: number; updatedAt: string }`.
  - `validateItineraryRoute(form: unknown): { ok: true; route: ItineraryRouteInput } | { ok: false; errors: Record<"title" | "eventIds" | "sortOrder", string> }` - title trimmed 2..80 (`כותרת של 2-80 תווים`), 2..3 distinct positive integer ids (`בחרו 2 או 3 אירועים שונים`), sortOrder integer (`מספר שלם`).
  - `type TripEventLite = { id: number; name: string; date: string | null; is_deleted: string | null; is_hidden: boolean | null; deactivated_reason: string | null; tags: string[] | null; place: string }`; `routeSiteStatus(eventIds: number[], events: TripEventLite[], todayIso: string): { shown: boolean; text: string }` - the first reason in order missing / deleted / hidden / deactivated / Sold / past -> `לא יוצג באתר: <name> - <reason>`; else `מוצג באתר אם כל האירועים עדיין מתאימים זה לזה`.
  - Actions (`"use server"`, never throw, `requireStaff()`, untyped `idb` cast like `itinerary-settings-actions.ts`): `listItineraryRoutes(): Promise<{ status: "ok"; routes: (ItineraryRouteRow & { events: TripEventLite[]; site: { shown: boolean; text: string } })[] } | { status: "table_missing" } | { status: "error"; message: string }>`; `saveItineraryRoute(form: unknown): Promise<{ ok: true; warning?: string } | { error: string; fieldErrors?: Record<string, string> }>` (validate; every id an existing non-deleted event; insert or update with `updated_by`, `updated_at`; `logAudit` `itinerary.route.create|update`; `revalidateItinerary()` -> warning text on failure); `deleteItineraryRoute(id: number)` (same result shape, audit `itinerary.route.delete`); `setItineraryRouteActive(id: number, on: boolean)`; `searchTripEvents(query: string): Promise<TripEventLite[]>` (min 2 chars or a numeric id; `name`/`name_english` ilike with `%`/`_` escaped, or `id`; `is_deleted is null`; `date >= today`; date asc; limit 30; `place` via the existing `placeLabel`).
  - Missing table -> `הטבלה עוד לא קיימת - המיגרציה תעלה עם הדחיפה הבאה`.
- [ ] **Step 1:** Selftest first (pattern: `scripts/itinerary-settings-selftest.ts`): validator accepts a good form, rejects title `"א"`, 1 id, 4 ids, duplicate ids, `-3`, `"abc"`; status: missing / deleted / hidden / deactivated / Sold / past each give their text; all-good gives the shown text. Run `npx tsx scripts/itinerary-routes-selftest.ts` -> fails.
- [ ] **Step 2:** Implement `routes.ts` -> selftest passes. Implement the actions.
- [ ] **Step 3:** `npx tsc --noEmit` (no new errors vs. before).
- [ ] **Step 4: Commit** (paths only) `feat(trips): Euro Trip routes - validation, site status and server actions`.

### Task 11: Trips screen under Events (backoffice)

**Files:**
- Create: `app/(dashboard)/events/trips/page.tsx`, `app/(dashboard)/events/trips/trips-client.tsx`, `app/(dashboard)/events/trips/trip-dialog.tsx`, `components/events/events-subnav.tsx`
- Modify: `app/(dashboard)/events/page.tsx` (add the sub-nav above the table only), `lib/nav.ts` (`SEGMENT_LABELS.trips = "Euro Trips"`), `app/(dashboard)/guide/guide-content.ts` (one section under `nav: "/events"`, he + en)

- [ ] **Step 1:** `EventsSubnav({ active }: { active: "events" | "trips" })` - two `Link`s styled like shadcn `TabsList`/`TabsTrigger`: `אירועים (Events)` -> `/events`, `טריפים (Euro Trip)` -> `/events/trips`. On both pages.
- [ ] **Step 2:** `/events/trips` page (server, `force-dynamic`, `dir="rtl"`): `PageHeader` `טריפים - Euro Trip` with description `טריפים מוכנים שמוצגים ראשונים בעמוד Build Your Euro Trip באתר. כל טריפ: 2-3 אירועים, כותרת וסדר.`; `table_missing` -> info Alert; `error` -> destructive Alert; else the client list.
- [ ] **Step 3:** Client list: rows (title; events `name · DD/MM/YY · place` in date order; `סדר N`; `Switch` active; the site status line - muted when shown, amber when not; `עריכה`; `מחיקה` with an inline confirm `למחוק את הטריפ?` / `מחיקה` / `ביטול`), button `טריפ חדש`, empty state `עוד אין טריפים - צרו את הראשון`. Toasts on save/delete/warning.
- [ ] **Step 4:** Dialog: `כותרת` Input (placeholder `לדוגמה: דון טוליבר והקלאסיקר`), events picker (Popover + Command, debounced 300 ms `searchTripEvents`, items `name` over `DD/MM/YY · place`, max 3, picked chips with ×), `סדר` number, `פעיל` Switch, `שמירה` / `ביטול`; client-validate with `validateItineraryRoute` before the action; field errors under fields (`role="alert"`).
- [ ] **Step 5:** nav label + guide section; `npx tsc --noEmit` no new errors; `npx tsx scripts/guide-selftest.ts` passes; `npm run build` green (no dev server on this checkout during it).
- [ ] **Step 6: Commit** (paths only) `feat(trips): a "טריפים" tab under Events to build and title Euro Trips`.

---

## Final verification (controller)

Whole-branch review, then a browser walk on the worktree dev server (`euro-trip-dev`, port 3200) per the spec's "Done means". The hold button is never pressed.
