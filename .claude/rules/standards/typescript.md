# TypeScript Standard (always-on)

Non-negotiables for all `.ts`/`.tsx` in this repo. Calibrated to MYT conventions.

## Types
- **No `any`.** Use `unknown` + narrow, or define an `interface` for external shapes (e.g. raw Amadeus response — type it locally, cast once at the boundary).
- **All shared domain types live in `lib/app.types.ts`** — `Flight`, `Event`, `EventType`, `OrderData`, `OrderTicket`, `FlightSegment`, etc. Extend there; never fork parallel local copies.
- **Discriminated unions over casts.** `EventType` and search-criteria types are unions — narrow by the discriminant, never `as`.
- **String unions, not `enum`.** Need a runtime list? `const X = [...] as const; type X = typeof X[number]`.

## Safety
- `?.` / `??` for possibly-undefined values. **No non-null `!`** unless a guard already proved existence.
- **No `as` to silence a mismatch** mid-logic — fix the type. `{} as AppContext` only in init/empty-state is OK.
- Prefer `satisfies` over `as` when asserting a literal matches a type without widening it.

## Inference & utility types
- Let TS infer simple return types. Annotate only contracts: API handlers, context setters, service fns.
- `Omit`/`Pick` over re-listing fields — e.g. `OrderTicket = Omit<EventTicket,'colorOnTheMap'> & { quantity: number }`.

## Async
- Every `async` fn in `app/api/` wrapped in `try/catch`.
- Analytics/tracking calls wrapped separately so their failure never breaks the request.

## Review output (when used by a command)
Per file: each rule **PASS** or **FAIL [line X]** + one-line fix.
