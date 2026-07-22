import { makePeopleReaders } from "@/lib/cms/people";
import { supabase } from "@/lib/supabase";
import { isTightCrest, FOOTBALL_CREST_ART } from "@/lib/eventArt";
import type { FootballTeam } from "@/lib/app.types";

const r = makePeopleReaders({ table: "football_teams" });

/**
 * Football card-art resolution order (per product spec, 2026-07-22):
 * 1. Image uploaded on the team template → use it. A padded art_blobs cutout
 *    keeps its legacy custom look; a LOGO (tight crest) is normalized to the
 *    single cross-site standard below.
 * 2. No template image at all → resolve a crest from the football_logos
 *    library by name, rendered with the same standard.
 * 3. Event pages keep their own image when they have one — team art is only
 *    the fallback (existing behavior in lib/events).
 *
 * Standardization: EVERY crest gets FOOTBALL_CREST_ART (stadium background +
 * one size). Per-team dials are ignored for crests on purpose — uniformity is
 * the requirement, and per-team knobs caused three production bugs.
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
          artBgScale: FOOTBALL_CREST_ART.bgScale,
        },
      }
    : t;

const hasAnyImage = (t: FootballTeam): boolean =>
  Boolean(t.fields.artImageUrl || t.fields.heroBanner?.fields?.file?.url);

type LogoRow = { name_english: string; name_hebrew: string | null; logo_url: string };

/** Library lookup maps — lowercased english name + exact hebrew name. */
async function fetchLogoLibrary(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("football_logos")
    .select("name_english,name_hebrew,logo_url");
  if (error) {
    console.error("football_logos read failed:", JSON.stringify(error));
    return new Map();
  }
  const map = new Map<string, string>();
  for (const row of (data ?? []) as LogoRow[]) {
    map.set(row.name_english.trim().toLowerCase(), row.logo_url);
    if (row.name_hebrew) map.set(row.name_hebrew.trim(), row.logo_url);
  }
  return map;
}

const libraryUrlFor = (t: FootballTeam, lib: Map<string, string>): string | null =>
  lib.get((t.fields.nameDBenglish ?? "").trim().toLowerCase()) ??
  lib.get((t.fields.name ?? "").trim()) ??
  null;

/** Fill teams that have NO image of their own from the logo library. */
async function fillFromLibrary(teams: FootballTeam[]): Promise<FootballTeam[]> {
  if (teams.every(hasAnyImage)) return teams;
  const lib = await fetchLogoLibrary();
  if (!lib.size) return teams;
  return teams.map((t) => {
    if (hasAnyImage(t)) return t;
    const url = libraryUrlFor(t, lib);
    return url ? { ...t, fields: { ...t.fields, artImageUrl: url } } : t;
  });
}

// Artist and FootballTeam are structurally identical, so the people readers'
// Artist-shaped results are valid FootballTeam values.
export const getAllFootballTeams = async (): Promise<FootballTeam[]> =>
  (await fillFromLibrary(await r.listAll())).map(standardizeCrest);
export const getFeaturedFootballTeams = async (): Promise<FootballTeam[]> =>
  (await fillFromLibrary(await r.listFeatured())).map(standardizeCrest);
export const getFootballTeamBySlug = async (
  slug: string
): Promise<FootballTeam | null> => {
  const team = await r.getBySlug(slug);
  if (!team) return null;
  return standardizeCrest((await fillFromLibrary([team]))[0]);
};
export const getFootballTeamSlugs = r.listSlugs;
/** name_english → image_url index for the event-photo fallback. */
export const getFootballTeamImageIndex = r.listImageIndex;
