# Cross-Project Rule (always-on) — myt-main

This app shares one Supabase DB with `../myt-backoffice`. Changes can break the sibling.

## API contract (backoffice calls these — DO NOT change shape/params)
- `GET /api/hotels` — params `lat, lon, checkin, checkout, secret`
- `GET /api/revalidate` — param `secret`
- `GET /api/flights/search` — backoffice admin preview

## Shared types — keep in sync
- `lib/app.types.ts` ↔ backoffice `types/app.types.ts`: `Event`, `EventType`, `Flight`, `FlightSegment`, `Order`, `OrderHotel`, `OrderTicket`, `FlightSearchOptions`, `TimeRange`, `AffiliateTracking`, `VipConfig`, `EventTicket`.
- **Known intentional diffs:** backoffice `EventType` has extra `sports_live_event_dynamic`; backoffice `Flight` uses simplified airline metadata.
- Edit any of these → run `/sync-types` and update the backoffice copy. See [[pricing]].

## Shared tables
- This app: reads `events`/`partners`/`flights`, writes `reservations`/`hotels`. Don't change column contracts other side depends on.
