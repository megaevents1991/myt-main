#!/usr/bin/env node
/**
 * PostToolUse hook (Edit|Write): if a shared types file was touched, remind to sync
 * the sibling repo. Non-destructive — the edit already happened; this only nudges.
 * Fails open.
 */
function readStdin() {
  try {
    return require("fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }
  const fp = String(
    payload?.tool_input?.file_path || payload?.tool_input?.path || ""
  ).replace(/\\/g, "/");

  if (/app\.types\.ts$/.test(fp)) {
    console.error(
      "Reminder: you edited a shared types file (app.types.ts). " +
        "Run /sync-types and mirror the change in the sibling repo " +
        "(lib/app.types.ts <-> backoffice types/app.types.ts)."
    );
    process.exit(2); // surface the reminder to Claude (does not undo the edit)
  }
  process.exit(0);
}
main();
