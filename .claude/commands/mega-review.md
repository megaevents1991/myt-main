Review the changed or specified files against Mega Events best practices. Check all of the following:

## 1. Order Flow Integrity
- State must flow through `OrderContext` (`app/app.context.ts`) — never local state that bypasses it
- Steps 1→4 must remain sequential: Ticket → Flight → Hotel (skip for US events) → Review/Payment
- Flight search must go through `/api/flights/search` (Amadeus); hotel through `/api/hotels` (Ratehawk)

## 2. Pricing Rules
- All internal prices are in **USD**
- Frontend conversion to ILS uses `exchangeRateService.ts` — never hardcode rates
- Always add `NEXT_PUBLIC_MARKUP` (175 ILS) to totals — use `lib/price.utils.tsx` helpers

## 3. Ticket Vendor Routing
- Check event `type` field before rendering ticket UI:
  - `sports_event` / `music_event` → static Supabase tickets
  - `sports_event_dynamic` / `music_live_event_dynamic` → XS2Event API
  - `tx_event` → Tixstock with interactive seat map (`TixstockDynamicMap.tsx`)

## 4. ISR / Caching
- Order pages must export `revalidate = 3600` and `dynamicParams = true`
- Event data must use `lib/eventsData.ts` with `next/cache` and the `events` tag
- Never bypass ISR with `no-store` unless it's an API route

## 5. RTL / Hebrew
- All user-facing text must be Hebrew (`lang="he"`)
- Layout must be RTL — check Tailwind direction utilities (`rtl:` prefix) and Mantine RTL config

## 6. Analytics
- Track meaningful user actions via Mixpanel (`lib/mixpanel.ts`)
- Push e-commerce events (ticket/flight/hotel selected, order confirmed) to GTM (`lib/gtmAnalytics.ts`)
- Do not add new analytics libraries — use the existing Mixpanel + GTM setup

## 7. Security
- Never expose `NEXT_SECRET_*` env vars to the client — only `NEXT_PUBLIC_*` vars are safe client-side
- Validate all external API responses (Amadeus, Ratehawk, XS2Event) before passing to context
- No SQL injection risk: always use Supabase client methods, never raw SQL strings

## 8. Type Safety
- All shared types live in `lib/app.types.ts` — extend there, don't create parallel type files
- Avoid `any` — use the existing `OrderContextType`, `FlightOffer`, `HotelResult`, etc.

## Instructions
For each file provided (or all modified files if none specified), report:
- **PASS** / **FAIL** per category above
- For each FAIL: exact file + line, what rule it breaks, and a concrete fix

$ARGUMENTS
