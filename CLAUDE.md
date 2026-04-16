# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **⚠ IMPORTANT: This project is part of a two-project platform.**
> The sibling project `../myt---backoffice` is the admin dashboard that manages the data this app displays.
> See `../CLAUDE.md` for the full system architecture and shared database schema.
> **Any change to events, types, API routes, or database tables may require changes in the backoffice too.**

## Project Overview

**Mega Events** (מגה איבנטס) — an Israeli event booking platform by Mega Tourism. Users build custom packages for international music and sports events: tickets + flights + hotels. The site is Hebrew/RTL with `lang="he"`.

## Commands

```bash
yarn dev        # Start development server
yarn build      # Production build
yarn start      # Start production server
yarn lint       # ESLint
```

No test runner is configured yet (no test script in `package.json`).

## Environment Variables

Required in `.env.local`:
- `NEXT_SECRET_SUPABASE_URL` / `NEXT_SECRET_SUPABASE_SERVICE_KEY` — Supabase (event/order DB)
- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` — Amadeus flight search
- `EMERGING_TRAVEL_API_KEY` / `EMERGING_TRAVEL_API_SECRET` — Hotel search (Ratehawk/WorldOTA)
- `CONTENTFUL_SPACE_ID` / `CONTENTFUL_ACCESS_TOKEN` — CMS for artist/football team pages
- `NEXT_SECRET_CG_*` — CreditGuard payment gateway
- `NEXT_SECRET_XS2EVENT_API_KEY` / `NEXT_SECRET_XS2EVENT_API_URL` — XS2Event ticket vendor
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox maps
- `NEXT_PUBLIC_GTM` — Google Tag Manager
- `NEXT_PUBLIC_MIXPANEL_TOKEN` — Mixpanel analytics
- `NEXT_PUBLIC_MARKUP` — Price markup (currently 175)
- `NEXT_PUBLIC_API_URL` — Base URL for internal API calls

## Architecture

### Tech Stack
Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS + Mantine UI + shadcn/ui (Radix primitives).

### Data Flow: Order Context

The core ordering flow lives under `/app/order/[eventId]`. The `app/order/layout.tsx` wraps everything in `OrderContext` (defined in `app/app.context.ts`), which holds the entire multi-step order state in client-side React state:

1. **Step 1 – Ticket Selection** (`TicketSelection.tsx`)
2. **Step 2 – Flight Selection** (`FlightSelection.tsx`) — calls `/api/flights/search`
3. **Step 3 – Hotel Selection** (`HotelSelection.tsx`) — skipped for US events; calls `/api/hotels`
4. **Step 4 – Order Review + Payment** (`OrderReview.tsx`) — submits to `/api/confirm-order`, then `/api/payment`

State flows up through `OrderContext`: event, selected ticket, flight, hotel, passenger info, number of travelers. The `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`) handles hotel fetching separately from render.

### ISR Strategy

Order pages (`/app/order/[eventId]/page.tsx`) use ISR:
- `revalidate = 3600` (1 hour)
- `dynamicParams = true` (on-demand rendering for new events)
- `generateStaticParams` pre-builds pages for events with available tickets
- Events are fetched and cached via `lib/eventsData.ts` using `next/cache` with the `events` tag

To invalidate the events cache manually: call `/api/revalidate` with the secret (`NEXT_SECRET_REVALIDATION_SECRET`).

### Key Directories

- `app/` — Next.js pages and API routes
  - `app/api/flights/` — Amadeus flight search and pricing
  - `app/api/hotels/` — Ratehawk hotel search
  - `app/api/confirm-order/` — Saves order to Supabase, sends confirmation email
  - `app/api/payment/` — CreditGuard payment integration
  - `app/hooks/` — React context providers (`AuthContext`, `HotelFetch.provider`, `useOrderExpiry`, etc.)
- `components/` — Shared React components; `components/ui/` for design-system primitives
- `lib/` — Shared types (`app.types.ts`), utilities, and service modules
  - `lib/eventsData.ts` — Supabase event queries with ISR caching
  - `lib/exchangeRateService.ts` — USD/ILS and EUR/USD exchange rates
  - `lib/tixstock-map.ts` — Tixstock seat map data

### External Ticket Vendors

Events have a `type` field that determines ticket source:
- `sports_event` / `music_event` — static tickets stored in Supabase `tickets_and_rates`
- `sports_event_dynamic` / `music_live_event_dynamic` — dynamic tickets from XS2Event API
- `tx_event` — Tixstock tickets with interactive seat map (`TixstockDynamicMap.tsx`)

### Middleware

`middleware.ts` runs on all non-static routes:
- Hard-redirects the legacy Mondial 2026 football page to an external subdomain
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
1. `GET /api/hotels` — Hotel search (params: `lat`, `lon`, `checkin`, `checkout`, `secret`)
2. `GET /api/revalidate` — ISR cache invalidation (param: `secret=secretAlonOnDemand`)
3. `GET /api/flights/search` — Flight search for backoffice admin preview

### Shared Database Tables
| Table | This App | Backoffice |
|-------|----------|------------|
| `events` | Reads | Creates, updates, soft-deletes |
| `reservations` | Creates (on booking) | Reads (dashboard) |
| `partners` | Reads (affiliate auth) | Creates, manages |
| `hotels` | Writes (search cache) | Reads |
| `flights` | Reads | Manages (offline inventory) |

### Shared Types — Keep In Sync!
Types in `lib/app.types.ts` are duplicated in `../myt---backoffice/types/app.types.ts`. These types MUST match:
`Event`, `EventType`, `Flight`, `FlightSegment`, `Order`, `OrderHotel`, `OrderTicket`, `FlightSearchOptions`, `TimeRange`, `AffiliateTracking`, `VipConfig`, `EventTicket`

**Known intentional differences:**
- Backoffice `EventType` has extra value `sports_live_event_dynamic`
- Backoffice `Flight` uses simplified airline metadata

### Price Logic Chain (Spans Both Projects)
1. **Backoffice** sets: `base_flight_price`, `base_hotel_price`, and ticket prices on events (applies currency markups: USD +$40, EUR +€40, GBP +£35, ILS +₪150)
2. **This app** calculates final package: `base_flight_price + base_hotel_price + min_ticket_price + NEXT_PUBLIC_MARKUP (175)`
3. Changing price logic in either project affects what customers pay
