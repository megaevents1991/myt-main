/**
 * Phase 1 data migration: copy ALL Contentful content (artists, football teams,
 * blog posts) into the Supabase tables created by
 * myt-backoffice/db/migrations/2026-06-17-create-artist-team-blog.sql.
 *
 * - Read-only on Contentful; idempotent on Supabase (upsert by slug = CF id).
 * - heroBanner images are downloaded and re-hosted in the `templates` bucket.
 * - Richtext (bio / mainContent) is stored verbatim as the Contentful JSON doc.
 * - Carousel order (artist + football) becomes `featured_order`.
 *
 * The live site keeps reading Contentful — this only fills the new tables.
 *
 * Prereqs: run the SQL migration first. Then:  node scripts/migrate-contentful.mjs
 */
import { createClient as createCF } from "contentful";
import { createClient as createSB } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  const out = {};
  const p = join(ROOT, ".env.local");
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...out, ...process.env };
}
const env = loadEnv();
const need = [
  "NEXT_SECRET_SUPABASE_URL",
  "NEXT_SECRET_SUPABASE_SERVICE_KEY",
  "CONTENTFUL_SPACE_ID",
  "CONTENTFUL_ACCESS_TOKEN",
];
for (const k of need) if (!env[k]) { console.error(`Missing ${k} in .env.local`); process.exit(1); }

const cf = createCF({ space: env.CONTENTFUL_SPACE_ID, accessToken: env.CONTENTFUL_ACCESS_TOKEN });
const sb = createSB(env.NEXT_SECRET_SUPABASE_URL, env.NEXT_SECRET_SUPABASE_SERVICE_KEY);

const BUCKET = "templates";
const ARTIST_CAROUSEL = "3RxzAgWZi26FSbBYhgMmVO";
const FOOTBALL_CAROUSEL = "2VjS97BWIScDQXwjx9Q4nP";

async function ensureBucket() {
  try { await sb.storage.createBucket(BUCKET, { public: true }); } catch { /* exists */ }
}

// Download a Contentful asset once and re-host it; name is deterministic by
// asset id so re-runs don't pile up duplicates.
const assetCache = new Map();
async function rehost(banner) {
  const url = banner?.fields?.file?.url;
  if (!url) return { image_url: null, image_width: null, image_height: null };
  const assetId = banner.sys?.id || url.split("/").pop();
  const img = banner.fields.file.details?.image;
  const meta = { image_width: img?.width ?? null, image_height: img?.height ?? null };
  if (assetCache.has(assetId)) return { image_url: assetCache.get(assetId), ...meta };
  try {
    const res = await fetch("https:" + url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (url.split(".").pop() || "jpg").split("?")[0].toLowerCase();
    const path = `migrated/${assetId}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: res.headers.get("content-type") || "image/jpeg", upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    assetCache.set(assetId, data.publicUrl);
    return { image_url: data.publicUrl, ...meta };
  } catch (e) {
    console.warn(`  image rehost failed (${assetId}): ${e.message} — keeping Contentful URL`);
    return { image_url: "https:" + url, ...meta };
  }
}

async function carouselOrder(entryId) {
  try {
    const e = await cf.getEntry(entryId, { include: 2 });
    const items = e.fields?.items || [];
    const map = new Map();
    items.forEach((it, i) => { if (it?.sys?.id) map.set(it.sys.id, i); });
    return map;
  } catch (e) {
    console.warn(`carousel ${entryId} fetch failed: ${e.message}`);
    return new Map();
  }
}

async function allEntries(contentType) {
  const out = [];
  let skip = 0;
  for (;;) {
    const res = await cf.getEntries({ content_type: contentType, include: 1, limit: 200, skip });
    out.push(...res.items);
    skip += res.items.length;
    if (skip >= res.total || res.items.length === 0) break;
  }
  return out;
}

async function upsert(table, rows) {
  if (!rows.length) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict: "slug" });
  if (error) { console.error(`  ${table} upsert failed:`, error.message); process.exitCode = 1; }
  else console.log(`  ${table}: upserted ${rows.length}`);
}

async function migratePeople(contentType, table, orderMap) {
  console.log(`\n${table} (${contentType})…`);
  const entries = await allEntries(contentType);
  const rows = [];
  for (const e of entries) {
    const f = e.fields || {};
    const img = await rehost(f.heroBanner);
    rows.push({
      slug: e.sys.id,
      name: f.name ?? "",
      name_english: f.nameDBenglish ?? null,
      preview_text: f.previewText ?? null,
      ...img,
      bio: f.bio ?? null,
      seo_title: f.seoTitle ?? null,
      meta_description: f.metaDescription ?? null,
      meta_tags: f.metaTags ?? null,
      featured_order: orderMap.has(e.sys.id) ? orderMap.get(e.sys.id) : null,
      is_active: true,
      is_deleted: false,
    });
  }
  await upsert(table, rows);
}

async function migrateBlog() {
  console.log(`\nblog_posts (blogTemplate)…`);
  const entries = await allEntries("blogTemplate");
  const rows = [];
  for (const e of entries) {
    const f = e.fields || {};
    const img = await rehost(f.heroBanner);
    rows.push({
      slug: e.sys.id,
      name: f.name ?? f.title ?? "",
      title: f.title ?? null,
      preview_text: f.previewText ?? null,
      by_who: f.byWho ?? null,
      ...img,
      main_content: f.mainContent ?? null,
      seo_title_tag: f.seoTitleTag ?? null,
      meta_description: f.metaDescription ?? null,
      meta_tags: f.metaTags ?? null,
      is_active: true,
      is_deleted: false,
    });
  }
  await upsert("blog_posts", rows);
}

async function run() {
  await ensureBucket();
  const [artistOrder, footballOrder] = await Promise.all([
    carouselOrder(ARTIST_CAROUSEL),
    carouselOrder(FOOTBALL_CAROUSEL),
  ]);
  await migratePeople("artistTemplate", "artists", artistOrder);
  await migratePeople("footballTeamTemplate", "football_teams", footballOrder);
  await migrateBlog();
  console.log("\ndone");
}

run().catch((e) => { console.error(e); process.exit(1); });
