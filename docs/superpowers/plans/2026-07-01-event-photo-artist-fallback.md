# Event Photo → Person Photo Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any event with no photo of its own borrows the hero image of its matching artist or football team; the event's own photo always wins.

**Architecture:** Enrichment happens in the data layer (`lib/eventsData.ts`). After events are fetched, events with no own photo get `card_image_url` filled in place from a cached artist+team image index, matched by `name_english` substring. Because `art_image_url` stays empty, existing card logic renders the filled `card_image_url` as a photo — zero component changes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (service-role), `next/cache` (`unstable_cache`).

## Global Constraints

- No test runner in the repo. Type gate = `npx tsc --noEmit`. `yarn build` needs `.env.local`; a `supabaseUrl is required` error at "Collecting page data" still confirms types compiled.
- No `any`. Shared domain types live in `lib/app.types.ts` — do not fork them.
- Supabase: import the shared client from `@/lib/supabase`. Every call checks `error` before `data`, `console.error(JSON.stringify(error))` on failure, never throws into the render path.
- Prices/URLs: person `image_url` is stored as a full `https://…` URL — use it as-is for events (do NOT strip the scheme; that stripping is only for the `heroBanner` path).
- Soft deletes: `is_deleted` is `false` on person tables (boolean there), `null`-vs-date on `events` — do not change these checks.
- Per Dor's workflow: **do NOT commit.** Each task ends at a review checkpoint. Dor reviews the diff and commits via `/commit-push`.

---

### Task 1: Lightweight person image index reader

Add a reader that returns just `{ name, url }` per person, for both artists and football teams (both build on the same factory).

**Files:**
- Modify: `lib/cms/people.ts` (add `listImageIndex` to the object returned by `makePeopleReaders`, ~after `listSlugs`)
- Modify: `lib/artists.ts` (export `getArtistImageIndex`)
- Modify: `lib/football.ts` (export `getFootballImageIndex`)

**Interfaces:**
- Consumes: the existing `supabase` client and `table` var already in scope inside `makePeopleReaders`.
- Produces:
  - `listImageIndex(): Promise<{ name: string; url: string }[]>` on the reader object.
  - `getArtistImageIndex: () => Promise<{ name: string; url: string }[]>` from `lib/artists.ts`.
  - `getFootballImageIndex: () => Promise<{ name: string; url: string }[]>` from `lib/football.ts`.

- [ ] **Step 1: Add `listImageIndex` to the factory**

In `lib/cms/people.ts`, inside the object returned by `makePeopleReaders` (after the `listSlugs` method, before the closing `};`), add:

```ts
    /**
     * Lightweight index of { name, url } for photo fallback on events. Only
     * active, non-deleted rows that actually have an image. No Contentful
     * fallback (migration verified 100%); on error returns [] so callers no-op.
     */
    async listImageIndex(): Promise<{ name: string; url: string }[]> {
      const { data, error } = await supabase
        .from(table)
        .select("name_english, image_url")
        .eq("is_deleted", false)
        .eq("is_active", true)
        .not("image_url", "is", null)
        .not("name_english", "is", null);
      if (error) {
        console.error(`${table} listImageIndex failed:`, JSON.stringify(error));
        return [];
      }
      return (data as { name_english: string; image_url: string }[]).map((r) => ({
        name: r.name_english,
        url: r.image_url,
      }));
    },
```

- [ ] **Step 2: Export the artist index**

In `lib/artists.ts`, after the existing `export const getArtistSlugs = r.listSlugs;` line, add:

```ts
/** Lightweight { name, url } index for event photo fallback. */
export const getArtistImageIndex = r.listImageIndex;
```

- [ ] **Step 3: Export the football-team index**

In `lib/football.ts`, alongside the other `export const … = r.…;` lines, add:

```ts
/** Lightweight { name, url } index for event photo fallback. */
export const getFootballImageIndex = r.listImageIndex;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `people.ts`, `artists.ts`, or `football.ts`.

- [ ] **Step 5: Review checkpoint**

Stop. Report the diff to Dor for review (do not commit).

---

### Task 2: Pure name-match function (unit-tested)

Isolate the fuzzy match so it has zero imports and can be tested with `tsx`.

**Files:**
- Create: `lib/events/matchPersonImage.ts`
- Test (throwaway): a `.ts` script run via `npx tsx`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type PersonImage = { name: string; url: string }`
  - `findFallbackImage(nameEnglish: string, index: PersonImage[]): string | null`
    — returns the `url` of the person whose `name` is a case-insensitive substring of `nameEnglish`; when several match, the **longest** `name` wins; `null` if none or `nameEnglish` is empty.

