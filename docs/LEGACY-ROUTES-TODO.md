# LEGACY ROUTES — removal checklist (2026-08-14)

The `/c/` taxonomy tree is the canonical URL space. The old routes now only
308-redirect and exist for old links, running campaigns and Google's index.

**Grep marker:** every touched spot carries a `LEGACY-ROUTE` comment —
`grep -rn "LEGACY-ROUTE" app components lib` lists them all.

## Current state (phase 1 — redirects, nothing deleted)

| Old URL | Now |
|---|---|
| `/football` | 308 → `/c/football/teams` |
| `/artists` | 308 → `/c/music/artists` |
| `/football/<cmsId>` | 308 → `/c/football/teams/<slug>` when a category twin exists; renders in place otherwise |
| `/artists/<cmsId>` | 308 → `/c/music/artists/<slug>` when a twin exists; renders in place otherwise |

Direct `/c/` links already used by: header nav (`components/Header.tsx`
staticNavLinks), footer (`app/layout.tsx`), catalog cards
(`components/CmsCatalog.tsx` via `lib/cmsTwin.ts` `buildPersonHrefIndex`,
fallback = legacy detail URL when a person has no category twin).

New creations need nothing: a Templates artist/team card auto-creates its
tag+rule+category (backoffice `lib/services/taxonomy-sync.ts`), so its /c/
page and card link exist from the start. Categories are /c/-native.

## Still linking the OLD pattern (ride the 308 today — switch before delete)

- `components/HeroCarousel.tsx` — carousel card links
- `components/HeroSearch.tsx` — search result links
- `components/ClientSideHomepage.tsx` — homepage sections
- `app/order/[eventId]/page.tsx` — back-links to artist/team pages
- `app/api/revalidate/route.ts` — revalidates the old paths (harmless; drop with the routes)
- `app/*/opengraph-image.tsx` under football/artists if present

## Delete-for-real steps (ONLY after campaigns + ads run on /c/ URLs)

1. Switch the "still linking" list above to `/c/` links (reuse
   `buildPersonHrefIndex` / `personCategoryHref` from `lib/cmsTwin.ts`).
2. Keep `app/football/page.tsx` + `app/artists/page.tsx` as one-line 308s
   (cheap, safe) — or move the redirects to `next.config.ts` and delete the
   files.
3. `app/football/[slug]` + `app/artists/[slug]`: confirm every CMS person has
   a category twin (`buildPersonHrefIndex` covers all → no in-place renders in
   logs), then replace the pages with plain twin-redirects; later delete +
   next.config redirect to the hub as last resort.
4. Remove the `href` fallback in `components/CatalogPageTemplate.tsx` and the
   fallback branch in `CmsCatalog`.
5. Drop the old-path `revalidatePath` calls in `app/api/revalidate/route.ts`.
6. Update `sitemap.xml` route if it still emits old URLs (it emits /c/ already).
7. Delete this file.
