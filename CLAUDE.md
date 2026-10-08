# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **✅ CONTENTFUL RETIRED (Phase 3 done, 2026-07-22).**
> All CMS content (artists, football teams, blog, categories) lives in Supabase
> tables managed by the backoffice under **Templates** (תבניות); the readers
> (`lib/cms/people.ts`, `lib/blog.ts`) are Supabase-only. The Contentful SDK,
> client, fallback branches, `*Fields` types, and migration scripts were
> removed. Coverage verified pre-removal (52 artists / all teams / 4 blog; the
> only Contentful-only entries were an intentionally deleted team and a
> superseded duplicate). `@contentful/rich-text-react-renderer` stays - it
> renders the rich-text JSON documents stored in Supabase columns. Pre-migration
> rows keep their old Contentful entry id as `slug`; that's just a string.
> `CONTENTFUL_*` env vars are unused - safe to delete locally and on Vercel.

> **Coupons - per-person (2026-09-11).** `coupons.per_person` (backoffice
> migration) makes a FIXED coupon multiply by the ticket count, like the
> follower discount on a tracking link; percent coupons ignore it and every
> pre-existing coupon stays per order. Read in `lib/coupons.ts`, returned by
> `/api/coupons/validate` as `perPerson`, applied by `getCouponDiscountUsd`
> (client + `confirm-order`) and the price-floor guard. The backoffice builds
> one such coupon per influencer (`influencer_partner_code`, code like
> `AVIRAN30`) whose `partner_tracking_code` attributes the order.
> **Coupons and partner links don't mix (2026-09-16):** a visit through an
> agent/affiliate link (`useFetchAffiliate` type, or the `myt_utm`
> influencer primary) hides the coupon field in `OrderReview`, and
> `confirm-order` rejects a coupon on such a visit (`partnerLinkCode`,
> `COUPON_INVALID`). Attribution order: influencer cookie → coupon's
> partner → client-sent code.

> **⚠️ `/agent` AREA DEPRECATED - partner self-service moved BACK to the
> backoffice (2026-08-02).** Decision reversed: myt-main is for customers;
> carrying the partner area here bloats and slows it. Agents/affiliates use
> the backoffice's `/portal` (dashboard, links, credit, coupons, reservations,
> quotes, and the prepared-package live-link builder). **Leave the `/agent`
> pages, `lib/agent-*-actions`, and `lib/partner-auth` as they are - do NOT
> build on them; they are slated for removal in a future cleanup.**
> Three pieces are genuinely customer-facing and STAY live here permanently:
>
> 1. `app/api/package/[id]` - resolves `?pkg={share_token}` links (now created
>    from the backoffice portal) against live data.
> 2. `confirm-order`/`payment` agent settlement (`partner_settlement_method`,
>    `agent_card_discount_ils`, voucher flow) - runs inside customer checkout.
> 3. `utm_source` affiliate tracking + the funnel writes.

