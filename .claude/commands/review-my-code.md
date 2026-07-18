Project-specific review of YOUR recent (uncommitted) changes before pushing — myt-main.

1. `git diff` (unstaged + staged) to find what you changed. If $ARGUMENTS names files,
   scope to those.
2. Audit each changed file against the always-on standards + MYT domain rules in
   `.claude/rules/` (TS, React, Next, Supabase, pricing, order-flow, conventions).
3. Flag cross-project risk per `@.claude/rules/cross-project.md` (types/API/price/DB).
4. Quick checklist: no `any`, no `React.FC`, no hardcoded rates, no `NEXT_SECRET_*` client
   leak, Hebrew/RTL for user-facing text, no AI co-author line staged.

Output: **FAIL [file:line]** + fix per finding; end with SHIP / FIX FIRST.

$ARGUMENTS
