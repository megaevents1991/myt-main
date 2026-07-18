# Supabase Standard (always-on)

Non-negotiables for DB access. Shared service-role DB across main + backoffice.

## Client
- Import the shared client from `@/lib/supabase` — never `createClient()` inline.
- Service-role/secret key bypasses RLS → **server-side only** (API routes). Never ship it to the client.

## Errors
- Every call returns `{ data, error }` — check `if (error)` before using `data`. `console.error(JSON.stringify(error))`, then return the right HTTP status. Never silently swallow.

## Queries
- **Explicit selects:** `.select('col1, col2')` — avoid `.select('*')` on hot paths (small offline tables like flights are the exception).
- Exactly one row → chain `.single()` (or `.maybeSingle()` when zero is valid). Never `data[0]` for a single-row query.
- No raw SQL / `rpc()` unless the query builder can't express it; if needed, a typed Postgres function.

## Inserts
- Map columns explicitly in `.insert({...})` — never spread a whole request object (risks unexpected fields).
- Validate + shape first (`validateOrderData` pattern in `confirm-order/utils.ts`) — never insert raw `req.json()`.
- `.insert(...).select()` if you need the inserted row back (v2 requires explicit `.select()`).

## Caching & realtime
- Event data is ISR-cached via `getEvents()` — call that, not a raw query, in routes needing event info. Direct queries only for request-specific data (reservations, flights, affiliates).
- Realtime subscriptions: unsubscribe in `useEffect` cleanup — don't leak channels.

## Review output
Per file: each rule **PASS** or **FAIL [line X]** + one-line fix.
