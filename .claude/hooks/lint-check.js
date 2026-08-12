#!/usr/bin/env node
/**
 * Stop hook: run tsc + eslint when the session touched TS, surface REAL
 * failures back to Claude.
 * - Build ignores TS errors (next.config), so `tsc --noEmit` is the real type gate.
 * - Loop guard: stop_hook_active -> exit 0 (no endless lint->fix->stop cycle).
 * - Skips entirely when the working tree has no modified/untracked .ts/.tsx -
 *   the hook fires on every Stop and a clean tree has nothing new to check.
 * - eslint runs on the changed files only (`next lint` full-project takes 5m+
 *   on this checkout); tsc is whole-project but fast (~10s incremental).
 * - Tools are spawned as `node <local bin js>` - Node >= 20.12 refuses to
 *   spawn npx.cmd/yarn.cmd on Windows (EINVAL, CVE-2024-27980), and the
 *   corepack yarn v4 shim chokes on this repo's v1 lockfile anyway.
 * - FAIL-OPEN: never block on the hook's own infrastructure problems -
 *   missing node_modules/binary, spawn errors (string e.code), or a non-zero
 *   exit with no output. A non-zero EXIT STATUS lands in e.code as a NUMBER -
 *   that is a finding, not an infra failure; only string codes mean skip.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/** Changed/untracked .ts/.tsx paths, or null when git can't tell. */
function changedTsFiles(cwd) {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: "pipe",
      cwd,
    });
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        let p = l.slice(3);
        const arrow = p.indexOf(" -> "); // rename: keep the new path
        if (arrow !== -1) p = p.slice(arrow + 4);
        return p.replace(/^"|"$/g, "");
      })
      .filter((p) => /\.tsx?$/.test(p) && fs.existsSync(path.join(cwd, p)));
  } catch {
    return null;
  }
}

// {status: 'pass' | 'findings' | 'skip', out} - args[0] is a repo-relative JS bin.
function run(args, cwd) {
  const bin = path.join(cwd, args[0]);
  if (!fs.existsSync(bin)) return { status: "skip", out: "" };
  try {
    execFileSync(process.execPath, [bin, ...args.slice(1)], {
      encoding: "utf8",
      stdio: "pipe",
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { status: "pass", out: "" };
  } catch (e) {
    if (typeof e?.code === "string") return { status: "skip", out: "" }; // spawn-level failure
    const out = `${e.stdout || ""}${e.stderr || ""}`.trim();
    return out ? { status: "findings", out } : { status: "skip", out: "" };
  }
}

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }
  if (payload?.stop_hook_active) process.exit(0); // loop guard

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!fs.existsSync(path.join(root, "node_modules"))) process.exit(0); // deps not installed -> skip

  const files = changedTsFiles(root);
  if (files && files.length === 0) process.exit(0); // nothing TS-shaped changed

  const tsc = run(["node_modules/typescript/bin/tsc", "--noEmit"], root);
  const lint =
    files && files.length
      ? run(["node_modules/eslint/bin/eslint.js", ...files], root)
      : { status: "skip", out: "" };

  const blocks = [];
  if (tsc.status === "findings")
    blocks.push(`[tsc --noEmit]\n${tsc.out.slice(-4000)}`);
  if (lint.status === "findings")
    blocks.push(`[eslint (changed files)]\n${lint.out.slice(-4000)}`);

  if (!blocks.length) process.exit(0); // pass or skipped - let the session stop

  console.error(
    "Pre-stop checks failed - fix before wrapping up:\n\n" +
      blocks.join("\n\n"),
  );
  process.exit(2);
}
main();
