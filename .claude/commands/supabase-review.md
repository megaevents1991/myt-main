Review the specified file(s) for Supabase best practices.

Audit each file against the always-on standard in `@.claude/rules/standards/supabase.md`
(single source of truth). Confirm event reads go through `getEvents()` (ISR), not raw
queries.

Output per file: each rule **PASS** or **FAIL [line X]** + a one-line fix.

$ARGUMENTS
