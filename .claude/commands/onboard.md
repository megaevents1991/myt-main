Full codebase walkthrough for a new engineer on **myt-main** (customer-facing booking app).

Walk through, reading the real files as you go:
1. **Big picture** — read `CLAUDE.md` + `.claude/AGENTS.md`. Explain the two-project platform
   (this app reads what `../myt-backoffice` writes; shared Supabase).
2. **Always-on rules** — summarize `.claude/rules/` (standards + pricing/order-flow/
   cross-project/conventions). These are the non-negotiables.
3. **Order flow** — trace `app/order/[eventId]` → `app/order/layout.tsx` (OrderContext,
   `app/app.context.ts`) → the 4 steps (Ticket/Flight/Hotel/Review). Note US events skip hotel.
4. **Data layer** — `lib/eventsData.ts` (ISR `getEvents()`), `lib/app.types.ts`, `lib/supabase.ts`.
5. **External vendors** — ticket routing by `event.type` (Supabase / XS2Event / Tixstock).
6. **Pricing** — `lib/price.utils.tsx` + `lib/exchangeRateService.ts` (USD→ILS, +175, cents).
7. **API routes** — pattern in `app/api/<feature>/{route.ts,utils.ts}`.
8. **Workflow** — feature branch only, `/review-my-code` before push, `/sync-types` if types
   change, never an AI co-author line.

End with: "Run `/mega-feature` before building, `/review` before a PR."

$ARGUMENTS
