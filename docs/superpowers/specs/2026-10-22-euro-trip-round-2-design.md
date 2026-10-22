# Build Your Euro Trip - round 2 (Alon's notes, 22.10.2026)

Source: Alon's Google Doc "באגים / תיקונים - אלון תום ודור", tab "יורו טריפ בן אדם" (3 sections:
cards, the ready-trip flow, the trip planner). Dor's rulings in chat, 22.10:
1. Card titles: a staff screen in the BACKOFFICE, under **Events**, in its own sub-tab
   ("טריפים"). Staff build a trip (2-3 events) + title + order; staff trips lead the hub.
2. A click on a ready-trip card opens **straight on tickets** - the regular order flow's shape.
3. The planner: **grid + side panel** (desktop: the event grid stays, the trip panel sticks on
   the left; "הוסף אירוע" opens a search popup. Phone: the panel on top, picking only through
   the popup).

Base: branch `feat/multi-event-itinerary` (phase 1, spec `2026-10-21-multi-event-itinerary-design.md`).
Everything in phase 1 stays unless this document replaces it.

## Intent

Alon walked the preview as a customer. The trip flow felt like a new product next to the site's
order flow; he wants it to BE the order flow, with tickets repeated per event. The planner was
"a mess for the eyes"; he wants the trip to fill a side panel as you pick. Staff need to name the
trips they promote ("דון טוליבר והקלאסיקר").

Anti-goals: a third look for the same thing (keep the live flow's pieces - reuse, don't
re-draw); any change a live customer on `/order` can see; extra hotel searches (RateHawk: 10 a
minute for the whole account).

## Global rules (from phase 1, still binding)

- Never edit live files under `app/order/**`, `app/hooks/**`, `components/order/**`,
  `components/ui/**` - import them. **One sanctioned exception:** `components/Header.tsx` (see B1).
- Pricing: one price function (`livePrice` / `progressivePrice`, lib/itinerary/progress.ts);
  anything showing a +/- per person derives from it, never a second formula.
- RateHawk: hotel searches only on the hotels step, sequential, never ahead of it.
- Hebrew RTL, logical sides (`start`/`end`, `ms`/`me`), no `left`/`right`.
- Git: never `git merge`; commit by explicit paths; no AI co-author line; never push (Dor says
  push). Backoffice work is on `master` of `MYT_Git_Shered/myt-backoffice` (other sessions may be
  active there - commit only your own paths).

---

## A. Staff trips ("טריפים") - backoffice + hub

### A1. Table `public.itinerary_routes` (backoffice migration)

| column | type | rule |
|---|---|---|
| `id` | `bigint generated always as identity primary key` | |
| `title` | `text not null` | trimmed length 2..80 (CHECK) |
| `event_ids` | `bigint[] not null` | `array_length(event_ids, 1) between 2 and 3` (CHECK); order = staff order, the site sorts by date anyway |
| `sort_order` | `integer not null default 0` | lower first |
| `is_active` | `boolean not null default true` | off = hidden from the site, kept in the backoffice |
| `created_at` / `updated_at` | `timestamptz not null default now()` | |
| `updated_by` | `uuid` | no FK (like `itinerary_settings`) |

RLS on, no policies, `revoke all ... from anon, authenticated` (service role only). Idempotent
(`if not exists`). Rollback file in `supabase/rollback/`. Migration file name sorts after
`20261021193309`. Rows are deleted for real (a trip is not an event; the audit log keeps it).

### A2. Backoffice screen

- Route `/events/trips` (static segment beats `events/[id]`). A **sub-tab row** at the top of
  both `/events` and `/events/trips`: "אירועים (Events)" | "טריפים (Euro Trip)" - plain links
  styled as the shadcn `TabsList` (the current one marked). `SEGMENT_LABELS.trips = "Euro Trips"`.
- The page lists every trip: title, its events (name · DD/MM/YY · city, in date order), sort
  order, active switch, a status line, Edit, Delete (confirm in-page, no `confirm()`).
- Status line (computed in the backoffice, simple): "לא יוצג באתר: <reason>" when an event is
  deleted, hidden (`is_hidden`), deactivated (`deactivated_reason`), tagged "Sold", in the past,
  or missing; else "מוצג באתר אם כל האירועים עדיין מתאימים זה לזה" (the site re-checks distance
  and dates itself).