> **Ready package ("חבילה מוכנה", 2026-10-04; spec in the backoffice,
> `docs/superpowers/specs/2026-10-04-ready-package-design.md`).** An event can
> carry ONE house-built package (ticket + flight + hotel), built and re-priced in
> the backoffice: `events.ready_package_token` / `ready_package_mode` (`off` |
> `preview` | `live`) / `ready_package_price_usd`, and a `kind = 'house'` row of
> `prepared_packages` holding one composition per party size (`variants`).
> `lib/events/readyPackage.ts` (pure, `lib/__tests__/readyPackage.test.ts`)
> decides which token a page load opens: `live` = every plain visit to
> `/order/{id}`, `preview` = only the staff link `?ready=<token>`; `?orderId` /
> `?pkg` always win and `?build=1` forces the regular flow.
> `useHandlePreparedPackage(event)` loads it through the SAME
> `/api/package/[id]` route (house branch: served only while its event still
> points at it and the mode is not off; `?pax=N` picks the variant; the answer
> adds `house`, `pax_options`, `hotel_image`) and sets `readyPackage` in
> `OrderContext`. The summary (`OrderReview`) then draws
> `components/order/ReadyPackageShowcase` in place of `<Review>` - three cards
> (flight / hotel / ticket), a traveller picker over the priced sizes
> (`useReadyPackagePax`), a quiet "החלפה" per card that opens the regular step
> and returns. Price summary, coupon, traveller form, payment and
> `confirm-order` are untouched; the order draft treats such a load like a
> `?pkg` link. In `live`, `computePackagePrice` returns the package's price so
> the card and the landing agree. A partner's `?pkg` link and every event in
> `off` behave exactly as before.
> **It is a LANDING page (Alon's QA, 2026-10-06).** The customer's first page,
> so in `OrderReview` - all behind `readyPackage`, the regular summary keeps its
> classes: no "כמעט שם" popup (`openModal` starts false), no 15-minute countdown
> (neither `Timer` is mounted; `MobileHeader showTimer`), and on desktop a
> one-pager - a narrow column (travellers, total, terms, pay button, trust)
> beside the wide package, done by showing the column's "mobile" terms / pay
> blocks on every width and hiding the summary column's desktop ones. The
> package view says how many each piece holds and names the hotel's rooms
> (`roomsLabel` over `hotel.guests`), draws the flight with `FlightMeta`, the
> hotel photo beside its details, and the venue map with the ticket's zone
> painted (`TixstockDynamicMap`, one listing). **Swap per piece:** the route
> answers `swap = { ticket, flight, hotel }` (`swapOf(spec, allow_edit)`) and
> "החלפה" shows only on an open piece. **No limit of its own:**
> `READY_MAX_TRAVELERS_CAP` = 9 = the ticket step's `MAX_TICKETS`. **The ticket
> step's rules still run** (`app/hooks/useReadyTicketLive.ts`): the package's one
> ticket goes through `priceTicketsForQuantity` with the same three live calls
> (TixStock / LiveTickets / own stock) on landing and after every traveller
> change - the order gets the live price and the supplier (`toOrderTicket`,
> exported from `TicketSelection` with `TX_FALLBACK_MULTIPLIER`); a size the
> supplier cannot sell leaves the picker (`blockedPax`, `notice`) and the
> package moves to the nearest one; none left = the regular flow on step 1. A
> package ticket is "unchecked" while it has no `supplier` - a ticket the
> customer picked in the ticket step always has one and is never touched.
>
> **A swap always comes back to the summary (2026-10-07).** "החלפה" arms
> `returnToSummary` and opens the step; confirming it returns to the package. The
> one way out was the ticket step's quantity `+/-`: it wipes the flight and the
> hotel (they are priced per party), so the customer was walked through the
> regular flight → hotel steps. During a package swap the quantity is now LOCKED
> (`quantityLocked = !!readyPackage && returnToSummary` in `TicketSelection`,
> `EventTicketCard quantityLockedNote`: the count and "מספר הנוסעים משתנה בסיכום
> החבילה", no buttons, no one-tap quantity rescue) - the party size belongs to the
> package's picker, which knows which sizes exist.
> **Layout uses the screen (2026-10-07).** The landing was 1,150px wide whatever
> the screen. Now `main` runs to 1680px for a ready package (`OrderForm` wrapper
> 1760px, `Stepper wide` so the logo keeps to the edge), the narrow column is
> `clamp(340px, 27vw, 430px)` and the package takes the rest. Below 1024px it is
> ONE column, package first (two columns at 768px squeezed the cards to 390px).
> Inside the package (`ReadyPackageShowcase`, viewport variants - Tailwind 3 here
> has no container queries): flight legs side by side from 768px; from 1360px the
> event sits beside the traveller picker and the hotel beside the ticket, each
> with its picture on top taking the row's height (no empty band under the text).
> Every class is behind `readyPackage`; the regular summary's are byte-identical.
> **Second pass (2026-10-07, evening).** (a) From **1536px** the three pieces
> stand in ONE row - flight (legs stacked), hotel, ticket - so the whole package
> is on screen at once (1920px: the package was 1,210px tall, now 785px); the
> package is then shorter than the travellers column, so the three promises
> (`TRUST_ITEMS`) print in a row under it and the copy in the narrow column hides
> (`min-[1536px]:hidden`). Between 1360px and 1535px the hotel photo is a band of
> a fixed height (210px) and the map box takes what is left - a photo that grew
> with the row made both cards a screen tall. (b) **A swap opens on what the order
> holds**, package swaps only: the ticket step keeps the order's ticket selected
> (`heldTicketIdRef` - it used to open on the cheapest, so a second "החלפה" undid
> the first), the flight step searches the flight's own dates and keeps it
> (`resumeFlightRef` takes the order's flight), the step heading says "בחרו
> קטגוריה אחרת" while the quantity is locked, and a save goes straight back - no
> "מרכיבים את החבילה" animation (`isFinalStep` is false during a package swap; the
> hotel step held the customer 2.2s on it). (c) **The hotel step** opened on the
> cheapest hotel's cheapest rate and committed it at once - a hotel swap saved
> with nothing touched lost the package's rate (measured: breakfast gone, -$77 a
> person). In a package swap it now opens on the package's own STAY
> (`heldHotelRef` in `HotelSelection`: its dates and its ROOMS - a party of three
> in a twin and a single is searched as 2 + 1, not as one triple; when the list
> in hand is another stay's, the package's is asked for once and
> `prepareHotelData` touches nothing of the order until it answers), selects the
> package's hotel on its own rate (`packageRate`: same board first - a promised
> breakfast is never dropped - then the closest room) and puts that hotel first
> in the list with that rate first on its card (`heldPick`; a selected
> `HotelCard` commits its first rate, so that is the rate that stays). It ends
> when the customer filters, sorts, searches again, changes rooms or leaves the
> single list; a hotel no longer in the results falls back to the ordinary pick.
> **Trap met on the way:** `HotelFetchProvider` hands out a NEW `hotelsData`
> object on every render - never put it in a memo's deps (use the list inside,
> `hotelsData.data.data.hotels`, which is state): a memo that re-made a card's
> `rates` each render looped through the card's commit effect ("Maximum update
> depth exceeded").
> **Third pass (2026-10-08, Alon's sketch after his QA walk).** (a) **One price
> on the page.** The traveller picker is its own component (`ReadyPaxPicker`,
> exported beside `ReadyPackageShowcase`) and prints the package's ONE price -
> the total leads, the price per person beside it. From 1024px it opens the
> narrow column, above the travellers' form it sizes (`OrderReview`, a `Card`
> with `order-first hidden lg:block`); below 1024px it opens the package
> (`lg:hidden` inside the showcase) - two instances, one visible, so a test
> clicks `button[aria-label="עוד נוסעים"]:visible`. The separate total card
> (`PriceSummary`) is gone for a ready package - two totals on one screen read
> as two prices - and with it the struck-through "before" price; the card logos
> moved under the pay button. (b) The **coupon row** is one const (`couponRow`)
> printed in one of two places: inside the picker's card from 1024px (beside the
> price it changes), at the foot of the package below that; every other summary
> keeps it exactly where it was. (c) A quiet "התנאים ומדיניות הביטולים" link at
> the head of the package (`headerAside`, opens `/cancellation` in a new tab;
> the tick box beside the pay button still opens the full terms). (d) The three
> promises stand under the package from 1024px (one row from 1200px), no longer
> in the narrow column. (e) **The travellers' form follows the picker**: it was
> sized once, when the summary mounted, so 3 travellers still got two rows (the
> regular flow never changes the party on this step). An effect on
> `passengerCount`, for a ready package only, keeps the rows typed so far, drops
> extra ones and adds blank ones - and gives `validationErrors` a row per
> traveller (`isFormValidForAction` reads `validationErrors[i]`).

