# MYT Conventions (always-on) — myt-main

Quick repo-wide musts. Tech depth lives in `standards/` (TS/React/Next/Supabase).

- **Stack:** Next 15 App Router, React 19, TypeScript, Tailwind, Mantine + shadcn/ui (Radix).
- **Hebrew/RTL:** all user-facing text Hebrew, `lang="he"`, RTL layout. No hardcoded `left`/`right`.
- **Server Actions** preferred over API routes when possible; Tailwind inline over separate CSS.
- **Soft deletes:** `is_deleted` = date string `"MM-DD-YYYY"`, not boolean. Never hard-delete events.
- **No new UI/analytics libs** — use existing Mantine/shadcn + Mixpanel/GTM.
- **Build ignores TS/ESLint errors** (next.config) — so `tsc --noEmit` is the real type gate; don't rely on `yarn build` to catch types.
- Conventional commits (`feat(scope): …`). **Never** add an AI co-author line.
