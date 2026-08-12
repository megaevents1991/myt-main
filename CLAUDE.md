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
- `product_type` / `custom_label_0-3` come from the backoffice event taxonomy
  (`event_categories` path + `event_tags` slugs); `custom_label_4` = `available`/`sold_out`.
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

State flows up through `OrderContext`: event, selected ticket, flight, hotel, passenger info, number of travelers. The `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`) handles hotel fetching separately from render.

### ISR Strategy

Order pages (`/app/order/[eventId]/page.tsx`) use ISR:

- `revalidate = 3600` (1 hour)
- `dynamicParams = true` (on-demand rendering for new events)
- `generateStaticParams` pre-builds pages for events with available tickets
- Events are fetched and cached via `lib/eventsData.ts` using `next/cache` with the `events` tag

To invalidate the events cache manually: call `/api/revalidate` with the secret (`NEXT_SECRET_REVALIDATION_SECRET`).

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
