import type { Artist, FootballTeam } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { getAllFootballTeams } from "@/lib/football";
import { getAllArtists } from "@/lib/artists";
import { clubNamesMatchAnyScript } from "@/lib/eventNameMatch";

/**
 * People-collage builder for picker tiles (יעדים grid, the genre tiles on
 * /c/music). For each child category it matches the CMS people (artists,
 * and teams for destinations) that actually appear in that child's events,
 * spreads the roster so neighbouring tiles don't open with the same faces,
 * and returns the picks + the child's event count.
 *
 * Extracted from PickerHubPage so the music page's genre tiles and the
 * destinations grid share one matching pipeline.
 */
export type CollagePick = { url: string; crest: boolean };

export async function buildPickerCollage(
  children: EventCategory[],
  kind: "destinations" | "genres",
  /** Picks per tile: 3 = static cluster (genres), more = rotation pool. */
  cap = 3,
): Promise<{
  collage: Record<number, CollagePick[]>;
  eventCounts: Record<number, number>;
}> {
  const collage: Record<number, CollagePick[]> = {};
  const eventCounts: Record<number, number> = {};

  const [teams, artists] = await Promise.all([
    kind === "destinations"
      ? getAllFootballTeams().catch(() => [] as FootballTeam[])
      : Promise.resolve([] as FootballTeam[]),
    getAllArtists().catch(() => [] as Artist[]),
  ]);
  const people: { url: string; crest: boolean; en: string; he: string }[] = [
    ...artists.map((p) => ({ crest: false, p })),
    ...teams.map((p) => ({ crest: true, p })),
  ]
    .filter(({ p }) => p.fields.artImageUrl)
    .map(({ p, crest }) => ({
      url: String(p.fields.artImageUrl),
      crest,
      en: String(p.fields.nameDBenglish ?? ""),
      he: String(p.fields.name ?? ""),
    }));

  // Fetch + match in parallel; pick sequentially so a shared "used" set can
  // spread the roster - without it every tile opened with the same trio.
  const matchedByChild = await Promise.all(
    children.map(async (child) => {
      const { events: childEvents } = await getEventsInCategory(child.slug);
      const tagsBy = await getTagsForEvents(childEvents.slice(0, 40).map((e) => e.id));
      const names = new Set<string>();
      Object.values(tagsBy).forEach((chips) =>
        chips.forEach((c) => {
          if (c.type === "artist" || (kind === "destinations" && c.type === "team"))
            names.add(c.name);
        }),
      );
      const matched = people.filter(({ en, he }) =>
        [...names].some(
          (t) => clubNamesMatchAnyScript(t, en) || clubNamesMatchAnyScript(t, he),
        ),
      );
      return { id: child.id, matched, count: childEvents.length };
    }),
  );
  const used = new Set<string>();
  for (const { id, matched, count } of matchedByChild) {
    eventCounts[id] = count;
    if (!matched.length) {
      collage[id] = [];
      continue;
    }
    // Rotate the start per tile + prefer people no tile has shown yet.
    const off = id % matched.length;
    const rotated = [...matched.slice(off), ...matched.slice(0, off)];
    const picks = [
      ...rotated.filter((m) => !used.has(m.url)),
      ...rotated.filter((m) => used.has(m.url)),
    ].slice(0, cap);
    // Only the leading trio counts as "used" - deeper rotation-pool picks
    // (destinations) shouldn't starve the next tile's opening faces.
    picks.slice(0, 3).forEach((m) => used.add(m.url));
    collage[id] = picks.map(({ url, crest }) => ({ url, crest }));
  }
  return { collage, eventCounts };
}