- "טריפ חדש" / Edit opens a dialog: title (`Input`), events (a Popover + Command combobox over
  upcoming non-deleted events showing name + DD/MM/YY + city, up to 3 picked, removable chips),
  sort order (number), active (`Switch`). Client-side validation with the same pure validator
  the server action uses.
- Server actions (`lib/actions/itinerary-routes-actions.ts`): `requireStaff()` for read AND
  write (an editor may edit events, so trips too). Validate (title 2..80 trimmed; 2..3 distinct
  positive ids; every id an existing non-deleted event), write, `logAudit`
  (`action: "itinerary.route.create|update|delete"`, `entityType: "itinerary_routes"`), then
  `revalidateItinerary()` (unchanged helper). A missing table answers a Hebrew "הטבלה עוד לא
  קיימת - המיגרציה תעלה עם הדחיפה הבאה" and the page shows an info Alert, never a crash.
- Guide: one section text under `nav: "/events"` (he + en) - what a trip is, that the site
  hides a trip whose events stopped fitting.

### A3. Site: staff trips on the hub

- `lib/itinerary/routes.server.ts`: read active rows (`id, title, event_ids, sort_order`), order
  by `sort_order, id`, `unstable_cache` with tag `ITINERARY_ROUTES_TAG = "itinerary-routes"`
  (revalidate 3600). `getStaffRoutesForPage()`: missing table (`isMissingSettingsTable`-style
  check, code first) => `[]`; any other error => throw (ISR keeps the last good page) - the
  fallback is made outside the cache.
- Pure `lib/itinerary/staffRoutes.ts`:
  - `staffRouteCards(rows, events, settings, todayIso): RouteCardData[]` - a row becomes a card
    only when EVERY id is in the catalog, `isItineraryEligible`, and `fitRoute` accepts all of
    them (nothing refused); the card is `toRouteCard(route, settings)` plus `staffTitle`.
    A row that fails is skipped silently (the backoffice status line explains).
  - `mergeRouteCards(staff, auto): RouteCardData[]` - staff first (their order), then auto cards
    whose sorted id set is not already a staff card.
- `RouteCardData.staffTitle?: string`. `RouteCard` `<h3>` = `staffTitle ?? names` (the `title`
  attribute and aria-label keep the event names). `hubCards` search also matches `staffTitle`.
- `app/euro-trip/page.tsx` merges; `maxAutoRoutes` limits only the auto list (staff trips show
  even at 0).
- `app/api/itinerary/revalidate/route.ts` also `revalidateTag(ITINERARY_ROUTES_TAG)`.

---

## B. Ready-trip flow = the order flow

### B1. Header and stepper

- `components/Header.tsx` hides the global header on `/euro-trip/build` as it does on `/order`
  (the one sanctioned live edit: one condition). The builder page then always draws the live
  `Stepper` (components/ui/Stepper.tsx) as its top bar - logo + steps.
- Steps (labels): `אירוע 1`, `אירוע 2`, [`אירוע 3`], `טיסות`, `מלונות`, `סיום` - one ticket
  step PER EVENT of the route. Pure mapping in `lib/itinerary/flowSteps.ts`:
  `flowSteps(route): string[]`, `stepperIndex(state): number` (1-based for `currentStep`),
  `stepForIndex(i, route): { step: ItineraryStep; activeEvent?: number }`. Clicking a done step
  goes back (live rule: back only).
- On the planner (`step === "build"`) the Stepper is drawn with `hideSteps` (logo only); the
  planner keeps its own title band.
- Under the Stepper: on a ticket step, the live `EventDataHeader` of THAT event inside the live
  band (`bg-muted`, like TicketSelection); on flights / hotels / summary, `TripHeader` (as now).
  `TripHeader` gains a quiet link "עריכת המסלול" -> planner with the same events
  (`setMode("custom")`, `goStep("build")`).
- The tickets step's own per-event tabs go (the stepper is the navigation); the bottom
  `OrderContinueBar` stays as it is.

### B2. Entry