> **✅ PARTNER AUTH OVERHAUL - `/agent` (2026-07-30).** The plaintext-password,
> React-state-only "auth" is retired. `/agent` (search, and everything future
> partner-facing work lands under) sits behind a real Supabase Auth session -
> HMAC-signed cookie, verified in `middleware.ts` and re-checked against the
> live `user_profiles` row on every request, so a deactivated or demoted
> partner can't keep riding an old cookie. `app/api/affiliate/login/route.ts`,
> `app/hooks/AuthContext.tsx`, and the old `/partner`(`/login`) pages are gone -
> `/partner*` now just redirects into `/agent*` for old links. `GET
/api/affiliate/stats` is fixed alongside it: it now 404s unless the caller's
> session matches the requested `affiliateId`. See `lib/partner-auth/`.
>
> **🔒 TODO - SECURITY HARDENING, still open:**
>
> - **`/api/affiliate/checkCode` still unauthenticated by design** - it backs
>   the live customer order flow (`app/order/hooks.tsx`) for anonymous
>   visitors carrying a `?utm_source=`/`?aff=` code in `localStorage`, so it
>   can't require a partner session without breaking real checkouts. It does
>   still return a guessed agent's raw `commission` %, which is more than a
>   stranger needs to see a discount - narrowing that safely needs the
>   client-side print-price feature reworked first, not just the route.
> - **Auto-created partner passwords are still guessable.** Every order
>   auto-creates a `partners` row with a `<code>_pass` password
>   (`app/api/confirm-order/route.ts`). Unused by `/agent` (that's Supabase
>   Auth now), but the column and the weak scheme are still there. Backoffice
>   admins still share one hardcoded env credential. Candidate approach + file
>   refs in Claude memory (`auth-user-management-todo`).
> - **Order-read still keyed by sequential id** - move to an unguessable per-order token.
> - **Revalidation secret in URL** (`/api/revalidate`, `/api/hotels`) - move to a
>   header + rotate (cross-project: backoffice calls these).
> - **No rate limiting** on `/api/confirm-order` (inventory-exhaustion / inbox flood).

