---
name: add-ticket-vendor
description: Scaffold the customer-side rendering + routing for a new ticket vendor / EventType in myt-main. Use when adding a new event ticket source (the frontend counterpart to the backoffice's new-provider-sync). Triggers on: new ticket vendor, new event type rendering, add ticket source frontend.
---

# Add Ticket Vendor (myt-main frontend)

The backoffice `/new-provider-sync` scaffolds the sync side. This scaffolds how the customer
app *renders and routes* tickets for the new source. Do these in order.

## 1. Type
- Add the new value to the `EventType` union in `lib/app.types.ts` (and mirror to backoffice
  `types/app.types.ts` — run `/sync-types`).
- Add/extend the ticket shape if the vendor returns a new structure (follow `EventTicket` /
  `OrderTicket = Omit<EventTicket,'colorOnTheMap'> & { quantity:number }`).

## 2. Routing
- In the ticket-selection step (`app/order/[eventId]/.../TicketSelection.tsx`), branch on
  `event.type` exactly like existing vendors:
  - static → Supabase `tickets_and_rates`
  - dynamic → vendor API
  - seat-map → dedicated map component (see `TixstockDynamicMap.tsx` for `tx_event`)
- If the vendor needs live fetch, add `app/api/<vendor>/route.ts` (Next 15 standard:
  `await params`, validate→400, try/catch, `maxDuration` if slow). Reuse the flights/hotels
  fetch-provider pattern rather than fetching in render.

## 3. Pricing
- Ensure prices feed `lib/price.utils.tsx` correctly: USD internal, +175 markup, **÷100 if
  the vendor returns cents** (sports convention). See `@.claude/rules/pricing.md`.

## 4. Display
- Hebrew/RTL labels; Mantine/shadcn components only. Fire selection analytics via
  `lib/mixpanel.ts` + `lib/gtmAnalytics.ts` on user action.

## 5. Verify
- `/react-review` + `/nextjs-review` on new files; `/price-audit`; `/review` for cross-project
  impact; `tsc --noEmit`.
