Review the specified file(s) for Supabase best practices, calibrated to this project.

## Rules to Check

### 1. Use the Shared Client
- Always import from `@/lib/supabase` — never instantiate `createClient()` inline
- The service-role client in `lib/supabase.ts` has elevated privileges — only use it server-side (API routes)

### 2. Always Handle Errors
- Every Supabase call returns `{ data, error }` — always check `if (error)` before using `data`
- Log the error with `console.error(JSON.stringify(error))` then return an appropriate HTTP status
- Never silently swallow Supabase errors

### 3. Query Shape — Explicit Selects
- Use `.select('col1, col2')` to fetch only needed columns — avoid `.select('*')` in hot paths
- Exception: `flights/search/route.ts` uses `.select('*')` for offline flights — acceptable since the table is small

### 4. Inserts — Explicit Column Mapping
- Map each column explicitly in `.insert({...})` — don't spread an entire object (risk of inserting unexpected fields)
- Pattern from `confirm-order/route.ts`: map each `validatedData.x` field individually

### 5. Single Row Queries — Use `.single()`
- When expecting exactly one row, chain `.single()` — it returns `data` as the object (not array) and sets `error` if zero or multiple rows found
- Don't do `data[0]` on a query that should return one row

### 6. No Raw SQL — Use the Query Builder
- Never use `supabase.rpc()` or raw SQL strings unless there's no query-builder alternative
- If a complex query is needed, add a Postgres function and call it via `rpc()` with typed params

### 7. Realtime / Subscriptions — Clean Up
- If adding a Supabase realtime subscription in a React component, unsubscribe in the `useEffect` cleanup
- Don't leave open channels — they count against connection limits

### 8. Type Safety — Validate Before Insert
- Use a `validateOrderData` style util (see `confirm-order/utils.ts`) to validate and shape data before inserting
- Don't insert raw `req.json()` output directly — always validate first

### 9. Caching — Don't Bypass ISR for Event Data
- Event data is cached via `lib/eventsData.ts` with `next/cache` — call `getEvents()`, not a raw Supabase query, in API routes that need event info
- Only query Supabase directly for non-cached, request-specific data (reservations, flights, affiliates)

## Output Format
For each file: list each rule as **PASS** or **FAIL [line X]** with a one-line fix for each failure.

$ARGUMENTS
