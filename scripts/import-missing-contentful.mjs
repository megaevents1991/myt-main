/**
 * Import ONLY Contentful entries missing in Supabase (found by
 * audit-contentful.mjs). Insert-only — never touches existing rows, so
 * backoffice edits are safe. Images re-hosted in the `templates` bucket
 * exactly like migrate-contentful.mjs.
 * Run: node scripts/import-missing-contentful.mjs
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
const BUCKET = "templates";

const MISSING = {
  artists: ["3Yoj8Nx5WL28qH4AeTuGTa"],
  football_teams: ["1jTTysxQdD5Am3AD6caylQ", "01LTsm7bCs2YMDVvdf8WRa"],
  blog_posts: ["61WHqAI7v9TJ83kr1Fc5QG", "575ZliMimR2pkYYaY9Tuts"],
};

async function rehost(banner) {
  const url = banner?.fields?.file?.url;
  if (!url) return { image_url: null, image_width: null, image_height: null };
  const assetId = banner.sys?.id || url.split("/").pop();
  const img = banner.fields.file.details?.image;
  const meta = { image_width: img?.width ?? null, image_height: img?.height ?? null };
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
    return { image_url: data.publicUrl, ...meta };
  } catch (e) {
    console.warn(`  image rehost failed (${assetId}): ${e.message} — keeping Contentful URL`);
    return { image_url: "https:" + url, ...meta };
  }
}

function personRow(e, img) {
  const f = e.fields || {};
  return {
    slug: e.sys.id,
    name: f.name ?? "",
    name_english: f.nameDBenglish ?? null,
    preview_text: f.previewText ?? null,
    ...img,
    bio: f.bio ?? null,
    seo_title: f.seoTitle ?? null,
    meta_description: f.metaDescription ?? null,
    meta_tags: f.metaTags ?? null,
    featured_order: null,
    is_active: true,
    is_deleted: false,
  };
}

function blogRow(e, img) {
  const f = e.fields || {};
  return {
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
  };
}

for (const [table, ids] of Object.entries(MISSING)) {
  for (const id of ids) {
    const e = await cf.getEntry(id, { include: 1 });
    const img = await rehost(e.fields?.heroBanner);
    const row = table === "blog_posts" ? blogRow(e, img) : personRow(e, img);
    const { error } = await sb.from(table).insert(row);
    if (error) {
      console.error(`  ${table} ${id} insert FAILED: ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log(`  ${table}: inserted ${id} "${row.name}"`);
    }
  }
}
console.log("done");