- [ ] **Step 1: Write the failing test**

Create `C:\Users\doraz\AppData\Local\Temp\claude\c--Users-doraz-OneDrive-Desktop-Work-MegaEvent-MYT-Git-Shered-myt-main\0fff44ca-d99f-48e6-8ac0-346f1fce1551\scratchpad\match.test.ts`:

```ts
import { findFallbackImage, PersonImage } from "../../../../../../../OneDrive/Desktop/Work/MegaEvent/MYT_Git_Shered/myt-main/lib/events/matchPersonImage";

const index: PersonImage[] = [
  { name: "Sia", url: "sia.jpg" },
  { name: "Coldplay", url: "coldplay.jpg" },
  { name: "Depeche", url: "depeche-short.jpg" },
  { name: "Depeche Mode", url: "depeche-mode.jpg" },
];

const cases: [string, string | null][] = [
  ["Coldplay - Wembley 2026", "coldplay.jpg"], // substring match
  ["COLDPLAY LIVE", "coldplay.jpg"],            // case-insensitive
  ["Depeche Mode Berlin", "depeche-mode.jpg"],  // longest match wins over "Depeche"
  ["Metallica Show", null],                     // no match
  ["", null],                                   // empty name
  ["Fantasia World", "sia.jpg"],                // KNOWN fuzzy limitation: "sia" in "Fantasia"
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = findFallbackImage(input, index);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  "${input}" -> ${got} (expected ${expected})`);
}
if (failed) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log("all cases passed");
```

Note: the relative import path is long because the scratchpad is outside the repo — adjust the `../` depth if your scratchpad path differs; the target is `<repo>/lib/events/matchPersonImage.ts`. `matchPersonImage.ts` has no `@/` imports, so `tsx` resolves it directly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --yes tsx "<scratchpad>/match.test.ts"`
Expected: FAIL — cannot find module `matchPersonImage` (file not created yet).

- [ ] **Step 3: Write the implementation**

Create `lib/events/matchPersonImage.ts`:

```ts
// Pure event→person name matcher for photo fallback. No imports so it can be
// unit-tested in isolation. A person matches when its name is a case-insensitive
// substring of the event's English name; the longest matching name wins.

export type PersonImage = { name: string; url: string };

export function findFallbackImage(
  nameEnglish: string,
  index: PersonImage[]
): string | null {
  if (!nameEnglish) return null;
  const hay = nameEnglish.toLowerCase();
  // Longest name first → the most specific match wins ties.
  const sorted = [...index].sort((a, b) => b.name.length - a.name.length);
  for (const person of sorted) {
    const needle = person.name.toLowerCase();
    if (needle && hay.includes(needle)) return person.url;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --yes tsx "<scratchpad>/match.test.ts"`
Expected: all six lines print `PASS`, final line `all cases passed`, exit 0.

- [ ] **Step 5: Review checkpoint**

Delete the scratchpad test file. Stop and report to Dor (do not commit).

---

### Task 3: Event enrichment + cached person index

Wrap the two indexes in one cached fetch and mutate photo-less events.

**Files:**
- Create: `lib/events/fallbackImage.ts`

**Interfaces:**
- Consumes:
  - `getArtistImageIndex`, `getFootballImageIndex` (Task 1) — both `() => Promise<{ name: string; url: string }[]>`.
  - `findFallbackImage`, `PersonImage` (Task 2).
  - `Event` from `@/lib/app.types`.
- Produces:
  - `enrichEventsWithFallbackImages(events: Event[]): Promise<Event[]>` — returns the same array with `card_image_url` filled on events that had no own photo.

- [ ] **Step 1: Write the implementation**

Create `lib/events/fallbackImage.ts`:

