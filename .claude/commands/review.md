Local PR-style review of the current branch's changes (the manual "review on each PR" pass,
since Claude Code hooks can't fire on a GitHub PR).

## Steps
1. Get the diff vs `main`: `git diff main...HEAD` (and unstaged `git diff`). If a target is
   given in $ARGUMENTS, scope to that.
2. For each changed file, audit against the relevant always-on standards:
   - `@.claude/rules/standards/typescript.md`
   - `@.claude/rules/standards/react.md`
   - `@.claude/rules/standards/nextjs.md`
   - `@.claude/rules/standards/supabase.md`
   And the MYT domain rules: `@.claude/rules/pricing.md`, `@.claude/rules/order-flow.md`,
   `@.claude/rules/conventions.md`.
3. **Cross-project impact** (`@.claude/rules/cross-project.md`): if the diff touches
   `lib/app.types.ts`, the `/api/hotels` `/api/revalidate` `/api/flights/search` routes,
   pricing, or shared DB columns — flag what must change in `../myt-backoffice`. Use the
   `cross-impact-reviewer` agent for a deep pass when types/API/price are involved.
4. Run `tsc --noEmit` mentally/where possible (build ignores TS errors).

## Output
- Summary verdict: SHIP / FIX FIRST.
- Findings grouped by file: **FAIL [file:line]** rule + concrete fix.
- A dedicated "Cross-project" section if the sibling repo is affected.

$ARGUMENTS
