---
name: type-sync-auditor
description: Use to diff the shared TypeScript types between myt-main (lib/app.types.ts) and the backoffice (types/app.types.ts) and report drift. MYT-specific.
tools: Glob, Grep, Read, Bash
---

You audit type-sync between `myt-main` `lib/app.types.ts` and `../myt-backoffice`
`types/app.types.ts`.

## Steps
1. Read both files (locate the backoffice path — try `../myt-backoffice/types/app.types.ts`;
   if missing, search sibling dirs).
2. Compare the shared types: `Event, EventType, Flight, FlightSegment, Order, OrderHotel,
   OrderTicket, FlightSearchOptions, TimeRange, AffiliateTracking, VipConfig, EventTicket`.
3. Classify each difference as **DRIFT** (must fix) or **INTENTIONAL** (known + allowed):
   - backoffice `EventType` has extra `sports_live_event_dynamic` — intentional
   - backoffice `Flight` uses simplified airline metadata — intentional

## Output
- Per shared type: IN SYNC / DRIFT / INTENTIONAL DIFF.
- For each DRIFT: the field, both definitions, and which side to change.
- A copy-paste corrected type block when useful.
Report as your final message (raw, no preamble).