> **Multi-supplier events (2026-09-18, pilot).** One event page can sell
> tickets from several suppliers. The supplier lives ON THE TICKET
> (`EventTicket.supplier`, values in `lib/suppliers.ts`; absent = implied by
> `event.type` exactly as before), `eid` is the event id AT that supplier.
> `lib/supplier-offers.ts` prices every ticket by ITS OWN supplier only:
> TixStock by normalized category among TixStock tickets, LiveTickets by
> category id via `GET /api/livetickets/tickets?eid=` (`lib/livetickets.ts`,
> read-only, ~90s server cache, instant-confirm categories only). A supplier
> that is down sells on the buffered DB price; the other stays live. One price
> formula for all live suppliers: `lib/supplier-pricing.ts`.
> **Zones + our own map:** suppliers slice a stadium differently, so tickets
> carry our `zoneId`/`zoneLabel` (set in the backoffice event editor,
> "Suppliers & zones"). The map is OUR copy of the SVG (Supabase
> `public_resources/venue-maps/<id>/map.svg`) with `data-zones` on every
> section; `lib/tixstock-map.ts` matches a zoned ticket by zone, never by a
> supplier's category name. Maps without `data-zones` keep the legacy name
> matching. The customer sees the zone label; the order keeps `supplier`,
> `supplier_event_id`, `supplier_category` for ops. `confirm-order` re-checks a
> LiveTickets ticket live (`validateLiveTicketsOffer`). Attaching a supplier is
> always manual in the backoffice - nothing auto-matches. Tests:
> `npx tsx lib/__tests__/supplier-offers.test.ts`. Pilot: hidden `is_test`
> event 1130 (clone of 707).

## Always-on rules (auto-loaded)

Tech standards:
@.claude/rules/standards/typescript.md
@.claude/rules/standards/react.md
@.claude/rules/standards/nextjs.md
@.claude/rules/standards/supabase.md

MYT domain rules:
@.claude/rules/pricing.md
@.claude/rules/order-flow.md
@.claude/rules/cross-project.md
@.claude/rules/conventions.md

> **⚠ IMPORTANT: This project is part of a two-project platform.**
> The sibling project `../MYT-backoffice-app` is the admin dashboard that manages the data this app displays.
> See `../CLAUDE.md` for the full system architecture and shared database schema.
> **Any change to events, types, API routes, or database tables may require changes in the backoffice too.**

## Project Overview

**Mega Events** (מגה איבנטס) - an Israeli event booking platform by Mega Tourism. Users build custom packages for international music and sports events: tickets + flights + hotels. The site is Hebrew/RTL with `lang="he"`.

## Commands

```bash
yarn dev        # Start development server
yarn build      # Production build
yarn start      # Start production server
yarn lint       # ESLint
```

No test runner is configured yet (no test script in `package.json`).

**Build gotchas:**

- Uses **yarn**. If `yarn` missing on PATH: `corepack enable && corepack prepare yarn@stable --activate`. Fresh checkout: `yarn install` first (`node_modules` not committed).
- yarn may auto-migrate to v4 on install (rewrites `yarn.lock`, adds `.yarnrc.yml`) - `git restore yarn.lock && rm .yarnrc.yml` if you only meant to build.
- `yarn build` needs `.env.local` or fails at "Collecting page data" with `Error: supabaseUrl is required`. Compile + typecheck run _before_ that step, so this error still confirms the code is type-valid.

## Deployment (Vercel)

- Vercel team `mega-events`, project **`mega-events-platform`**. Deploys from `origin` = **`megaevents1991/myt-main`** (cut over from `giladlesh/MYT` on 2026-06-10).
- Production branch: `main`. Primary domain: `www.mega-events.co.il` (apex 308→www).
- Branch `mondial` auto-deploys to `mondial2026.mega-events.co.il` - keep that branch alive.
- No `vercel.json`; all build/env/domain config is dashboard-managed.

## Environment Variables

Required in `.env.local`:

