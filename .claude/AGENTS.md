# AGENTS.md — myt-main (engineer & agent onboarding)

Coding patterns for this repo. Read this + the always-on rules in `.claude/rules/` before
writing code. Full architecture lives in `CLAUDE.md`. New engineer? Run `/onboard`.

## What this app is
Customer-facing booking app (Hebrew/RTL). Users build event packages: tickets + flights +
hotels → pay. Reads the Supabase data the backoffice writes.

## Golden patterns (with where to copy from)
- **Order state** → `OrderContext` (`app/app.context.ts`). Read via `useContext`, never prop-drill. UI-only state may use local `useState`.
- **API route** → `app/api/<feature>/route.ts`, logic in `utils.ts`. Validate early → `400`; wrap external calls in `try/catch` → `console.error` → `500`. Copy `flights/search/route.ts`.
- **Event data** → `getEvents()` in `lib/eventsData.ts` (ISR-cached). Never raw Supabase in a client component.
- **Prices** → `lib/price.utils.tsx` + `lib/exchangeRateService.ts`. USD internal, ILS at display, +175 markup, sports tickets in cents. See `.claude/rules/pricing.md`.
- **Ticket UI** → branch on `event.type` (see `.claude/rules/order-flow.md`).
- **Analytics** → `lib/mixpanel.ts` + `lib/gtmAnalytics.ts`, fired on user action.
- **Types** → `lib/app.types.ts` only; keep synced with backoffice (`/sync-types`).

## Don'ts
- No `any`, no `React.FC`/class components, no new UI/analytics libs, no hardcoded exchange
  rates, no `NEXT_SECRET_*` in client code, no hard-deletes, no AI co-author in commits.

## Before you push
1. `/review-my-code` (or `/review` for a PR-style pass) 2. `/sync-types` if types changed
3. `tsc --noEmit` (build ignores TS errors) 4. Feature branch, never commit to `main`.

## Useful commands
`/mega-feature` `/mega-review` `/ts-review` `/react-review` `/nextjs-review`
`/supabase-review` `/review` `/onboard` `/review-my-code` — plus global `/price-audit`,
`/sync-types`, `/new-event-page`, `/deploy-check`.
