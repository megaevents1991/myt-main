# Next.js 15 App Router Standard (always-on)

Non-negotiables for routes, pages, middleware. Calibrated to Next 15 + ISR strategy.

## Next 15 breaking-change watch
- **`params`/`searchParams` are Promises** in pages & route handlers — `const { id } = await params`. Never read them synchronously.
- **GET route handlers are NOT cached by default** in 15. If a `GET` should be static, add `export const dynamic = 'force-static'`; otherwise assume dynamic.

## API routes
- Named method exports: `export async function POST(request: Request)`. Return `NextResponse.json(...)` with an explicit status.
- Validate required inputs early → return `400` before any async work. Guard missing env vars at the top (see Amadeus guard in `flights/search/route.ts`).
- Wrap every external call (Amadeus, Ratehawk, Supabase) in `try/catch`; `console.error` before a `500`. Tracking calls wrapped separately.
- Business logic in `app/api/<feature>/utils.ts`, not in `route.ts`. Slow routes export `export const maxDuration = 30` (Amadeus/Ratehawk).

## Data fetching & ISR
- Event data via `lib/eventsData.ts` → `getEvents()` (cached with `next/cache`, `events` tag). **Never** query Supabase directly from a client component.
- Order pages (`app/order/[eventId]/page.tsx`) export `revalidate = 3600` + `dynamicParams = true`; new events flow through `generateStaticParams`.
- Invalidate by tag, not time-only. Don't bypass ISR with `no-store` outside API routes.

## Env vars
- `NEXT_SECRET_*` server-only — never in client/`"use client"` files. `NEXT_PUBLIC_*` only for client (`MARKUP`, `API_URL`, `MAPBOX_TOKEN`). New secret → add to `.env.local` + document in `CLAUDE.md`.

## Middleware & images
- `middleware.ts` scope = Mondial redirect + Cache-Control only. No auth/data-fetch/heavy compute (runs every request).
- `next/image` with `width`/`height` (or `fill`) — never raw `<img>` for content.

## Review output
Per file: each rule **PASS** or **FAIL [line X]** + one-line fix.
