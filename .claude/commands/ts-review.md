Review the specified file(s) for TypeScript best practices.

Audit each file against the always-on standard in `@.claude/rules/standards/typescript.md`
(single source of truth). Also check shared types stay in `lib/app.types.ts` and synced
with the backoffice (see `@.claude/rules/cross-project.md`).

Output per file: each rule **PASS** or **FAIL [line X]** + a one-line fix.

$ARGUMENTS
