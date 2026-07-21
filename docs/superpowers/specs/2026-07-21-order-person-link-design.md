# Order-flow person links on every stage — design

**Date:** 2026-07-21 · **Approved by:** Dor (Approach A)

## Problem

The order flow shows the artist/team round photo + "לכל ההופעות של X" link only on
the ticket stage (step 1). Flight (2) and hotel (3) render the same
`EventDataHeader` without the link props; the review (4) summary card photo links
but same-tab. Same-tab navigation away from the order loses the entire
`OrderContext` state.

## Decision (Approach A)

- All person links inside the order flow open a **new tab**
  (`target="_blank" rel="noopener"`) — the in-progress order survives in the
  original tab.
- **Steps 1–3:** header photo clickable + text link "לכל ההופעות של X", mobile
  and desktop (existing responsive `EventDataHeader`).
- **Step 4 (review):** keep image-click only (card stays compact), now new-tab.
- **Edit-from-summary** (`returnToSummary` in `OrderContext`): suppress photo
  link + text link on all stages — an edit is a focused task.
- `personLink` (href+label) already lives in `OrderContext`; when the event has
  no matching artist/team template it is `undefined` and the header renders a
  plain photo (unchanged behavior).

## Changes

1. `components/ui/EventDataHeader.tsx` — both `<Link>`s get
   `target="_blank" rel="noopener"` (component is order-flow-only).
2. `app/order/TicketSelection.tsx` — pass `artistHref`/`artistLinkLabel` only
   when `!returnToSummary`.
3. `app/order/FlightSelection.tsx` + `app/order/HotelSelection.tsx` — pass the
   same props from context, same guard.
4. `app/order/OrderReview.tsx` — summary-card photo `<Link>` gets new-tab attrs.

No DB, type, or backoffice impact.

## Verification

`npx tsc --noEmit`, `npx next build`, browser preview of steps 1–4 + edit mode.
