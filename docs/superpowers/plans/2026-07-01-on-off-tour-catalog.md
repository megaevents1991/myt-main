# On-Tour / Off-Tour Catalog Sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the `/artists` and `/football` catalog pages into a full-color, clickable **זמין באתר** (On-Tour) section and a dimmed, non-clickable **Wishlist** (Off-Tour) section, based on whether we currently have available events for each artist/team.

**Architecture:** A new `lib/tourStatus.ts` helper fetches all future events once (via the existing `getCachedEvents()` cache) and returns a name-matching predicate. Both catalog pages tag each item with `available`. The shared `CatalogPageTemplate` splits items into two rendered sections and dims the off-tour group.

**Tech Stack:** Next.js 15 (App Router, Server Components), React 19, TypeScript, Tailwind CSS, Supabase (read via cached events).

## Global Constraints

- **No test runner exists** — the real type gate is `npx tsc --noEmit`; `yarn build` ignores TS/ESLint errors but still confirms compile. Verify with both.
- **`yarn build` needs `.env.local`** — it may fail at "Collecting page data" with `Error: supabaseUrl is required`. That error is AFTER typecheck, so it still confirms types are valid. Treat that specific failure as a pass for typecheck purposes.
- **Hebrew/RTL** — user-facing headings in Hebrew; use `text-start`, never hardcoded `left`/`right`. On-tour heading text: `זמין באתר`. Off-tour heading text: `Wishlist`.
- **7-day availability threshold** — an item is On-Tour iff some event has `is_deleted IS NULL`, `date >= today+7`, and `name_english` contains the item's English name (case-insensitive). Must match `getEventsByName` so catalog agrees with the detail page. Do NOT rely on `getEvents()`'s 3-day window — re-filter to 7 days in memory.
- **No new dependencies.** No shared-type edits (`CatalogItem` is local to myt-main). No backoffice / API-contract impact.
- **Never** add an AI co-author line to commits. Conventional commits (`feat(scope): …`).
- Do NOT commit unless Dor asks — steps below include commit commands, but only run them when Dor authorizes (e.g. via `/commit-push`). Leave changes staged/working otherwise.

---

### Task 1: Availability helper — `lib/tourStatus.ts`

**Files:**
- Create: `lib/tourStatus.ts`
- Verify against: `lib/eventsData.ts` (`getCachedEvents`), `lib/app.types.ts` (`Event`)

**Interfaces:**
- Consumes: `getCachedEvents(): Promise<{ events: Event[] }>` from `lib/eventsData.ts`. `Event` has `name_english: string | null` and `date: string` (`YYYY-MM-DD`).
- Produces: `getAvailabilityChecker(): Promise<(nameEnglish?: string) => boolean>` — resolves to a predicate that returns `true` when the given English name (case-insensitive, trimmed, non-empty) is a substring of at least one qualifying event's `name_english`.

- [ ] **Step 1: Verify the source signatures**

Read the two facts this task depends on, so the code matches reality:

Run: confirm `getCachedEvents` is exported from `lib/eventsData.ts` and that `Event.name_english` / `Event.date` exist in `lib/app.types.ts`.
Expected: `getCachedEvents` exists (wraps `getEvents` with `nextCache`); `Event` has `name_english: string | null` and `date: string`.

If `name_english` is named differently on `Event`, use the actual field name in Step 2.

- [ ] **Step 2: Write `lib/tourStatus.ts`**