```ts
import { unstable_cache as nextCache } from "next/cache";

import { Event } from "@/lib/app.types";
import { getArtistImageIndex } from "@/lib/artists";
import { getFootballImageIndex } from "@/lib/football";
import { findFallbackImage, PersonImage } from "@/lib/events/matchPersonImage";

// Merged artist + football-team image index. Cached under the same `events`
// tag/TTL as event data, so it is fetched once per revalidation window rather
// than per request (matters for getEventsByName, which is not itself cached).
const getPersonImageIndex = nextCache(
  async (): Promise<PersonImage[]> => {
    const [artists, teams] = await Promise.all([
      getArtistImageIndex(),
      getFootballImageIndex(),
    ]);
    return [...artists, ...teams];
  },
  ["person-image-index"],
  { tags: ["events"], revalidate: 3600 }
);

// An event "has its own photo" if either art or card image is set (non-empty).
const hasOwnPhoto = (e: Event): boolean =>
  Boolean(e.art_image_url || e.card_image_url);

/**
 * Fill card_image_url on events with no photo of their own, using the matching
 * artist/team hero image. Mutates in place and returns the same array. Skips
 * the index fetch entirely when every event already has a photo, and is a no-op
 * if the index is empty (e.g. query failure) — events render as they do today.
 */
export async function enrichEventsWithFallbackImages(
  events: Event[]
): Promise<Event[]> {
  if (!events.length) return events;
  const needy = events.filter((e) => !hasOwnPhoto(e));
  if (!needy.length) return events;

  const index = await getPersonImageIndex();
  if (!index.length) return events;

  for (const event of needy) {
    const url = findFallbackImage(event.name_english, index);
    if (url) event.card_image_url = url;
  }
  return events;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Confirms `getArtistImageIndex`/`getFootballImageIndex` (Task 1) and `findFallbackImage` (Task 2) resolve with matching signatures.

- [ ] **Step 3: Review checkpoint**

Stop and report to Dor (do not commit).

---

### Task 4: Wire enrichment into the event readers

**Files:**
- Modify: `lib/eventsData.ts` (import + two return sites: `getEvents` ~line 53, `getEventsByName` ~line 85)

**Interfaces:**
- Consumes: `enrichEventsWithFallbackImages` (Task 3).
- Produces: no new exports — `getEvents` / `getEventsByName` keep their `Promise<{ events: Event[] }>` signature; returned events now carry fallback images.

- [ ] **Step 1: Import the enricher**

In `lib/eventsData.ts`, after the existing imports (below the `unstable_cache` import), add:

```ts
import { enrichEventsWithFallbackImages } from "@/lib/events/fallbackImage";
```

- [ ] **Step 2: Enrich in `getEvents`**

Replace the success return in `getEvents`:

```ts
    return { events: events || [] };
```

with:

```ts
    return { events: await enrichEventsWithFallbackImages(events || []) };
```

Leave both error/catch returns (`{ events: [] }`) unchanged.

- [ ] **Step 3: Enrich in `getEventsByName`**

Replace the success return in `getEventsByName`:

```ts
  if (error) return Promise.resolve({ events: [] as Event[] });
  return { events };
```

with:

```ts
  if (error) return Promise.resolve({ events: [] as Event[] });
  return { events: await enrichEventsWithFallbackImages(events) };
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `yarn build`
Expected: green. If `.env.local` is absent, an `Error: supabaseUrl is required` at "Collecting page data" is acceptable — it still confirms compile + typecheck passed.

- [ ] **Step 6: Manual spot-check**

Run: `yarn dev`. Then:
- Find an event with no own photo (blob-only today) on the homepage or a catalog page whose name contains an artist/team name → confirm it now shows that artist/team hero image as a photo.
- Confirm an event that already has `card_image_url` or `art_image_url` is unchanged.
- Confirm an event whose name matches no person still renders blob-only (no crash).

- [ ] **Step 7: Review checkpoint**

Stop. Report to Dor for final review; Dor commits the whole change via `/commit-push`.

---

## Self-Review

**Spec coverage:**
- Fallback chain (art → card → person → blob): Task 3 `hasOwnPhoto` guard + in-place `card_image_url` fill; art still wins because only photo-less events are touched. ✓
- Data-layer, zero component changes: Task 4 wires readers; no card files touched. ✓
- Match by substring, longest wins: Task 2 `findFallbackImage`. ✓
- Artists + football teams: Task 1 both readers; Task 3 merges. ✓
- Full-https URL (no scheme strip): Task 1 returns `image_url` as-is. ✓
- Cached index, `events` tag, no-op on failure: Task 3 `getPersonImageIndex` + empty-index guard. ✓
- No backoffice/schema/type/API change: only new files + two return-line edits. ✓
- Verification via build + manual: Task 4 steps 5–6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `{ name: string; url: string }[]` (Task 1) is structurally identical to `PersonImage[]` (Task 2); `getPersonImageIndex` returns `PersonImage[]` (Task 3) fed to `findFallbackImage`. `enrichEventsWithFallbackImages(events: Event[]): Promise<Event[]>` used consistently in Task 4. ✓
