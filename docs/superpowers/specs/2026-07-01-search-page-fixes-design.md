# Search Page Fixes — Design

**Date:** 2026-07-01
**Files:** `components/SearchResults.tsx`, `app/search/page.tsx`, `lib/app.types.ts`

## Problem

1. **Sports filter returns nothing.** `categoryOf` in `SearchResults.tsx` tags an event
   as sports only when `type` is `sports_event` / `sports_event_dynamic`, or a `tx_event`
   whose name starts with "מונדיאל". DB reality (non-deleted events):
   - `tx_event` = 169 (MIXED: football `... vs ...` / `World Cup` + concerts)
   - `music_live_event_dynamic` = 148
   - `sports_live_event_dynamic` = 79 — **not in myt-main `EventType` union → unhandled → classified music**
   - `music_event` = 31
   - `sports_event_dynamic` = 5
   - `sports_event` = 1
   So 79 live sports + all football `tx_event`s (Arsenal/Tottenham/World Cup) fall through to
   "music". The 6 static sports events are likely sold-out (filtered by default) → user sees none.
2. Price min/max filter unwanted.
3. City dropdown redundant when the typed query already is a city.
4. Filter UI too heavy.

## Changes

### `lib/app.types.ts`
- Add `"sports_live_event_dynamic"` to `EventType`. Backoffice already has this value — this
  **removes** the known drift and aligns both repos. Run `/sync-types` after. No exhaustive
  `EventType` switch exists in main, so no TS break.

### `components/SearchResults.tsx`
1. **`categoryOf` rewrite.** Sports when:
   - `type ∈ { sports_event, sports_event_dynamic, sports_live_event_dynamic }`, OR
   - `type === "tx_event"` AND football-shaped:
     `/ vs /i.test(name_english)` OR `/world cup/i.test(name_english)` OR `name.includes("מונדיאל")`.
   Concerts in current data never match these → no false positives. No football-team-name
   list needed (the `" vs "` / World Cup / מונדיאל heuristic covers every football row).
2. **Remove price filter.** Delete `minPrice`/`maxPrice` state, the two UI fields, `min`/`max`
   URL params, the min/max filter block, and their entries in `SearchInitial`,
   `hasActiveFilters`, `clearFilters`. **Keep** price sorting (`priceOf`, `byPrice`, price-asc/desc).
3. **Hide city dropdown when query is a city.** `queryIsCity` = trimmed query equals a known
   city (`localeCompare(..., "he", { sensitivity: "base" }) === 0`). Derive
   `effectiveCity = queryIsCity ? "" : city` and use it in the filter, URL sync, and
   `hasActiveFilters`. Hide the city `<select>` when `queryIsCity`. Pure derivation — no effect.
4. **Date → single "מתאריך".** Drop `to` state, its UI input, `to` URL param, the `to` filter
   line, and `SearchInitial.to`. Keep `from`.
5. **Tighten layout.** Remaining controls: city (conditional) · from-date · sort ·
   כרטיס בלבד · כולל אזל מהמלאי · ניקוי מסננים. Cleaner single wrapped row.

### `app/search/page.tsx`
- Drop `min`, `max`, `to` from `searchParams` parsing and the `initial` object.

## Cross-project impact
- Only shared change is the `EventType` addition, which aligns main with backoffice (fixes drift,
  not a breakage). Flag `/sync-types`.

## Out of scope
- Order-flow handling of `sports_live_event_dynamic` (search-only fix).
- Any DB/backoffice data changes.