- `NEXT_SECRET_SUPABASE_URL` / `NEXT_SECRET_SUPABASE_SERVICE_KEY` - Supabase (event/order DB)
- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` - Amadeus flight search
- `EMERGING_TRAVEL_API_KEY` / `EMERGING_TRAVEL_API_SECRET` - Hotel search (Ratehawk/WorldOTA)
- `CONTENTFUL_SPACE_ID` / `CONTENTFUL_ACCESS_TOKEN` - CMS for artist/football team pages
- `NEXT_SECRET_CG_*` - CreditGuard payment gateway
- `NEXT_SECRET_XS2EVENT_API_KEY` / `NEXT_SECRET_XS2EVENT_API_URL` - XS2Event ticket vendor
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox maps
- `NEXT_PUBLIC_GTM` - Google Tag Manager
- `NEXT_PUBLIC_MIXPANEL_TOKEN` - Mixpanel analytics
- `NEXT_SECRET_SESSION_SECRET` - **Required for the `/agent` partner area.** Signs the
  partner session cookie (HMAC-SHA256). Unset → nobody can sign in and every partner
  session fails closed. Rotating it invalidates all outstanding partner sessions, and
  because middleware runs on the Edge the value is inlined at build time - rotating on
  Vercel needs a redeploy, not just a restart.
- `NEXT_SECRET_SUPABASE_ANON_KEY` - **Required for the `/agent` partner area.** Partner
  sign-in verifies the password through Supabase Auth with the anon key; the service key
  cannot do `signInWithPassword`. Server-side only - never expose it as `NEXT_PUBLIC_`.
- `NEXT_SECRET_PARTNER_PORTAL_URL` - Optional. Full https URL of the partner portal in the
  backoffice (`…/portal`). When set, the header's "סוכן · שם" badge links back to it
  (`/api/partner-session` hands it only to a connected agent, so the backoffice address
  never ships in the public bundle). There is deliberately NO partner login on this site
  (Dor, 2026-09-18): partners sign in to the portal only and arrive here through its
  "לאתר" button / `/api/partner-handoff`.
- `CANCELLATION_REQUEST_EMAIL` - Ops inbox for `/cancel-order` cancellation requests
  (`lib/cancellation-request-actions.ts`). Optional - falls back to `SALES_REP_EMAIL`.
- `NEXT_SECRET_LIVE_API_URL` / `NEXT_SECRET_LIVE_API_KEY` - LiveTickets (doctorticket) API, same values as the backoffice. Needed for live pricing of `supplier: "livetickets"` tickets; unset = those tickets sell on the buffered DB price.
- `NEXT_PUBLIC_MARKUP` - Price markup (currently 175)
- `NEXT_PUBLIC_TX_FALLBACK_BUFFER_PCT` - Safety buffer % added to the static DB price for `tx_event` tickets **only when live TixStock pricing is unavailable** (default 15). Prevents selling below the live price during a TX outage. Applied in `app/order/TicketSelection.tsx`.
- `NEXT_PUBLIC_API_URL` - Base URL for internal API calls

## Meta Product Feed

- `GET /feeds/meta-catalog.xml` - public RSS 2.0 catalog feed Meta fetches hourly (one item per
  `/order/{id}`; sold-out marked `out of stock`, never deleted; World Cup 2026 items link to the
  mondial subdomain). `GET /feeds/meta-catalog.csv` - same rows as CSV. Built live in
  `lib/feed/feedData.ts` + serialized by `lib/feed/metaCatalog.ts` (pure - test:
  `npx tsx lib/feed/__tests__/metaCatalog.test.ts`).
- `/product-feed` - internal admin page (counts, preview, CSV export). Gated by the SAME
  Supabase-Auth Google SSO + `user_profiles` staff roles as the backoffice (`lib/feed/feedAuth.ts`,
  routes under `app/api/feed-auth/`). Requires this app's callback URL
  (`https://www.mega-events.co.il/api/feed-auth/callback`) in the Supabase Auth redirect allowlist.
  Every dropped event is listed with WHAT is missing and WHAT gets it in, plus a link to its
  backoffice editor - `lib/feed/skipExplain.ts` (pure, `lib/__tests__/feedSkipExplain.test.ts`).
  "No campaign creative" is told apart by the backoffice generator's footprints on the row:
  `campaign_skip_reason` (it refused, or crashed - the text says which) vs no
  `campaign_input_hash` (never reached yet - the creatives cron handles never-rendered events
  first; the editor's "העלה לפיד עכשיו" does one now).
- `product_type` = the `categories` tree path (deepest linked category, root-first).
  `custom_label_0-4` = vertical / league\|genre / team\|artist / city / availability -
  one scheme shared by both feeds, built by `buildCustomLabels` in
  `lib/feed/metaCatalog.ts` from typed `event_tags` (`EventTag.type`) with
  category-path/CMS-hint fallbacks for vertical and IATA fallback for city
  (spec 2026-08-12).
- **Ticket-only events in the feeds (2026-10-06).** Everything follows the event's own
  `package_mode` - nothing is tagged by hand, so a future ticket-only event is right by
  itself. Title ends with "כרטיס בלבד" (`TICKET_ONLY_SUFFIX`; a concert's "טיסה+מלון+כרטיס"
  suffix is for packages only) and names the event city alone (no "טיסה ל...").
  **It stays in the same catalog and the same ad sets** (Dor 06.10: everything goes up by
  itself, a ticket-only event just gets its own post): the `custom_label`s do not move,
  `custom_label_4` stays availability alone - never put the mode there, a set filtering
  `available` would lose the event. The commerce feed only ADDS the internal label
  `ticket-only`. Price = ticket +
  `ticket_only_markup`, also for a sold-out row (`feedPriceUSD`). The PICTURE is drawn by
  the backoffice (`lib/creative/auto.ts`), which prices it with `siteCardPrice` - a mirror
  of `computePackagePrice` here. **A new branch in `computePackagePrice` must be mirrored
  there**, or the ad's picture and its price field disagree (until 06.10 a ticket-only
  picture said ticket + 175 while the site charged ticket + its markup).
