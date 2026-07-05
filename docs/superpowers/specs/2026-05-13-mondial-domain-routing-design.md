# Mondial Domain Routing — Design Spec

**Date:** 2026-05-13
**Author:** Dor + Claude
**Status:** Draft (pending review)

## Problem

Two deployments share the codebase:

- `www.mega-events.co.il` (main branch) → all events, full package (ticket + flight + hotel)
- `mondial2026.mega-events.co.il` (mondial branch) → World Cup 2026 events only, with multi-event bundle / ticket-only / Mondial2026 title parsing

Both deployments currently render any event from the shared Supabase DB. Result: bug — clicking a mondial event from the main site enters the main-branch flow, missing mondial features (multi-event bundle, ticket-only UX, special title rendering). Likewise, a non-mondial event opened on the mondial subdomain hits a flow that hides hotel/flight pricing logic users expect.

## Goal

Route every event order flow to the correct domain based on event identity:

- Mondial events → only on `mondial2026.mega-events.co.il`
- Non-mondial events → only on `www.mega-events.co.il`

Bidirectional, server-side, transparent to user.

## Identification

A "mondial event" is one whose `name` matches the Mondial 2026 pattern (Hebrew "מונדיאל 2026" or English "World Cup 2026"). The helper `parseMondial2026EventName(name)` already exists in the mondial branch at `lib/mondial2026Title.ts` and returns `{ isMondial2026: boolean, ... }`.

This identification approach:

- Zero schema change
- Uses existing helper
- Trivial to extend (just update the regex when adding "World Cup 2030", etc.)

## Approach: Server-component redirect

Both branches' `app/order/[eventId]/page.tsx` (and any other event-flow entrypoint such as `/order/[eventId]/edit`, `/confirmation/...`) perform a domain check after fetching the event for render.

### Shared helper

`lib/domainRouting.ts` (added to both branches; identical code):

```ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { parseMondial2026EventName } from "./mondial2026Title";

const MAIN_HOST = "www.mega-events.co.il";
const MONDIAL_HOST = "mondial2026.mega-events.co.il";

export function requireCorrectDomainForEvent(event: { name: string; id: number }, pathname: string) {
  const host = headers().get("host") ?? "";
  const isMondialEvent = parseMondial2026EventName(event.name).isMondial2026;
  const isOnMondialHost = host.includes("mondial2026");

  // Local dev: skip redirect; allow both flows for testing
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return;

  if (isMondialEvent && !isOnMondialHost) {
    redirect(`https://${MONDIAL_HOST}${pathname}`);
  }
  if (!isMondialEvent && isOnMondialHost) {
    redirect(`https://${MAIN_HOST}${pathname}`);
  }
}
```

### Page integration

In each affected page server component:

```ts
// app/order/[eventId]/page.tsx
const event = await getEventById(eventId);
if (!event) notFound();
requireCorrectDomainForEvent(event, `/order/${eventId}`);
// ... render
```

### Pages to patch

- `app/order/[eventId]/page.tsx`
- `app/order/[eventId]/edit/page.tsx` (if exists)
- `app/confirmation/[...params]/page.tsx` (only when event-id is in params)
- Any other route that initiates the order flow for a specific event

### Branch coverage

- **Mondial branch** already has `parseMondial2026EventName`. Add `domainRouting.ts` + page integrations.
- **Main branch** does NOT have `parseMondial2026EventName`. Add:
  - `lib/mondial2026Title.ts` (port from mondial branch, only the parser function — title constant not needed)
  - `lib/domainRouting.ts`
  - Page integrations

## Soft-link complement (UI side)

To avoid the redirect round-trip in most cases, emit the correct domain in `<Link>` hrefs on event cards from the start:

- Card click on main site for mondial event → `<a href="https://mondial2026.mega-events.co.il/order/${id}">`
- Card click on mondial subdomain for non-mondial event → `<a href="https://www.mega-events.co.il/order/${id}">`

Helper: `eventOrderHref(event)` that returns the correct absolute URL. Use in event card components. Same `parseMondial2026EventName` check inside.

The server-side redirect remains as the safety net (bookmarks, shared links, search engines).

## Local development

- `localhost` and `127.0.0.1` hosts skip the redirect (see helper). Developers can test both flows on the same dev server without subdomain setup.
- Existing local mondial path `http://localhost:3000/mondial2026` (the marketing page) is unaffected; this routing concerns `/order/[eventId]` only.

## Edge cases

| Case | Behavior |
|------|----------|
| Event name changes (mondial → not, or vice versa) | Next request hits new branch; user mid-flow may be redirected — acceptable since order isn't persisted yet |
| Bookmarked wrong-domain URL | Server 307 redirect to correct domain; resumes seamlessly |
| Search engine indexes wrong-domain URL | Server redirect signals canonical domain; combined with existing noindex on mondial, search engines learn fast |
| `parseMondial2026EventName` returns false for an event the team considers mondial | Treated as non-mondial. Fix: update regex in `lib/mondial2026Title.ts`. Future-proof: consider adding explicit `tags: "mondial2026"` as an override |
| Event fetch fails | `notFound()` runs first; no redirect attempt on missing event |

## Non-goals

- No middleware-based redirect (middleware can't read Supabase cheaply; YAGNI vs page-level check)
- No DB-cached event-type cache layer (Vercel KV, etc.)
- No URL-pattern split like `/mondial/order/[id]` (would change every link generation site)
- No reverse compatibility shim for legacy URLs (server redirect handles them automatically)

## Acceptance criteria

1. Hitting `https://www.mega-events.co.il/order/524` returns 307 → `https://mondial2026.mega-events.co.il/order/524`
2. Hitting `https://mondial2026.mega-events.co.il/order/150` (Arsenal vs Burnley) returns 307 → `https://www.mega-events.co.il/order/150`
3. Hitting `http://localhost:3000/order/524` renders without redirect (local dev unaffected)
4. Event cards on main site `<Link>` to mondial subdomain for mondial events (avoids round-trip)
5. Both branches build and test pass

## Open questions

- Are there event-flow URLs beyond `/order/[eventId]` that need the same guard? (`/confirmation/*`, `/order/[eventId]/edit`, partner pages, payment callbacks)
- For shared `/order` SSR caching: redirect must occur before any cached render — verify with Next.js segment cache behavior
- Decide whether the helper should accept just `event.name` or the full event (we may want id later for logging)
