#!/usr/bin/env node
/*
 * SEO regression check (docs/superpowers/plans/2026-11-07-seo-to-100.md).
 * Records what a crawler reads on a fixed set of pages, so a change can be
 * shown to touch the <head> only and leave what a customer sees alone.
 *
 *   node scripts/seo-check.mjs snapshot <base> <out.json> [--orders=660,764]
 *   node scripts/seo-check.mjs diff <a.json> <b.json>
 *   node scripts/seo-check.mjs sitemap <base>
 *
 * Node built-ins only. Regex parsing is enough for our own server-rendered HTML.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const PROD = "https://www.mega-events.co.il";
const UA = "Mozilla/5.0 (compatible; myt-seo-check/1.0)";
const PATHS = [
  "/",
  "/about",
  "/faq",
  "/terms",
  "/privacy",
  "/accessibility",
  "/search?q=london",
  "/c/football",
  "/c/music",
  "/c/destinations/london",
  "/c/music/artists/coldplay",
  "/artists/black-coffee",
  "/order/999999",
];

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"));
  return m ? decode(m[1]) : null;
};

const metaTags = (html, pred) => (html.match(/<meta\s[^>]*>/gi) ?? []).filter(pred);

function jsonLdTypes(html) {
  const types = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node["@type"]) types.push(...[].concat(node["@type"]));
    Object.values(node).forEach(walk);
  };
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      types.push("!INVALID_JSON");
    }
  }
  const counts = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

function visibleLines(html) {
  const body = html.replace(/^[\s\S]*?<body[^>]*>/i, "");
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "\n");
  return decode(stripped)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function inspect(base, path) {
  const url = base + path;
  let res;
  try {
    res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA }, signal: AbortSignal.timeout(60000) });
  } catch (e) {
    return { path, error: String(e) };
  }
  const out = { path, status: res.status, xRobotsTag: res.headers.get("x-robots-tag") };
  if (res.status >= 300 && res.status < 400) {
    out.location = res.headers.get("location");
    return out;
  }
  const html = await res.text();
  const head = html.split(/<body[\s>]/i)[0] ?? html;
  const titleM = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const canon = (head.match(/<link\s[^>]*rel="canonical"[^>]*>/gi) ?? []).map((t) => attr(t, "href"));
  Object.assign(out, {
    bytes: html.length,
    title: titleM ? decode(titleM[1]).trim() : null,
    description: metaTags(head, (t) => /name="description"/i.test(t)).map((t) => attr(t, "content"))[0] ?? null,
    canonical: canon.length > 1 ? canon : canon[0] ?? null,
    robots: metaTags(html, (t) => /name="robots"/i.test(t)).map((t) => attr(t, "content")),
    refresh: metaTags(html, (t) => /http-equiv="refresh"/i.test(t)).map((t) => attr(t, "content")),
    ogTitle: metaTags(head, (t) => /property="og:title"/i.test(t)).map((t) => attr(t, "content"))[0] ?? null,
    ogLocale: metaTags(head, (t) => /property="og:locale"/i.test(t)).map((t) => attr(t, "content"))[0] ?? null,
    hreflang: (head.match(/<link\s[^>]*hreflang="[^"]*"[^>]*>/gi) ?? []).map((t) => `${attr(t, "hreflang")} ${attr(t, "href")}`),
    jsonLd: jsonLdTypes(html),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()),
    imgs: (html.match(/<img\s/gi) ?? []).length,
    links: (html.match(/<a\s[^>]*href=/gi) ?? []).length,
    csrBailout: html.includes("BAILOUT_TO_CLIENT_SIDE_RENDERING"),
    text: visibleLines(html),
  });
  return out;
}

async function orderIdsFromSitemap(base) {
  const xml = await (await fetch(`${base}/sitemap.xml`, { headers: { "user-agent": UA } })).text();
  const ids = [...xml.matchAll(/\/order\/(\d+)</g)].map((m) => m[1]);
  return [ids[0], ids[Math.floor(ids.length / 2)]].filter(Boolean);
}

async function snapshot(base, outFile, ordersArg) {
  const orders = ordersArg ? ordersArg.split(",") : await orderIdsFromSitemap(PROD);
  const paths = [...PATHS, ...orders.map((id) => `/order/${id}`)];
  const pages = [];
  for (const p of paths) {
    process.stderr.write(`  ${p}\n`);
    pages.push(await inspect(base, p));
  }
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify({ base, at: new Date().toISOString(), orders, pages }, null, 1));
  console.log(`saved ${pages.length} pages from ${base} -> ${outFile} (orders ${orders.join(",")})`);
}

const FIELDS = ["status", "location", "xRobotsTag", "title", "description", "canonical", "robots", "refresh", "ogTitle", "ogLocale", "hreflang", "jsonLd", "h1", "imgs", "links", "csrBailout"];

async function diff(aFile, bFile) {
  const a = JSON.parse(await readFile(aFile, "utf8"));
  const b = JSON.parse(await readFile(bFile, "utf8"));
  const byPath = new Map(b.pages.map((p) => [p.path, p]));
  let changedPages = 0;
  for (const pa of a.pages) {
    const pb = byPath.get(pa.path);
    if (!pb) {
      console.log(`\n## ${pa.path}: missing in ${bFile}`);
      continue;
    }
    const lines = [];
    for (const f of FIELDS) {
      const va = JSON.stringify(pa[f] ?? null);
      const vb = JSON.stringify(pb[f] ?? null);
      if (va !== vb) lines.push(`  ${f}:\n    - ${va}\n    + ${vb}`);
    }
    const ta = new Set(pa.text ?? []);
    const tb = new Set(pb.text ?? []);
    const onlyA = [...ta].filter((l) => !tb.has(l));
    const onlyB = [...tb].filter((l) => !ta.has(l));
    if (onlyA.length || onlyB.length) {
      lines.push(`  visible text: ${onlyA.length} line(s) gone, ${onlyB.length} new (of ${ta.size} -> ${tb.size})`);
      onlyA.slice(0, 8).forEach((l) => lines.push(`    - ${l.slice(0, 140)}`));
      onlyB.slice(0, 8).forEach((l) => lines.push(`    + ${l.slice(0, 140)}`));
    }
    if (pa.bytes && pb.bytes) {
      const pct = Math.round(((pb.bytes - pa.bytes) / pa.bytes) * 100);
      if (Math.abs(pct) >= 5) lines.push(`  bytes: ${pa.bytes} -> ${pb.bytes} (${pct > 0 ? "+" : ""}${pct}%)`);
    }
    if (lines.length) {
      changedPages++;
      console.log(`\n## ${pa.path}\n${lines.join("\n")}`);
    }
  }
  console.log(`\n${changedPages} of ${a.pages.length} pages differ (${a.base} @ ${a.at} vs ${b.base} @ ${b.at})`);
}

async function sitemap(base) {
  const xml = await (await fetch(`${base}/sitemap.xml`, { headers: { "user-agent": UA } })).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const groups = {};
  for (const loc of locs) {
    const parts = new URL(loc).pathname.split("/").filter(Boolean);
    const key = parts[0] === "c" ? `/c/${parts[1] ?? ""}` : `/${parts[0] ?? ""}`;
    (groups[key] ??= []).push(loc);
  }
  console.log(`${locs.length} URLs in ${base}/sitemap.xml`);
  for (const [key, list] of Object.entries(groups).sort((x, y) => y[1].length - x[1].length)) {
    const sample = list.slice(0, 4);
    const checks = [];
    for (const loc of sample) {
      const r = await inspect(base, new URL(loc).pathname);
      const bad = r.status !== 200 || r.refresh?.length || (r.robots ?? []).some((x) => /noindex/i.test(x));
      checks.push(bad ? `${r.status}${r.refresh?.length ? "+refresh" : ""}${(r.robots ?? []).some((x) => /noindex/i.test(x)) ? "+noindex" : ""}` : "ok");
    }
    console.log(`  ${key.padEnd(22)} ${String(list.length).padStart(4)}  sample: ${checks.join(" ")}`);
  }
}

const [mode, ...args] = process.argv.slice(2);
const flag = (name) => args.find((x) => x.startsWith(`--${name}=`))?.split("=")[1];
const pos = args.filter((x) => !x.startsWith("--"));
if (mode === "snapshot" && pos.length === 2) await snapshot(pos[0].replace(/\/$/, ""), pos[1], flag("orders"));
else if (mode === "diff" && pos.length === 2) await diff(pos[0], pos[1]);
else if (mode === "sitemap" && pos.length === 1) await sitemap(pos[0].replace(/\/$/, ""));
else {
  console.error("usage: seo-check.mjs snapshot <base> <out.json> [--orders=a,b] | diff <a.json> <b.json> | sitemap <base>");
  process.exit(2);
}
