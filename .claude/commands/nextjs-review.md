Review the specified file(s) for Next.js 15 App Router best practices, calibrated to this project.

## Rules to Check

### 1. API Routes — Standard Shape
- Every route file exports named HTTP method functions: `export async function POST(request: Request)`
- Always return `NextResponse.json(...)` with an explicit HTTP status code
- Validate required inputs early and return `{ status: 400 }` before doing any async work
- Check for missing env vars at the top of route handlers (like the Amadeus client guard in `flights/search/route.ts`)

### 2. API Routes — Error Handling
- Wrap all external API calls (Amadeus, Ratehawk, Supabase) in `try/catch`
- Log errors with `console.error` before returning a 500
- Analytics/tracking calls must be wrapped separately so their failure never causes the main route to fail

### 3. ISR — Required on Order Pages
- `app/order/[eventId]/page.tsx` must export: `export const revalidate = 3600` and `export const dynamicParams = true`
- New event pages should be added to `generateStaticParams` via `lib/eventsData.ts`
- Use `next/cache` tags (`events`) for cache invalidation — not time-only revalidation

### 4. Data Fetching — Server-Side First
- Use `lib/eventsData.ts` → `getEvents()` for event data — it's cached with `next/cache`
- Never call Supabase directly from a client component — go through an API route
- For API routes that need event data, call `getEvents()` (ISR-cached), not a raw Supabase query

### 5. Environment Variables
- `NEXT_SECRET_*` vars: server-only — never reference in client components or `"use client"` files
- `NEXT_PUBLIC_*` vars: safe for client — `NEXT_PUBLIC_MARKUP`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`
- If a new secret is needed, add it to `.env.local` and document it in `CLAUDE.md`

### 6. Route Organization
- API routes live in `app/api/<feature>/route.ts`
- Utility/helper functions for a route go in the same folder: `app/api/<feature>/utils.ts`
- Don't put business logic in `route.ts` — extract to helpers in the same directory

### 7. `maxDuration` — Set on Slow Routes
- Routes calling Amadeus must export `export const maxDuration = 30` (already done in `flights/search/route.ts`)
- Hotel search routes with long Ratehawk calls should similarly set `maxDuration`

### 8. Middleware — Don't Expand Scope
- `middleware.ts` handles: Mondial redirect + Cache-Control headers
- Don't add auth logic, data fetching, or heavy computation to middleware — it runs on every request

### 9. Image Optimization
- Use `next/image` for all images — never raw `<img>` tags for content images
- Provide `width` and `height` (or `fill`) — don't omit them

### 10. `"use client"` Placement
- Only mark files `"use client"` when they use hooks, browser APIs, or interactive Mantine components
- Keep `"use client"` as close to the leaf component as possible — never on layouts

## Output Format
For each file: list each rule as **PASS** or **FAIL [line X]** with a one-line fix for each failure.

$ARGUMENTS