- Middleware skips `/feeds/` so the routes' own `Cache-Control` applies.

## Architecture

### Tech Stack

Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + Mantine UI + shadcn/ui (Radix primitives).

### Data Flow: Order Context

The core ordering flow lives under `/app/order/[eventId]`. The `app/order/layout.tsx` wraps everything in `OrderContext` (defined in `app/app.context.ts`), which holds the entire multi-step order state in client-side React state:

1. **Step 1 – Ticket Selection** (`TicketSelection.tsx`)
2. **Step 2 – Flight Selection** (`FlightSelection.tsx`) - calls `/api/flights/search`
3. **Step 3 – Hotel Selection** (`HotelSelection.tsx`) - skipped for US events; calls `/api/hotels`
4. **Step 4 – Order Review + Payment** (`OrderReview.tsx`) - submits to `/api/confirm-order`, then `/api/payment`

**The hotel supplier takes 10 searches a minute - for the whole account (2026-10-07).** RateHawk
limits `serp/geo` to 10 a clock minute; past it, it answers 429 `endpoint_exceeded_limit` and
names the second its next window opens. The backoffice's hotel reads share the same ten. Two
rules follow, and both were broken until then (18 of 1,224 customer searches failed in a day,
14 of them in 75 seconds when eleven people landed from one ad):
- **A search is spent only on a customer who is past the ticket step.** `OrderForm`'s hotel
  preload fires at `step >= 2`, not on arrival: 733 of 766 visitors fired a search within 3
  seconds of opening the page, and 54% of them never left the ticket step. Landings that open
  past it (ready package, package link, restored order) still search at once. Never start a
  hotel search from something every visitor does.
- **A refused search waits for the window, it does not fail.** `/api/hotels` POST goes through
  `withinSupplierLimit` (`lib/hotels/supplierLimit.ts`, tests `lib/__tests__/hotelSupplierLimit.test.ts`):
  it waits until the supplier's own reset time (1-27 s in that burst), up to two windows, then
  answers **429** `{ busy: true }` - never 500 for the limit. The GET (backoffice pricing reads)
  does not wait: its callers have their own timeouts and next run. Any other supplier failure
  fails at once, as before.

State flows up through `OrderContext`: event, selected ticket, flight, hotel, passenger info, number of travelers. The `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`) handles hotel fetching separately from render.

**A refresh keeps the order (order draft, 2026-10-01).** That state used to live in React
only, so F5 - or a phone dropping a background tab - sent the customer back to step 1 with
nothing. `app/order/layout.tsx` now mirrors it into `sessionStorage` (this browser tab only)
and reads it back when the event lands. Rules are pure in `lib/order/draft.ts`
(`lib/__tests__/orderDraft.test.ts`), storage calls in `lib/order/draftStorage.ts`:

- Key `myt:order-draft:<eventId>`, 30 min from the last save (`ORDER_DRAFT_TTL_MS`), versioned
  (`ORDER_DRAFT_VERSION` - bump it when the stored shape changes; an old draft is ignored).
- `resumeOrder` decides what may come back: the ticket must still be on sale on the event, a
  departed flight / a hotel whose check-in passed / a broken split are dropped, and the step
  never runs ahead of the order (no flight -> flight step at most, no hotel -> hotel step at
  most). A draft is never a price promise - `confirm-order` re-checks everything as before.
- Restored in an EFFECT (never an initial state: the first render must match the server's
  step-1 HTML), in the layout, so it runs after the ticket step's own auto-select.
- Steps 1-2 re-run their search and pick a default when they mount; `orderResume` (context)
  hands them the customer's own pick for that step only - the ticket (`TicketSelection`), and
  the flight's dates + the same itinerary in the fresh search (`FlightSelection`,
  `sameFlight`). The hotel step keeps everything before it and a split stay; a hand-picked
  single hotel goes back to the recommended one.
- On the hotel step / the summary `OrderForm` runs the hotel search for the restored flight's
  dates (the mount preload is skipped then - one search, not three).
- The summary's passenger form, terms tick and applied coupon are a second key
  (`myt:order-form:<eventId>`, written by `OrderReview`); they also survive an edit of another
  step. The coupon is validated again, never trusted from storage.
- `?orderId` / `?pkg` links own their composition: nothing is restored over them or recorded
  (`ownedByLink`); the passenger form is still remembered on a `?pkg` visit.
- Cleared when the order goes through (`closeOrderDraft`) and when the summary's 15-minute
  hold runs out (`forgetOrderDraft` - the travellers stay).

