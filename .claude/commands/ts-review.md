Review the specified file(s) for TypeScript best practices, calibrated to this project's conventions.

## Rules to Check

### 1. No `any` — Use Project Types
- Never use `any` unless wrapping an external API response that lacks types (Amadeus raw response)
- In that case, define a local `interface` for the shape (like `AmadeusError` in `flights/search/route.ts`) and cast once at the boundary
- All shared domain types belong in `lib/app.types.ts` — `Flight`, `Event`, `OrderData`, `OrderTicket`, `FlightSegment`, etc.

### 2. Discriminated Unions — Use Them
- `EventType`, `HotelSearchCriteria`, `FlightSearchCriteria` are discriminated unions — use `type` narrowing, never cast
- When adding a new filter or event type, extend the union in `lib/app.types.ts`, don't create parallel local types

### 3. Optional Chaining & Nullability
- Use `?.` and `??` for values that may be undefined (e.g. API response fields)
- Don't use non-null assertion `!` unless you've already verified existence with a guard

### 4. Type Inference — Don't Over-Annotate
- Let TypeScript infer return types for simple functions — only annotate when the return type is non-obvious or used as a contract
- Do annotate: API route handlers, context setters, service functions
- `Dispatch<SetStateAction<T>>` is already typed in context — don't re-annotate at call sites

### 5. `as` Casts — Limit to Initialization
- `{} as AppContext` and `{} as Flight` in initialization/empty-state is acceptable
- Never use `as` to silence a type mismatch mid-logic — fix the type instead

### 6. Enums → Union Types
- This codebase uses string union types (`EventType`, `SortOptions`) — don't introduce `enum`
- If you need a runtime list of values, use `const` array + `typeof arr[number]`

### 7. Async/Await — Always Handle Errors
- Every `async` function in `app/api/` must have a `try/catch`
- Analytics calls must never propagate errors to the main request (wrap in try/catch, log with `console.warn`)

### 8. `Omit` / `Pick` — Prefer Over Redefining
- `OrderTicket` is `Omit<EventTicket, 'colorOnTheMap'> & { quantity: number }` — follow this pattern rather than copy-pasting fields

## Output Format
For each file: list each rule as **PASS** or **FAIL [line X]** with a one-line fix for each failure.

$ARGUMENTS
