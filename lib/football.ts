import { makePeopleReaders, type PersonImageEntry } from "@/lib/cms/people";
import { supabase } from "@/lib/supabase";
import { isTightCrest, FOOTBALL_CREST_ART } from "@/lib/eventArt";
import { clubNamesMatch } from "@/lib/eventNameMatch";
import type { FootballTeam } from "@/lib/app.types";

const r = makePeopleReaders({ table: "football_teams" });

/**
 * Football card-art resolution order (per product spec, 2026-07-22 rev 2):
 * 1. football_logos LIBRARY crest by club name — the PRIMARY source for EVERY
 *    team (not just imageless ones): one crop style across the site is what
 *    makes the crest standard actually look uniform. Name matching tolerates
 *    qualifier drift via clubNamesMatch ("Tottenham Hotspur FC" ≡ library's
 *    "Tottenham Hotspur"); Hebrew names compare exactly.
 * 2. No library row (Bayern, PSG) → the team's own template image (templates
 *    bucket upload or legacy art_blobs cutout) as before.
 * 3. Nothing at all → heroBanner photo card.
 *
 * Standardization: every tight crest (library included) renders with
 * FOOTBALL_CREST_ART (stadium background + one size). Per-team dials are
 * ignored for crests on purpose — uniformity is the requirement, and per-team
 * knobs caused three production bugs.
 */
const standardizeCrest = (t: FootballTeam): FootballTeam =>
  isTightCrest(t.fields.artImageUrl)
    ? {
        ...t,
        fields: {
          ...t.fields,
          artShapeIndex: FOOTBALL_CREST_ART.shapeIndex,
          artImageScale: FOOTBALL_CREST_ART.imageScale,
          artImageOffsetX: FOOTBALL_CREST_ART.imageOffsetX,
          artImageOffsetY: FOOTBALL_CREST_ART.imageOffsetY,
          // No artBgScale: the stadium photo object-covers the box (EventArt),
          // so a bg zoom dial has nothing left to fix.
        },
      }
    : t;

type LogoRow = { name_english: string; name_hebrew: string | null; logo_url: string };

async function fetchLogoLibrary(): Promise<LogoRow[]> {
  const { data, error } = await supabase
    .from("football_logos")
    .select("name_english,name_hebrew,logo_url");
  if (error) {
    console.error("football_logos read failed:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as LogoRow[];
}

/** Library crest for a club name pair — exact english, exact hebrew, then
 *  token-equal english (qualifier drift). */
const libraryUrlFor = (
  english: string | undefined,
  hebrew: string | undefined,
  lib: LogoRow[]
): string | null => {
  const en = (english ?? "").trim();
  const he = (hebrew ?? "").trim();
  const row =
    (en &&
      lib.find((l) => l.name_english.trim().toLowerCase() === en.toLowerCase())) ||
    (he && lib.find((l) => l.name_hebrew?.trim() === he)) ||
    (en && lib.find((l) => clubNamesMatch(l.name_english, en))) ||
    null;
  return row ? row.logo_url : null;
};

/** Library-first crest resolution for every team (step 1 above). */
async function resolveCrests(teams: FootballTeam[]): Promise<FootballTeam[]> {
  const lib = await fetchLogoLibrary();
  if (!lib.length) return teams;
  return teams.map((t) => {
    const url = libraryUrlFor(t.fields.nameDBenglish, t.fields.name, lib);
    return url ? { ...t, fields: { ...t.fields, artImageUrl: url } } : t;
  });
}

// Artist and FootballTeam are structurally identical, so the people readers'
// Artist-shaped results are valid FootballTeam values.
export const getAllFootballTeams = async (): Promise<FootballTeam[]> =>
  (await resolveCrests(await r.listAll())).map(standardizeCrest);
export const getFeaturedFootballTeams = async (): Promise<FootballTeam[]> =>
  (await resolveCrests(await r.listFeatured())).map(standardizeCrest);
export const getFootballTeamBySlug = async (
  slug: string
): Promise<FootballTeam | null> => {
  const team = await r.getBySlug(slug);
  if (!team) return null;
  return standardizeCrest((await resolveCrests([team]))[0]);
};
export const getFootballTeamSlugs = r.listSlugs;

/**
 * name_english → image index for the event-photo fallback — routed through the
 * SAME library-first resolution + crest standard, so an order-page or catalog
 * event card wears the exact crest art its team page does.
 */
export const getFootballTeamImageIndex = async (): Promise<PersonImageEntry[]> => {
  const [entries, lib] = await Promise.all([r.listImageIndex(), fetchLogoLibrary()]);
  return entries.map((e) => {
    const url = libraryUrlFor(e.name, undefined, lib) ?? e.art?.imageUrl ?? null;
    if (!url || !isTightCrest(url)) return e;
    return {
      ...e,
      art: {
        imageUrl: url,
        colorIndex: e.art?.colorIndex ?? null,
        shapeIndex: FOOTBALL_CREST_ART.shapeIndex,
        imageScale: FOOTBALL_CREST_ART.imageScale,
        bgScale: null,
        offsetX: FOOTBALL_CREST_ART.imageOffsetX,
        offsetY: FOOTBALL_CREST_ART.imageOffsetY,
      },
    };
  });
};