A new piece of order state that a refresh should keep goes into `OrderDraftState`, the
layout's save / restore, and `parseOrderDraft`.

**Lists keep their view too (2026-10-01).** Filters, sort and "show more" counts lived in
`useState`, so F5 - or Back from a package - reopened the unfiltered first page. They are
mirrored into `sessionStorage` under `myt:view:<pathname>:<name>` (`lib/viewState.ts`, pure
parsers + `lib/__tests__/viewState.test.ts`): `CategoryEventsBrowser` (every `/c/` hub - search,
city, months, dates, price cap, sort, tags, "הצג עוד"; `fitBrowserView` drops a city / month /
tag the page no longer offers), `HomeAwayEvents` (picked fixture kind), `ArtistEventsFilter`
(sort - `stateKey` per list on a page with several) and the homepage's "הצג עוד אירועים".
For a single value use `app/hooks/useSessionState.ts` (a `useState` drop-in). Two rules: the
first render always uses the default (these pages are server-rendered - the stored value is
applied right after hydration), and never the URL (ISR pages: `useSearchParams` needs a
Suspense boundary around the list, reading `searchParams` on the server makes the page
dynamic). `/search` keeps its own URL sync. Scroll position is NOT restored - `app/layout.tsx`
sets `history.scrollRestoration = 'manual'` on purpose.

### ISR Strategy

Order pages (`/app/order/[eventId]/page.tsx`) use ISR:

- `revalidate = 3600` (1 hour)
- `dynamicParams = true` (on-demand rendering for new events)
- `generateStaticParams` pre-builds pages for events with available tickets
- Events are fetched and cached via `lib/eventsData.ts` using `next/cache` with the `events` tag

To invalidate the events cache manually: call `/api/revalidate` with the secret (`NEXT_SECRET_REVALIDATION_SECRET`).

**Two cache tags, two switches (2026-10-07).** `events` is on everything the backoffice
refreshes at once: the catalog, the menu, the fallback pictures, the logo library. The root
layout reads the menu, so EVERY page carries `events` - dropping it re-renders the whole
site. Only `/api/revalidate` (the backoffice) does that. `events-catalog` (`CATALOG_TAG`,
`lib/events/catalogParts.ts`) is on the catalog alone.
A customer route that writes a fresher price to one event (`/api/tixstock/tickets`, on a
visitor's ticket step) calls `invalidateAfterLivePriceSync` (`lib/events/livePriceInvalidation.ts`):
that event's order page always; the catalog tag + the `/c/` tree (category pages read their
events themselves) only when the cheapest ticket on sale moved - the one ticket price a card
shows (`cheapestAvailableTicketPrice`, `lib/events/price.ts`). Until then the route dropped
`events` on every write, 340 times a day: 61% of order-page views and half of category-page
views were re-renders (0.4 s / 1.3 s against 0.06 s / 0.1 s cached), and it pinged the old
`mondial` branch deployment, which pulled the whole events table each time.
**Never drop `events` from a customer route.** Most of those writes were not the market: the
backoffice's TixStock price sync (4 times a day) priced without the 3.5% this route adds, so
the first visitor after each sync wrote every price back up, and it priced any listing with
two seats while this route drops restricted-view listings, excluded sections and listings
that cannot sell a pair. Since 2026-10-07 the sync uses this route's formula
(`tixstockTicketPriceUsd`) and its three listing rules, mirrored in the backoffice's
`lib/tixstock-listings.ts`. **Change a listing rule here (`lib/tixstock-quantity.ts`, the two
filters in the route, `categoryMatchesMapId`) and change it there**, or the two drift again.

### Key Directories

- `app/` - Next.js pages and API routes
  - `app/api/flights/` - Amadeus flight search and pricing
  - `app/api/hotels/` - Ratehawk hotel search
  - `app/api/confirm-order/` - Saves order to Supabase, sends confirmation email
  - `app/api/payment/` - CreditGuard payment integration
  - `app/hooks/` - React context providers (`AuthContext`, `HotelFetch.provider`, `useOrderExpiry`, etc.)
- `components/` - Shared React components; `components/ui/` for design-system primitives
- `lib/` - Shared types (`app.types.ts`), utilities, and service modules
  - `lib/eventsData.ts` - Supabase event queries with ISR caching
  - `lib/exchangeRateService.ts` - USD/ILS and EUR/USD exchange rates
  - `lib/tixstock-map.ts` - Tixstock seat map data

### External Ticket Vendors

Events have a `type` field that determines ticket source:

- `sports_event` / `music_event` - static tickets stored in Supabase `tickets_and_rates`
- `sports_event_dynamic` / `music_live_event_dynamic` - dynamic tickets from XS2Event API
- `tx_event` - Tixstock tickets with interactive seat map (`TixstockDynamicMap.tsx`)