```typescript
import { getCachedEvents } from "@/lib/eventsData";

/**
 * Builds a predicate that answers "do we currently have an available event for
 * this artist/team?" — the same rule the detail pages use via getEventsByName:
 * an event is counted when it is not deleted, is at least 7 days out, and its
 * name_english contains the item's English name (case-insensitive substring).
 *
 * Fetches all future events ONCE through the cached reader (shared `events`
 * tag), so a whole catalog page costs a single query, not one per item.
 * On any upstream failure getCachedEvents() yields { events: [] }, so the
 * predicate simply returns false for everything (all items fall to Wishlist).
 */
export async function getAvailabilityChecker(): Promise<
  (nameEnglish?: string) => boolean
> {
  const { events } = await getCachedEvents();

  // getCachedEvents/getEvents uses a looser 3-day window; re-filter to 7 days
  // so the catalog matches getEventsByName on the detail pages.
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const futureDate = sevenDaysFromNow.toISOString().split("T")[0];

  const availableNames = events
    .filter((e) => e.name_english && e.date >= futureDate)
    .map((e) => (e.name_english as string).toLowerCase());

  return (nameEnglish?: string): boolean => {
    const needle = nameEnglish?.trim().toLowerCase();
    if (!needle) return false;
    return availableNames.some((n) => n.includes(needle));
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors referencing `lib/tourStatus.ts`). Pre-existing unrelated errors, if any, are out of scope — confirm none point at this file.

- [ ] **Step 4: Commit** (only if Dor authorizes)

```bash
git add lib/tourStatus.ts
git commit -m "feat(catalog): add on-tour availability checker"
```

---

### Task 2: Two-section `CatalogPageTemplate` with dimmed Wishlist

**Files:**
- Modify: `components/CatalogPageTemplate.tsx`

**Interfaces:**
- Consumes: nothing new at runtime (pure presentational). Pages now pass `available` on each item.
- Produces: `CatalogItem` gains `available: boolean`. Template renders up to two sections (`זמין באתר`, `Wishlist`). Existing props (`title`, `hrefBase`, `items`, `gridLabel`, `cardLabelPrefix`, `imageAltPrefix`, `error`) unchanged.

- [ ] **Step 1: Add `available` to `CatalogItem`**

In `components/CatalogPageTemplate.tsx`, add the field to the type:

```typescript
export type CatalogItem = {
  id: string;
  name: string;
  imageUrl?: string;
  previewText?: string;
  artImageUrl?: string;
  artColorIndex?: number;
  artShapeIndex?: number;
  /** True = we have a currently-available event (On-Tour). False = Wishlist. */
  available: boolean;
};
```

- [ ] **Step 2: Extract the card body into an internal `CatalogCard`**

Add this component ABOVE `CatalogPageTemplate` in the same file. It is the current card's inner markup (art/image + name + previewText), with no `<Link>` — the section decides whether to wrap it.

```tsx
const CatalogCard = ({
  item,
  imageAltPrefix,
}: {
  item: CatalogItem;
  imageAltPrefix: string;
}) => (
  <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow group-hover:shadow-card-hover">
    {item.artImageUrl ? (
      <EventArt
        id={item.id}
        imageUrl={item.artImageUrl}
        alt={`${imageAltPrefix} ${item.name}`}
        colorIndex={item.artColorIndex}
        shapeIndex={item.artShapeIndex}
        className="aspect-square"
      />
    ) : item.imageUrl ? (
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={item.imageUrl}
          alt={`${imageAltPrefix} ${item.name}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    ) : null}
    <div className="p-3 text-start">
      <h2 className="font-display text-base font-bold text-foreground sm:text-lg">
        {item.name}
      </h2>
      {item.previewText && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.previewText}
        </p>
      )}
    </div>
  </article>
);
```

- [ ] **Step 3: Add a grid-section renderer**

Add ABOVE `CatalogPageTemplate`, below `CatalogCard`. On-tour cards link out; off-tour cards are dimmed, non-interactive (no `<Link>`, `pointer-events-none`, `aria-disabled`).

```tsx
const CatalogSection = ({
  heading,
  items,
  hrefBase,
  gridLabel,
  cardLabelPrefix,
  imageAltPrefix,
  dimmed,
}: {
  heading: string;
  items: CatalogItem[];
  hrefBase: string;
  gridLabel: string;
  cardLabelPrefix: string;
  imageAltPrefix: string;
  dimmed: boolean;
}) => {
  if (items.length === 0) return null;
  return (
    <section className="mb-10 last:mb-0" aria-label={gridLabel}>
      <h2 className="mb-4 font-display text-2xl font-extrabold text-foreground">
        {heading}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {dimmed
          ? items.map((item) => (
              <div
                key={item.id}
                aria-disabled="true"
                className="pointer-events-none opacity-60 grayscale"
              >
                <CatalogCard item={item} imageAltPrefix={imageAltPrefix} />
              </div>
            ))
          : items.map((item) => (
              <Link
                key={item.id}
                href={`${hrefBase}/${item.id}`}
                aria-label={`${cardLabelPrefix} ${item.name}`}
                className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <CatalogCard item={item} imageAltPrefix={imageAltPrefix} />
              </Link>
            ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Rewrite `CatalogPageTemplate` body to split + render two sections**

Replace the single grid `<section>` (the `items.map(...)` block) with the split. Keep the `error` and total-empty `EmptyState` branches exactly as they are.

```tsx
export const CatalogPageTemplate = ({
  title,
  hrefBase,
  items,
  gridLabel,
  cardLabelPrefix,
  imageAltPrefix,
  error = false,
}: CatalogPageTemplateProps) => {
  const onTour = items.filter((i) => i.available);
  const offTour = items.filter((i) => !i.available);

  return (
    <div className="container mx-auto px-4 py-8">
      <header>
        <h1 className="mb-8 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
      </header>

      {error ? (
        <EmptyState
          title="שגיאה בטעינת הנתונים"
          description="לא הצלחנו לטעון את הרשימה כרגע. נסו לרענן את העמוד."
        />
      ) : items.length === 0 ? (
        <EmptyState title="אין תוצאות להצגה" />
      ) : (
        <>
          <CatalogSection
            heading="זמין באתר"
            items={onTour}
            hrefBase={hrefBase}
            gridLabel={gridLabel}
            cardLabelPrefix={cardLabelPrefix}
            imageAltPrefix={imageAltPrefix}
            dimmed={false}
          />
          <CatalogSection
            heading="Wishlist"
            items={offTour}
            hrefBase={hrefBase}
            gridLabel={gridLabel}
            cardLabelPrefix={cardLabelPrefix}
            imageAltPrefix={imageAltPrefix}
            dimmed
          />
        </>
      )}
    </div>
  );
};
```

Confirm the file still imports `Link`, `Image`, `EmptyState`, `EventArt` (all already imported at top).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `app/artists/page.tsx` and `app/football/page.tsx` complaining that `available` is missing from the `CatalogItem` object literals. That is expected — Task 3 fixes it. No errors inside `CatalogPageTemplate.tsx` itself.

- [ ] **Step 6: Commit** (only if Dor authorizes) — defer until Task 3 makes the tree typecheck-clean, or commit together with Task 3.

---

### Task 3: Tag catalog items with `available` on both pages

**Files:**
- Modify: `app/artists/page.tsx`
- Modify: `app/football/page.tsx`

**Interfaces:**
- Consumes: `getAvailabilityChecker` from `lib/tourStatus.ts` (Task 1); `CatalogItem.available` (Task 2).
- Produces: both pages pass `available` on every mapped item. No exported surface changes.

- [ ] **Step 1: Update `app/artists/page.tsx`**

Add the import and compute the checker before the map, then set `available`. Both the success map AND — note — the `catch` branch passes `items={[]}` already, so only the success branch changes.

Add import near the top:

```typescript
import { getAvailabilityChecker } from "@/lib/tourStatus";
```

In the `try` block, after `const items = await getAllArtists();` add:

```typescript
const isAvailable = await getAvailabilityChecker();
```

In the `.map`, add the `available` field:

```typescript
    const artists: CatalogItem[] = items.map((artist) => ({
      id: artist.sys.id,
      name: String(artist.fields.name ?? ""),
      previewText: artist.fields.previewText
        ? String(artist.fields.previewText)
        : undefined,
      imageUrl: artist.fields.heroBanner?.fields?.file?.url
        ? "https:" + artist.fields.heroBanner.fields.file.url
        : undefined,
      artImageUrl: artist.fields.artImageUrl,
      artColorIndex: artist.fields.artColorIndex,
      artShapeIndex: artist.fields.artShapeIndex,
      available: isAvailable(String(artist.fields.nameDBenglish ?? "")),
    }));
```

- [ ] **Step 2: Update `app/football/page.tsx`**

Same three edits, mirrored. Add import:

```typescript
import { getAvailabilityChecker } from "@/lib/tourStatus";
```

After `const items = await getAllFootballTeams();`:

```typescript
const isAvailable = await getAvailabilityChecker();
```

In the `.map` to `teams`, add:

```typescript
      available: isAvailable(String(team.fields.nameDBenglish ?? "")),
```

so the object matches:

```typescript
    const teams: CatalogItem[] = items.map((team) => ({
      id: team.sys.id,
      name: String(team.fields.name ?? ""),
      previewText: team.fields.previewText
        ? String(team.fields.previewText)
        : undefined,
      imageUrl: team.fields.heroBanner?.fields?.file?.url
        ? "https:" + team.fields.heroBanner.fields.file.url
        : undefined,
      artImageUrl: team.fields.artImageUrl,
      artColorIndex: team.fields.artColorIndex,
      artShapeIndex: team.fields.artShapeIndex,
      available: isAvailable(String(team.fields.nameDBenglish ?? "")),
    }));
```

- [ ] **Step 3: Typecheck the whole tree**

Run: `npx tsc --noEmit`
Expected: PASS — no errors in `CatalogPageTemplate.tsx`, `app/artists/page.tsx`, or `app/football/page.tsx`. (`available` now present everywhere `CatalogItem` is built.)

- [ ] **Step 4: Build gate**

Run: `yarn build`
Expected: either a clean build, OR failure at "Collecting page data" with `Error: supabaseUrl is required` (missing `.env.local`). Both outcomes confirm compile + typecheck passed. Any TYPE error is a real failure — fix before continuing.

- [ ] **Step 5: Manual verification** (with a dev server + `.env.local`)

Run: `yarn dev`, open `/artists` and `/football`.
Expected:
- An artist/team you know has a future event appears full-color under **זמין באתר** and links to its detail page.
- One with no current events appears dimmed + grayscale under **Wishlist** and is NOT clickable (no hover, no navigation).
- If every item is available, no **Wishlist** heading shows; if none are, no **זמין באתר** heading shows.

- [ ] **Step 6: Commit** (only if Dor authorizes)

```bash
git add lib/tourStatus.ts components/CatalogPageTemplate.tsx app/artists/page.tsx app/football/page.tsx
git commit -m "feat(catalog): split artists & football into on-tour and wishlist sections"
```

---

## Self-Review

- **Spec coverage:**
  - Availability helper (7-day, cached, safe-degrade) → Task 1. ✔
  - `CatalogItem.available` + two sections + dimmed non-clickable Wishlist → Task 2. ✔
  - Both pages tag `available` → Task 3. ✔
  - Labels `זמין באתר` / `Wishlist` → Task 2 Step 4. ✔
  - Edge cases (empty group hides heading; error/empty EmptyState unchanged; events-fail → all Wishlist) → Task 2 Steps 3–4 + Task 1 Step 2. ✔
  - Testing via `tsc --noEmit` + `yarn build` + manual → Task 3 Steps 3–5. ✔
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `getAvailabilityChecker` signature identical across Tasks 1/3; `CatalogItem.available: boolean` defined in Task 2, produced in Task 3; `nameDBenglish` is the field on `Artist.fields` (confirmed in `lib/cms/people.ts`).
