# Mobile Homepage Fixes — Design

**Date:** 2026-07-01
**Scope:** myt-main customer homepage, mobile-first polish. 10 targeted UI fixes.
**Branch:** refactor/amadeus-api (current)

## Goal

Tighten and polish the mobile homepage: hero spacing, carousel touch behavior,
remove a section, unify button color/hover, remove navbar shadow-line, fix
heading decoration side, and rebuild the "הופעות נוספות" section as a stacked
list matching the search page cards.

## Decisions (locked with Dor)

- **#5** Remove the **entire** `PackageBanners` section (heading + 4 cards).
- **#6/2c** Hover→light-green applies to **all `pill` buttons + the strip**
  (base stays dark `bg-main`, hover becomes mint green).
- **#7** The "shining line" = the header's `shadow-card`. Remove it.
- **#10** Keep the "לא מצאתם מה שחיפשתם" search-prompt card, but **smaller**,
  same design.

## Per-issue design

### 1. Hero — tighter gap on mobile
`components/ClientSideHomepage.tsx` (hero, ~1204–1211).
- Trust badges: `mt-7 md:mt-8` → `mt-3 md:mt-8` (closer to search on mobile).
- Carousel: `mt-3 sm:mt-2` → `mt-1 sm:mt-2` (closer under badges on mobile).
- Desktop (`md:`/`sm:`) values unchanged.

### 2. Trust badges bigger (mobile)
`components/ui/TrustBadges.tsx`.
- Text `text-[11px]` → `text-[13px]` (mobile); `sm:text-sm` unchanged.
- Icons `size-3.5` → `size-4` (mobile); `sm:size-4` unchanged.
- Divider heights bumped to match if needed.

### 3. Carousel more sensitive — hard flick travels further
`components/HeroCarousel.tsx` fling constants (21–24).
- `FLING_FRICTION` 0.005 → 0.0035 (glides longer).
- `FLING_MAX_CARDS` 12 → 20 (higher travel cap).
- `FLING_MIN_V` 0.3 → 0.22 (lighter flick still flings).
Mobile + desktop drag share these; effect is mainly felt on touch flicks.

### 4. Angled scroll — axis lock
`components/HeroCarousel.tsx` pointer handlers (189–241).
- Record `clientY` at `pointerdown` (add `dragStartY` ref).
- On first significant move, compare `|dx|` vs `|dy|`:
  - `|dy| > |dx|` → user is scrolling the page: set a `verticalLock` ref, do
    **not** move the carousel for the rest of this gesture.
  - horizontal dominant → engage carousel as today.
- Clears on `pointerup`/`cancel`. Prevents diagonal gesture from moving the
  ring while the page scrolls (the current double-axis jitter).
- **UX (ui-ux-pro-max, `gesture-conflicts`, Mobile):** a horizontal-swipe
  carousel must not override vertical page scroll — the axis-lock is exactly
  this rule (vertical intent wins, carousel yields).

### 5. Remove packages section
`components/ClientSideHomepage.tsx`.
- Delete `<PackageBanners events={initialEvents} />` (1216).
- Remove now-unused import (29). Leave `PackageBanners.tsx` file in place.

### 6. Unify button color + green hover
- `components/ui/button.tsx` `pill` variant (16):
  `hover:bg-main/90` → `hover:bg-secondary hover:text-black active:bg-secondary active:text-black`
  (mint green on hover AND press; dark base unchanged). Affects "לפרטים
  והזמנה", "בחרו תאריך", etc.
- Strip in `components/ClientSideHomepage.tsx` (~1804): same swap. Base
  `bg-main` already matches the pill (same color = issue #6 satisfied).
- **UX (ui-ux-pro-max, `hover-vs-tap`, High):** hover is a no-op on touch, so
  the `active:` state is what mobile users actually see. Both included.

### 7. Remove navbar shadow-line
`components/Header.tsx` (103). Remove `shadow-card` from the `<header>`
className. No border replacement (flush).

### 8. Google reviews — RTL + translated context
`components/ClientSideHomepage.tsx` (1375–1382), Elfsight widget.
- Elfsight is a third-party iframe; **RTL direction and review language/
  translation are configured in the Elfsight dashboard**, not in our code.
- Code change: wrap with `dir="rtl"` and keep the light-surface wrapper.
- **Action item for Dor:** set RTL + Hebrew/translation in the Elfsight widget
  settings. Code alone can't force the iframe's internal layout/language.

### 9. Decorative cube to the right of heading (all sections)
Currently the `bg-secondary` squares render **after** the `<h2>` in a
`flex flex-row` row → left side in RTL. Move the squares **before** the heading
so they sit on the right (RTL start).
- `components/ClientSideHomepage.tsx` — all section heading rows (המבוקשים
  ביותר, כדורגל, אמנים, הופעות נוספות).
- `components/CategorySection.tsx` (39–40).
- (PackageBanners removed, so its squares go with it.)

### 10. "הופעות נוספות" — stacked list rework
`components/ClientSideHomepage.tsx` (1456–1563).
- **Drop** `MobileCarousel`; render a single-column stack of `EventCard`
  (already the minimal, no-picture card used on the search page).
- **Counts:** `visibleMusicCount` responsive — mobile **5**, desktop **20**.
  Initial state 11 → 5; render layout uses one grid: `grid-cols-1` on mobile,
  `sm:grid-cols-2 lg:grid-cols-4` on desktop. Slice by `visibleMusicCount`.
- **"Show more"** button: `hidden sm:flex` → always visible (mobile + desktop);
  increments count. Rename **"הצג עוד הופעות" → "הצג עוד אירועים"**.
- **Search-prompt card** ("לא מצאתם…"): keep, same design, **smaller**
  (reduce image height + padding) — appended at end of the list.

## Non-goals / out of scope
- No backoffice changes (pure frontend, no shared types / DB / API touched).
- No Elfsight dashboard changes from code (flagged as Dor's action).
- Desktop layout untouched except #6 (global pill hover), #9 (cube side), #10.

## Cross-project impact
None. All edits are in myt-main presentational components. No shared
`app.types.ts`, API routes, or Supabase tables touched.

## Verification
`yarn build` green, then visual check on mobile viewport for each issue.