### Middleware

`middleware.ts` runs on all non-static routes:

- Sets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on HTML pages

### Pricing

Prices are in USD internally. The frontend converts to ILS using the exchange rate from `exchangeRateService.ts`. `NEXT_PUBLIC_MARKUP` (default 175 ILS) is added to the total. Price utilities are in `lib/price.utils.tsx`.

### Analytics

- **Mixpanel**: initialized in `app/hooks/Mixpanel.tsx`, helpers in `lib/mixpanel.ts`
- **GTM/GA**: `lib/gtmAnalytics.ts` pushes events to `dataLayer`
- **Affiliate tracking**: `app/hooks/Affiliate.tsx` tracks conversion stages in Supabase

### CMS (Contentful)

Artist and football team detail pages (`/app/artists/[id]`, `/app/football/[id]`) are CMS-driven via Contentful. Types are defined in `lib/app.types.ts` (`ArtistFields`, `FootballFields`). The Contentful client is in `lib/contentful.ts`.

---

## Connection to Backoffice (`../myt---backoffice`)

### How They're Connected

Both projects share the **same Supabase database**. The backoffice syncs external event providers and writes event data; this app reads it and serves it to customers. The backoffice also calls this app's API routes directly.

### API Routes the Backoffice Calls (Do NOT Change Without Updating Backoffice)

1. `GET /api/hotels` - Hotel search (params: `lat`, `lon`, `checkin`, `checkout`, `secret`)
2. `GET /api/revalidate` - ISR cache invalidation (param: `secret=secretAlonOnDemand`)
3. `GET /api/flights/search` - Flight search for backoffice admin preview

### Shared Database Tables

| Table          | This App               | Backoffice                     |
| -------------- | ---------------------- | ------------------------------ |
| `events`       | Reads                  | Creates, updates, soft-deletes |
| `reservations` | Creates (on booking)   | Reads (dashboard)              |
| `partners`     | Reads (affiliate auth) | Creates, manages               |
| `hotels`       | Writes (search cache)  | Reads                          |
| `flights`      | Reads                  | Manages (offline inventory)    |
| `homepage_sections` / `homepage_items` | Reads (`lib/homepageLayout.ts`) | Writes (the `/homepage` board) |

**Homepage layout, titles and free blocks (2026-09-18).** The backoffice board
decides the homepage's section order, visibility, the items pinned to the front of
each carousel, every section's heading (`title`; null = the heading coded here) and
the blocks staff add themselves (`type`: `event_slider` - pins, then the events of
`config.category_id`, soonest first, 12 max, same `EventCard size="row"`; `banner` -
`config.banners`, rendered by `ArtistBanners`). Block types + config shapes mirror
backoffice `types/homepage.types.ts`. `getHomepageLayout` never breaks the page: a
row it does not understand (unknown key / block type / config) is skipped, missing
columns fall back to the old select (order kept, no titles or blocks), any other
failure = the default layout. `app/page.tsx` resolves the sliders' events
server-side (`resolveBlockEvents`); `ClientSideHomepage` switches on `section.type`.
A new block type needs code HERE first, then the backoffice editor.
**2026-09-19:** three more types - `text` (`config.body` → plain paragraphs, never
HTML), `destinations` (`config.category_ids` first, then the active children of
`config.parent_id`; `resolveBlockTiles` builds the tiles server-side, drawn by the
football hub's `HubTilesRow`, 24 max) and `gallery` (`config.images`, one scrolling
row, `alt` doubles as the caption). `newest` is the one builtin with a config:
`hidden_event_ids` = events staff removed from the AUTOMATIC fill of "החדשים
ביותר" (`layout.hiddenEventIds.newest`) - a PINNED event is never filtered.

### Shared Types - Keep In Sync!

Types in `lib/app.types.ts` are duplicated in `../myt---backoffice/types/app.types.ts`. These types MUST match:
`Event`, `EventType`, `Flight`, `FlightSegment`, `Order`, `OrderHotel`, `OrderTicket`, `FlightSearchOptions`, `TimeRange`, `AffiliateTracking`, `VipConfig`, `EventTicket`

**Known intentional differences:**

- Backoffice `EventType` has extra value `sports_live_event_dynamic`
- Backoffice `Flight` uses simplified airline metadata

### Price Logic Chain (Spans Both Projects)

1. **Backoffice** sets: `base_flight_price`, `base_hotel_price`, and ticket prices on events (applies currency markups: USD +$40, EUR +€40, GBP +£35, ILS +₪150)
2. **This app** calculates final package: `base_flight_price + base_hotel_price + min_ticket_price + NEXT_PUBLIC_MARKUP (175)`
3. Changing price logic in either project affects what customers pay
