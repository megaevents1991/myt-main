Review the specified file(s) for React best practices, calibrated to this project (React 19, Next.js 15 App Router).

## Rules to Check

### 1. State Location — OrderContext is the Source of Truth
- Order-flow state (flight, hotel, ticket, step, passengers, planeTickets) must live in `OrderContext` (`app/app.context.ts`)
- Local `useState` is fine for UI-only state (loading spinners, modal open/close, form input before submission)
- Never duplicate order state locally and then sync it up — read directly from context

### 2. Context — Consume Correctly
- Use `useContext(OrderContext)` to read order state — never pass it as props through multiple layers
- Don't create new contexts for things already in `OrderContext`
- `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`) handles hotel fetching — don't re-fetch hotels in component render

### 3. Server vs Client Components
- Default to Server Components — only add `"use client"` when you need: hooks, event handlers, browser APIs, or Mantine/interactive UI
- Never put `"use client"` on a layout or page just for convenience — keep it as deep in the tree as possible
- Data fetching in Server Components uses `lib/eventsData.ts` + `next/cache` — don't `fetch()` Supabase directly in a client component

### 4. React 19 — No Legacy Patterns
- Don't use `React.FC` type — just type props inline: `function MyComponent({ prop }: { prop: string })`
- Don't use class components
- Use the `use` hook for async resources in Server Components where applicable
- `useEffect` for data fetching is a last resort (client-only side effects) — prefer Server Components + `async/await`

### 5. `useEffect` — Minimal and Correct
- Always include a dependency array
- Never fetch data in `useEffect` if a Server Component or React Query pattern works
- Cleanup side effects (subscriptions, timers) with a return function
- `useOrderExpiry` (`app/hooks/useOrderExpiry.tsx`) manages session expiry — don't duplicate timer logic

### 6. Event Handlers — No Inline Arrow Functions on Hot Paths
- Define handlers with `useCallback` when passed as props to memoized children
- Inline `() => setState(x)` in JSX is fine for simple, non-repeated cases

### 7. Lists — Always Key Correctly
- Use stable, unique IDs as keys: `flight.id`, `hotel.id`, `ticket.id`
- Never use array index as key for lists that can reorder or filter

### 8. Analytics — Fire at User Action, Not on Render
- Mixpanel and GTM events must fire in event handlers or `useEffect` triggered by state change — never in render
- Use `lib/mixpanel.ts` helpers and `lib/gtmAnalytics.ts` — don't call `window.dataLayer.push` directly in components

### 9. Mantine + Tailwind — Don't Mix Styling Systems
- Use Mantine component props (`size`, `color`, `variant`) for Mantine components — don't override with arbitrary Tailwind classes unless necessary
- Use Tailwind for layout and spacing between components; Mantine for component internals
- RTL: use `rtl:` Tailwind prefix or Mantine's `dir="rtl"` — never hardcode `left`/`right` in directions

### 10. Loading States — Use `globalLoader`
- The `globalLoader` / `setGlobalLoader` in `OrderContext` controls the step-level loading indicator
- Use it for async operations that block step progression (flight search, hotel fetch)
- Don't add a second full-screen spinner — use `globalLoader`

## Output Format
For each file: list each rule as **PASS** or **FAIL [line X]** with a one-line fix for each failure.

$ARGUMENTS
