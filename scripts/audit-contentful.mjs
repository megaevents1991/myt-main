/**
 * Audit Contentful vs Supabase CMS tables.
 * - Lists EVERY content type in the space + entry counts (catches types the
 *   migration never covered).
 * - For the known type→table mappings, reports entries missing in Supabase
 *   (by slug = CF entry id) AND entries updated in Contentful after they were
 *   last updated in Supabase (field drift).
 * Read-only. Run: node scripts/audit-contentful.mjs
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

const MAPPED = {
  artistTemplate: "artists",
  footballTeamTemplate: "football_teams",
  blogTemplate: "blog_posts",
};
// select must only name fields that exist on the type — otherwise CDA 422s
const NAME_SELECT = {
  artistTemplate: "fields.name",
  footballTeamTemplate: "fields.name",
  blogTemplate: "fields.title",
};

console.log("=== Content types in Contentful space ===");
const types = await cf.getContentTypes({ limit: 1000 });
for (const t of types.items) {
  const { total } = await cf.getEntries({ content_type: t.sys.id, limit: 1 });
  const mapped = MAPPED[t.sys.id] ? `-> ${MAPPED[t.sys.id]}` : "!! NOT MIGRATED";
  console.log(`  ${t.sys.id.padEnd(28)} "${t.name}"  entries: ${String(total).padStart(3)}  ${mapped}`);
}

async function cfEntries(ct) {
  const out = [];
  let skip = 0;
  for (;;) {
    const r = await cf.getEntries({ content_type: ct, select: `sys.id,sys.updatedAt,${NAME_SELECT[ct]}`, limit: 200, skip });
    out.push(...r.items);
    skip += r.items.length;
    if (skip >= r.total || !r.items.length) break;
  }
  return out;
}

console.log("\n=== Coverage per mapped type (slug = CF entry id) ===");
for (const [ct, table] of Object.entries(MAPPED)) {
  let entries;
  try {
    entries = await cfEntries(ct);
  } catch (e) {
    console.log(`  ${ct}: content type not found in space (${e.message?.slice(0, 60)})`);
    continue;
  }
  const { data, error } = await sb.from(table).select("slug,updated_at,created_at");
  if (error) { console.log(`  ${table}: supabase error ${error.message}`); continue; }
  const bySlug = new Map(data.map((r) => [r.slug, r]));
  const missing = entries.filter((e) => !bySlug.has(e.sys.id));
  const drifted = entries.filter((e) => {
    const row = bySlug.get(e.sys.id);
    if (!row) return false;
    const rowTs = new Date(row.updated_at || row.created_at || 0).getTime();
    return new Date(e.sys.updatedAt).getTime() > rowTs;
  });
  console.log(`\n  ${ct} -> ${table}: CF ${entries.length} | SB ${data.length} | missing ${missing.length} | CF-newer ${drifted.length}`);
  for (const e of missing)
    console.log(`    MISSING  ${e.sys.id}  "${e.fields?.name ?? e.fields?.title ?? ""}"  (CF updated ${e.sys.updatedAt})`);
  for (const e of drifted)
    console.log(`    CF-NEWER ${e.sys.id}  "${e.fields?.name ?? e.fields?.title ?? ""}"  (CF ${e.sys.updatedAt} > SB ${bySlug.get(e.sys.id).updated_at ?? bySlug.get(e.sys.id).created_at})`);
}
console.log("\n=== Unmapped types — entry dump ===");
for (const ct of ["carousel", "blogPage"]) {
  const r = await cf.getEntries({ content_type: ct, include: 1, limit: 100 });
  for (const e of r.items) {
    const f = e.fields || {};
    const summary = Object.fromEntries(
      Object.entries(f).map(([k, v]) => [
        k,
        Array.isArray(v)
          ? v.map((x) => x?.sys?.id ?? x?.fields?.name ?? x).slice(0, 30)
          : v?.sys?.id ?? (typeof v === "object" ? JSON.stringify(v).slice(0, 120) : v),
      ])
    );
    console.log(`  [${ct}] ${e.sys.id} (updated ${e.sys.updatedAt}):`, JSON.stringify(summary, null, 2));
  }
}
console.log("\ndone");
