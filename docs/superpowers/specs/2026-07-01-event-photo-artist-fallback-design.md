# Event Photo → Person Photo Fallback

**Date:** 2026-07-01
**Project:** myt-main (customer-facing)
**Status:** Approved design, pending implementation plan

## Goal

Any event with no photo of its own borrows the hero image of its matching
**artist** or **football team**. The event's own photo always wins.

## Fallback chain (per event display image)

For each event, the image resolves in this order:

1. `art_image_url` (blob cut-out PNG) → renders **blob** variant *(unchanged)*
2. else `card_image_url` (event's own photo) → **photo** variant *(unchanged)*
3. **new:** matched person's `image_url` → **photo** variant
4. else → blob-only, no image *(current empty behavior, unchanged)*

"Event image" means either `art_image_url` **or** `card_image_url`. Either one
beats the person photo. The person photo only fills the gap when both are empty.

## Where it happens — data layer, zero component changes

Enrichment lives in `lib/eventsData.ts`. After events are fetched, any event
with **no own photo** (`!art_image_url && !card_image_url`) gets its
`card_image_url` set to the matched person's `image_url` **in place**.

Because `art_image_url` stays empty, the existing card logic
`variant={event.art_image_url ? "blob" : "photo"}` automatically renders the
filled `card_image_url` as a **photo**. No card component changes are needed.

Consumers that benefit for free (all read `art_image_url || card_image_url`, or
`card_image_url` directly):

- `components/ClientSideHomepage.tsx` (homepage event cards)
- `components/CatalogPageTemplate.tsx`
- `components/HeroCarousel.tsx`
- `components/PackageBanners.tsx`
- `components/ui/EventDataHeader.tsx`
- `app/order/[eventId]/page.tsx` (OpenGraph image)
- `app/order/OrderReview.tsx` (`eventImage` in confirmation/email)

Filling `card_image_url` in place (chosen over adding a separate
`display_image_url` field) means the fallback also flows to the OG image and
confirmation email — desirable, and it avoids editing every consumer.

## The match (event → person)

A person matches an event when the person's `name_english` is a
**case-insensitive substring** of the event's `name_english`.

This is the same rule `getEventsByName` already uses in reverse
(`.ilike("name_english", "%${artistName}%")`), so an event that appears on an
artist/team page is guaranteed to resolve to that same person here.

**Tie-break:** when multiple persons match, the **longest** `name_english` wins.
This cuts false positives from short names (e.g. artist "Sia" matching an "Asia"
event) by preferring the more specific match.

## New pieces

### 1. `lib/cms/people.ts` — `listImageIndex()`

Add a lightweight reader to `makePeopleReaders`:

- Selects only `name_english, image_url` from the table (`is_deleted=false`,
  `is_active=true`), rows with a non-null `image_url`.
- Returns `{ name: string; url: string }[]` where `url` is the **full https**
  URL as stored (do **not** strip the scheme — events consume the URL directly
  in `next/image`, unlike the `heroBanner` path which strips it).
- No Contentful fallback needed (migration verified 100%); on query error,
  return `[]` so enrichment is a no-op and the site keeps working.

`lib/artists.ts` and `lib/football.ts` both build on `makePeopleReaders`, so
each gains `listImageIndex` from the shared factory automatically.

### 2. `lib/events/fallbackImage.ts` — `enrichEventsWithFallbackImages(events)`

- Builds a merged person index from artists + football teams.
- Index is wrapped in `next/cache` (`unstable_cache`, tag `events`, revalidate
  3600) so it is fetched once per revalidation, not per request.
- Names are lowercased once; index sorted by name length **descending** for the
  longest-match tie-break.
- For each event with no own photo, find the first index entry whose lowercased
  `name` is a substring of the event's lowercased `name_english`; if found, set
  `event.card_image_url = entry.url`.
- Treat `null`, `undefined`, and `""` all as "absent" for both image fields.
- Returns the (mutated) events array.

### 3. Wire into readers

- `getEvents(id?)` → `return { events: await enrichEventsWithFallbackImages(events) }`
- `getEventsByName(searchName)` → same enrichment before returning.

## Cost & safety

- Index fetch runs once per ISR revalidation window. `getEvents` is already
  wrapped by `getCachedEvents` (1h). Artist/team pages use `revalidate = 3600`.
- **Pure frontend read path.** No DB schema change, no shared-type change, no
  change to any API route the backoffice calls. **No backoffice impact.**
- If the person index query fails, enrichment is a no-op — events render exactly
  as they do today (blob-only for photo-less events).

## Known limitation

Substring matching is fuzzy by design (mirrors existing `getEventsByName`).
Longest-match tie-break reduces but does not eliminate false positives. Accepted
for parity with current behavior.

## Verification

No test runner configured. Verify by:

1. `yarn build` green (real type gate per repo convention).
2. Spot-check a photo-less event on the homepage/catalog — confirm it now shows
   the artist/team hero image, and that events with their own photo are unchanged.
