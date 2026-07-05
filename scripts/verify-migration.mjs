/**
 * Verify Supabase fully covers Contentful — if every Contentful entry has a
 * matching Supabase row (by slug = CF id), the readers never hit the fallback.
 * Read-only. Run: node scripts/verify-migration.mjs
 */
import { createClient as createCF } from "contentful";
import { createClient as createSB } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = (() => {
  const o = {};
  const p = join(ROOT, ".env.local");
  if (existsSync(p))
    for (const l of readFileSync(p, "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  return { ...o, ...process.env };
})();

const cf = createCF({ space: env.CONTENTFUL_SPACE_ID, accessToken: env.CONTENTFUL_ACCESS_TOKEN });
const sb = createSB(env.NEXT_SECRET_SUPABASE_URL, env.NEXT_SECRET_SUPABASE_SERVICE_KEY);

async function cfIds(ct) {
  const out = [];
  let skip = 0;
  for (;;) {
    const r = await cf.getEntries({ content_type: ct, select: "sys.id", limit: 200, skip });
    out.push(...r.items.map((i) => i.sys.id));
    skip += r.items.length;
    if (skip >= r.total || !r.items.length) break;
  }
  return out;
}
async function sbSlugs(table) {
  const { data, error } = await sb.from(table).select("slug").eq("is_deleted", false);
  if (error) throw new Error(`${table}: ${error.message}`);
  return new Set(data.map((r) => r.slug));
}

async function check(label, ct, table) {
  const [ids, slugs] = await Promise.all([cfIds(ct), sbSlugs(table)]);
  const missing = ids.filter((id) => !slugs.has(id));
  console.log(
    `${label}: Contentful ${ids.length} | Supabase ${slugs.size} | missing-in-supabase ${missing.length}` +
      (missing.length ? ` -> ${missing.join(", ")}` : "  ✓ full coverage")
  );
  return missing.length === 0;
}

const ok = [
  await check("artists", "artistTemplate", "artists"),
  await check("football", "footballTeamTemplate", "football_teams"),
  await check("blog", "blogTemplate", "blog_posts"),
];
console.log(ok.every(Boolean) ? "\nALL COVERED — fallback never triggers, safe to remove Contentful." : "\nGAPS FOUND — re-run migrate before removing Contentful.");
