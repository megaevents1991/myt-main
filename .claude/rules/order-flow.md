# Order Flow Rule (always-on) — myt-main

The core booking flow under `app/order/[eventId]`. Keep it intact.

- **Single source of truth = `OrderContext`** (`app/app.context.ts`): event, ticket, flight, hotel, passengers, step, planeTickets, globalLoader. No parallel local state that bypasses it.
- **Steps are sequential:** 1 Ticket → 2 Flight → 3 Hotel → 4 Review/Payment.
  - **US events skip the hotel step.** Check event location before rendering/advancing.
- Flight search → `/api/flights/search` (Amadeus). Hotel search → `/api/hotels` (Ratehawk), fetched via `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`), not in render.
- Payment: `/api/confirm-order` (saves order + email) → `/api/payment` (CreditGuard).
- **Ticket vendor routing by `event.type`:**
  - `sports_event` / `music_event` → static Supabase `tickets_and_rates`
  - `sports_event_dynamic` / `music_live_event_dynamic` → XS2Event API
  - `tx_event` → Tixstock + interactive seat map (`TixstockDynamicMap.tsx`)
- Session expiry handled by `useOrderExpiry` — don't duplicate timer logic.