- `?events=` that loads fully (every id fits, `fitRoute` refused nothing, >= 2 events) opens on
  `tickets`, event 1, mode `route`.
- Anything less (an event gone or not fitting, < 2 events) opens the PLANNER (mode `custom`) with
  what fits and the existing notice naming what was dropped.
- `RouteStep` (the route overview + "אפשר לשלב גם") is removed - nothing opens it any more.
- A restored draft (refresh) keeps its own step as today.

### B3. Flight dates (in the flights step)

- Dates move to the flights step. A field in the live flight search-bar look ("ובאיזה
  תאריכים?" + the dates) opens a picker that walks the trip's dates IN ORDER: `טיסה הלוך ל<city>`
  -> each `מעבר ל<city>` -> `חזרה מ<city>`. One calendar (Mantine `DatePicker`), a header naming
  the date being picked, the picked days highlighted, days outside that date's range disabled
  (`tripDateBounds`). A click sets the date and moves to the next; after the last, "עדכון
  הטיסות" commits ONCE (`setDates` - which clears the flight and searches again). Closing
  without committing changes nothing.
- A move the customer makes on their own (train toggle on) is still picked - it is a hotel
  night boundary - labelled `מעבר ל<city> (עצמאית)`.
- Pure `lib/itinerary/datePick.ts`: `datePickSteps(route, dates, train): DatePickStep[]`
  (`{ key: "depart" | <moveKey> | "ret"; label: string; value: string; min: string; max: string }`
  in trip order) and `applyDatePick(route, dates, key, day): TripDates` (sets, then
  `clampTripDates`).

### B4. Train toggle wording

`trainToggleLabel` -> `אגיע עצמאית (N ק״מ)`. Where the summary/flights describe a move the
customer makes alone, the wording is "הגעה עצמאית" instead of "רכבת"/"ברכבת". The train NOTE
(the reminder that it is not included) stays as is - Alon liked it.

### B5. Hotels = the split-stay cards

- The hotels step becomes one vertical list in trip order: per stay, one live `SegmentsList`
  (ONE segment: `{ city: stay.city, checkin, checkout, nights }` from `stayRanges`; `event` =
  `withStayBase(stayEvent(...), range)`; `minPrice` = that event's `base_hotel_price`; `persons`
  = pax) - so its "+$/-$ לכל אורח / כלול במחיר" equals the trip price's hotel rule. Between two
  stays, a line naming the move (date, flight or "הגעה עצמאית").
- On opening the step, every stay without a ready hotel is searched (sequential, one after the
  other, abortable) and gets the DEFAULT pick of the live split stay: cheapest 3-5★ "Hotel" by
  `applyFiltersAndSorting` (meal `withoutMeal`, both cancellation kinds), else the first hotel
  with static info and rates; its cheapest rate. The hotel arrives already chosen.
- "החלפת מלון" opens the live `SegmentHotelModal` with that stay's own search (no new search);
  breakfast add/remove through the exported `withBreakfast` / `withoutBreakfast` /
  `segmentBreakfastOffer`.
- The split-stay closures that are not exported are re-implemented in
  `lib/itinerary/stayHotels.ts`: `searchStayHotels(params, signal)` (`fetchHotels`, one retry
  after 8 s, "answered" rule), `pickDefaultHotel(search)`, `buildStayHotel(stay, cityLabel,
  search, hotel, rate?)` (incl. `breakfast_offer` and `segment_card`).
- A failed stay search shows the live `OrderIssueState` with stay wording ("לא מצאנו מלון
  ב<city> לתאריכים האלה" / "נסו שוב") instead of SegmentsList's split-stay wording.
- Searches are cached per `stay.key|checkin|checkout|pax` while the step lives (kept mounted as
  now); a swap or a return to the step spends nothing.
- Continue: one primary "בחר והמשך לסיכום" once every stay is ready (`stayHotelReady`) - no
  walk stay-by-stay any more.
- Known difference, same as the live split stay: our own hotel stock (`/api/offline-hotels`) is
  not offered in a trip.

### B6. Summary = the order summary's structure

Rebuilt on `OrderReview`'s layout and its presentational pieces (props only, no context):
- `max-w-[1200px]`, `grid gap-4 items-start md:grid-cols-2`. Summary column (`order-1
  md:order-2`): one Card - the `bg-main` header "סיכום הזמנה" with the hold `Timer`; the live
  `PriceSummary` strip (party total, per person, `affDiscount` = the trip's markup discount for
  the party, `isNumberOfPersonsEqual={false}`); then per event: name + place | date, and the
  live `EventSummary`; the flights: every leg with the live `FlightMeta` (+ the independent
  moves); per stay the live `HotelSummary` single path. Each section has its "עריכה" (back to
  that step / event / the hotels step). Then terms (live markup: Checkbox + "התנאים ומדיניות
  הביטולים" Dialog/link), card logos, the CTA.
- Passengers column (`order-2 md:order-1`): the live passengers Card markup ("פרטי הנוסעים",
  "יש להזין שמות כפי שמופיעים בדרכון") holding our `TravellersForm`; the trust card.
- Row figures: "+$X / -$X" per person or "כלול במחיר", each = the picked piece per traveller
  minus that piece's estimate in `progressivePrice`, inside the same ±4 band - so card price +
  rows = total.
- Kept from phase 1: `useTripHold` (the CTA is "שמרו לי ל-24 שעות" while payments are off; the pay
  button only when `settings.paymentsEnabled`), the `attempt()` gate, the 15-minute hold with the
  expired dialog and `releaseHold`, `HoldConfirmation`, failure UIs, `livePrice`.
- Phone: the live `MobileHeader` band (timer) - the steps are `ssr:false`, so its
  `react-device-detect` check is safe here.

---

## C. The planner (self-build)

### C1. Layout

- Desktop (lg+): two columns - the catalog (search, months, kind tabs, NEW city filter, grid) and
  a sticky side panel "הטריפ שלכם" on the inline-END side (left in RTL), `lg:top-24`.
- Phone: the panel on top, full width; the grid is not shown - events are picked through the
  popup only.
- The current top tray and the top day planner go (they live in the panel now).

### C2. The panel (Alon's sketch)

In trip order, filling as events are picked:
`טיסה הלוך ל<city>` (date + the existing day arrows) -> event row (art, name, DD/MM · city, ×) ->
between two events: `מעבר ל<city>` (date + arrows) or `נשארים ב<city>` (same city) -> ... ->
empty slots `N · אירוע ראשון / שני / שלישי (לא חובה)` (dashed, click = popup) -> `חזרה מ<city>`
(date + arrows) -> the CTA.
- Flight and move chips appear on their own once there is an event; their dates follow the
  existing rules (`defaultTripDates`, `tripDateBounds`, `clampTripDates`) - a move can only sit
  between its two events, and an event added before another re-orders the whole panel
  (`sortRoute`).
- CTA: `המשיכו לבחירת כרטיסים` (>= 2 events), with the trip's estimate per traveller under it;
  disabled `בחרו עוד אירוע כדי להמשיך` below 2.

### C3. The popup ("הוסף אירוע")

Mantine `Modal` (full screen below 1024px): search input (focused), filter chips - month,
kind (הכל / כדורגל / הופעות), city - and a result list in the site search's row look (round art,
name, DD/MM/YY · city), WITHOUT the package price. Every row says whether it fits
(`CompatChip`); a fitting row adds the event and closes the popup; a non-fitting row is disabled
with its reason. `CatalogFilter` gains `city` (`catalogCities(catalog)`); the grid's filter row
gets the same city filter.

---

## Done means

- vitest for every new pure module (`flowSteps`, `datePick`, `stayHotels` pure parts,
  `staffRoutes`, catalog city filter); the existing 904 itinerary tests still pass; `npx tsc
  --noEmit` 0; `npx next build` green; backoffice `npx tsc --noEmit` 0 + its selftest + build.
- Browser walk on the worktree dev server: hub (a staff title shows once the table exists -
  else no change), a ready trip opens on אירוע 1, the stepper walks the events, flights date
  picker re-searches once, hotels arrive pre-picked with ±$, swap works without a new search, the
  summary in the live layout, the planner panel + popup on desktop and phone width. The hold
  button is NOT pressed (it writes real rows).
