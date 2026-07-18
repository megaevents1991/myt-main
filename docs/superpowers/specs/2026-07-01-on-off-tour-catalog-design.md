# On-Tour / Off-Tour sections — Artists & Football catalog

**Date:** 2026-07-01
**Scope:** myt-main only (customer app). No backoffice / shared-type / API impact.

## Goal

Split the Artists (`/artists`) and Football (`/football`) catalog pages into two
sections:

- **זמין באתר** (On-Tour) — artists/teams we currently have available events for.
  Full-color, clickable cards (current behavior).
- **Wishlist** (Off-Tour) — artists/teams with no current events. Dimmed,
  display-only (not clickable).

Both pages share `components/CatalogPageTemplate.tsx`, so the work lands mostly
in that one shared component plus a small data helper.

## Definitions

An item is **On-Tour** when at least one event satisfies all of:

- `is_deleted IS NULL`
- `date >= today + 7 days`
- `name_english ILIKE %<item nameEnglish>%` (case-insensitive substring)

Otherwise it is **Off-Tour** (Wishlist).

This is the exact rule `getEventsByName` already uses on the detail pages
(`app/artists/[slug]/page.tsx`, `app/football/[slug]/page.tsx`), so a card's
catalog status always matches what its detail page shows. The 7-day threshold is
deliberate and must match — `getEvents()` uses a looser 3-day window, so we do
NOT rely on it directly; we re-filter to 7 days in memory.

## Architecture

### 1. Availability helper — `lib/tourStatus.ts` (NEW)

```
export async function getAvailabilityChecker(): Promise<(nameEnglish?: string) => boolean>
```

- Calls `getCachedEvents()` once (single cached query; shared across both pages
  via the `events` tag cache — no per-item DB calls).
- Keeps only events with `name_english` present AND `date >= today+7`.
- Lowercases those `name_english` values into an array.
- Returns a predicate: `true` when some event name contains the given
  `nameEnglish` (lowercased). Empty/undefined name → `false`.
- On upstream failure `getCachedEvents()` returns `{ events: [] }` → predicate
  always `false` → everything degrades to Wishlist. No throw.

### 2. `components/CatalogPageTemplate.tsx`

- Add `available: boolean` to `CatalogItem`. (Optional `nameEnglish?` not needed
  here — matching happens in the page before building items.)
- Extract the card body (art/image + name + previewText) into an internal
  `CatalogCard` component so both sections reuse it — no copy-paste.
- Split: `onTour = items.filter(i => i.available)`,
  `offTour = items.filter(i => !i.available)`.
- Render up to two `<section>`s:
  - **זמין באתר** — `onTour` cards each wrapped in `<Link href={hrefBase/id}>`,
    full color, hover shadow (current markup).
  - **Wishlist** — `offTour` cards rendered WITHOUT `<Link>`; container gets
    `opacity-60 grayscale pointer-events-none`, `aria-disabled="true"`, no hover.
- A section renders only if its group is non-empty (no orphan heading).
- `error` prop and the total-empty case keep their existing `EmptyState`
  rendering, unchanged.

### 3. Pages — `app/artists/page.tsx`, `app/football/page.tsx`

- After fetching items, `const isAvailable = await getAvailabilityChecker();`
- In the `.map(...)` to `CatalogItem`, add
  `available: isAvailable(String(<artist|team>.fields.nameDBenglish ?? ""))`.
- No other change. Error branch passes `error` as today (items empty).

## Edge cases

| Case | Result |
|------|--------|
| All items available | Only "זמין באתר" section shown |
| All items off-tour | Only "Wishlist" section shown |
| `error` fetch | Existing error EmptyState (no sections) |
| Zero items total | Existing "אין תוצאות" EmptyState |
| Events fetch fails | Predicate all-false → all Wishlist (safe) |
| Short-name false substring match | Accepted — same semantics detail page uses |
| RTL | Headings `text-start`; only dim/opacity classes — no hardcoded left/right |

## Files

| File | Change |
|------|--------|
| `lib/tourStatus.ts` | NEW — `getAvailabilityChecker()` |
| `components/CatalogPageTemplate.tsx` | `available` field; 2 sections + `CatalogCard`; dim off-tour |
| `app/artists/page.tsx` | tag items with `available` |
| `app/football/page.tsx` | tag items with `available` |

## Non-goals

- No "notify me" / persisted wishlist, no new Supabase table.
- No homepage/carousel changes.
- No shared-type edits (`CatalogItem` is local to myt-main; not in
  `lib/app.types.ts`). No cross-project / API-contract impact.

## Testing

No test runner configured. Verify by:

1. `yarn build` — green (real type gate is `tsc --noEmit`; build ignores TS errors).
2. Manual: a known artist/team WITH a future event appears full-color under
   **זמין באתר**; one with no events appears dimmed + non-clickable under
   **Wishlist**. Repeat on `/football`.
