# React 19 Standard (always-on)

Non-negotiables for components/hooks. Calibrated to React 19 + Next 15 App Router.

## Component model
- **Server Components by default.** Add `"use client"` only for hooks, event handlers, browser APIs, or interactive Mantine UI — and place it as deep in the tree as possible (never on a layout/page for convenience).
- **No legacy patterns:** no `React.FC`, no class components. Type props inline: `function C({ x }: { x: string })`.
- **React 19:** `ref` is a plain prop — no `forwardRef`. Prefer `useActionState` / `useFormStatus` / `useOptimistic` for form/async UI, and the `use` hook for unwrapping promises/context in render.

## State
- Order-flow state (flight, hotel, ticket, step, passengers, planeTickets) lives in **`OrderContext`** (`app/app.context.ts`). Local `useState` only for UI-only state (spinners, modal open, unsubmitted input).
- Read context via `useContext(OrderContext)` — never prop-drill it. Don't create new contexts for things already in `OrderContext`.
- Hotel fetching goes through `HotelFetchProvider` (`app/hooks/HotelFetch.provider.tsx`) — never re-fetch hotels in render.
- Loading that blocks step progression uses `globalLoader`/`setGlobalLoader` from context — no second full-screen spinner.

## Effects & memo
- **You might not need an Effect.** Don't use `useEffect` for data flow or derived state — compute during render. Effects are for external-system sync only.
- Always a dependency array; clean up subscriptions/timers in the return. Session expiry already handled by `useOrderExpiry` — don't duplicate.
- `useMemo`/`useCallback` only when measured (memoized child, expensive calc) — not by default.

## Lists & handlers
- Stable unique keys (`flight.id`, `hotel.id`) — never array index for filterable/reorderable lists.
- `useCallback` for handlers passed to memoized children; inline arrows fine for simple one-offs.

## Analytics & styling
- Fire Mixpanel/GTM in event handlers or state-driven effects — **never in render**. Use `lib/mixpanel.ts` + `lib/gtmAnalytics.ts`, not `window.dataLayer.push` directly.
- Mantine props for Mantine internals; Tailwind for layout/spacing. RTL via `rtl:` prefix or `dir="rtl"` — never hardcode `left`/`right`.

## Review output
Per file: each rule **PASS** or **FAIL [line X]** + one-line fix.
