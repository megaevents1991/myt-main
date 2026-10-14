import type { Artist, Event, FootballTeam } from "@/lib/app.types";
import { isEventSoldOut } from "@/lib/events/price";
import { normalizeName } from "@/lib/eventNameMatch";

/**
 * Which artist / home team page an event belongs to, and the homepage's "one
 * card per page" collapse. Moved out of ClientSideHomepage (2026-10-14) so the
 * rows can be built on the server (lib/homepage/rows.ts); EventCard still uses
 * the matchers. Name comparison uses the shared normalizeName (lib/eventNameMatch)
 * - case/accent/punctuation-insensitive, same rule as getEventsByName - so the
 * homepage collapses exactly the events the artist/team detail page lists.
 */

// Escape a string for safe use inside a RegExp.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word match of `id` inside the already-normalized `haystack`. Returns the
// RegExp match (with `.index`) or null. Prevents "Milan" matching "Milano".
export const wholeWordMatch = (haystack: string, id: string) =>
  id ? haystack.match(new RegExp(`(^|[^a-z0-9])${escapeRegExp(id)}([^a-z0-9]|$)`, "i")) : null;

// Which artist page an event belongs to. The artist detail page lists events by
// normalized SUBSTRING (`eventsData.getEventsByName` over `name_english`), so the
// homepage must use the same rule or an event like "Bon Jovi London" won't be
// collapsed into the "Bon Jovi" card and won't get the "see all events" strip.
// Whole-word containment (not raw substring) keeps a short name from matching
// inside a longer word (e.g. "Sting" in "Stinger"). Pass artist ids sorted
// longest-first so the most specific artist wins. Returns the matched id or null.
export const artistIdForEvent = (
  nameEnglish: string | null | undefined,
  name: string | null | undefined,
  artistIdsLongestFirst: string[]
): string | null => {
  const hay = normalizeName(nameEnglish) || normalizeName(name);
  if (!hay) return null;
  return artistIdsLongestFirst.find((id) => wholeWordMatch(hay, id)) ?? null;
};

// Identify the HOME team of a fixture. Football collide is home-only: "Arsenal"
// collects a match only when Arsenal hosts it ("Arsenal FC vs X"), never its away
// games ("X vs Arsenal"). The home team is the side named to the LEFT of the
// "vs"/"-" separator. The LONGEST team-name match within that side wins, so
// "Inter Milan vs Napoli" resolves to "Inter Milan" and never to "Milan" (whose
// name is contained in Inter's). Rightmost position only breaks length ties,
// keeping competition prefixes like "Champions League: Arsenal vs ..." resolving
// to Arsenal even if the prefix happens to contain a team name.
export const findEventHomeTeam = (event: Event, teams?: FootballTeam[]): FootballTeam | null => {
  if (!teams || teams.length === 0) return null;
  const full = normalizeName(event.name_english) || normalizeName(event.name);
  if (!full) return null;
  const sep = full.match(/\s(?:vs\.?|v\.?|[-–-])\s/i);
  const homeSide = sep && sep.index !== undefined ? full.slice(0, sep.index) : full;
  let best: FootballTeam | null = null;
  let bestLen = -1;
  let bestIndex = -1;
  for (const team of teams) {
    const id = normalizeName(team.fields.nameDBenglish);
    const match = wholeWordMatch(homeSide, id);
    if (match?.index === undefined) continue;
    if (id.length > bestLen || (id.length === bestLen && match.index > bestIndex)) {
      bestLen = id.length;
      bestIndex = match.index;
      best = team;
    }
  }
  return best;
};

/**
 * Collapse events that have a dedicated page (artist OR football team) down to
 * a single representative card, so the homepage shows one card + "see all"
 * strip per artist/team. Football collapses by HOME team - home games only.
 * Sold-out events are dropped entirely. Output order: events with no page in
 * their incoming order, then one per artist, then one per team (callers sort).
 */
export function collapseByPage(
  events: Event[],
  artists: Artist[] | undefined,
  teams: FootballTeam[] | undefined
): Event[] {
  const hasArtistPages = !!artists && artists.length > 0;
  const teamsForGrouping = teams && teams.length > 0 ? teams : [];
  if (!hasArtistPages && teamsForGrouping.length === 0) return events;

  // Artist identifiers that have pages, longest-first so the most specific
  // artist wins a whole-word match (see artistIdForEvent).
  const artistIdsWithPages = Array.from(
    new Set(
      (artists ?? [])
        .map((artist) => normalizeName(artist.fields.nameDBenglish))
        .filter(Boolean)
    )
  ).sort((a, b) => b.length - a.length);

  // Best representative for a collapsed group (prefer a real tag, then earliest date)
  const pickRepresentative = (groupEvents: Event[]) =>
    [...groupEvents].sort((a, b) => {
      const aHasTag = a.tags && a.tags !== "Sold";
      const bHasTag = b.tags && b.tags !== "Sold";
      if (aHasTag && !bHasTag) return -1;
      if (!aHasTag && bHasTag) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    })[0];

  // 1) Group by artist (whole-word name match - same rule as the artist page,
  //    so "Bon Jovi London" collapses into the "Bon Jovi" card).
  const eventsByArtist = new Map<string, Event[]>();
  const afterArtistGrouping: Event[] = [];

  events.forEach((event) => {
    if (isEventSoldOut(event)) return; // Skip sold-out events entirely

    const matchedId = artistIdForEvent(event.name_english, event.name, artistIdsWithPages);
    if (matchedId) {
      if (!eventsByArtist.has(matchedId)) eventsByArtist.set(matchedId, []);
      eventsByArtist.get(matchedId)!.push(event);
    } else {
      afterArtistGrouping.push(event);
    }
  });

  // 2) Group the rest by football HOME team (away games are left as-is)
  const eventsByTeam = new Map<string, Event[]>();
  const nonGroupedEvents: Event[] = [];

  afterArtistGrouping.forEach((event) => {
    const team = findEventHomeTeam(event, teamsForGrouping);
    if (team) {
      const key = team.sys.id;
      if (!eventsByTeam.has(key)) eventsByTeam.set(key, []);
      eventsByTeam.get(key)!.push(event);
    } else {
      nonGroupedEvents.push(event);
    }
  });

  const collapsedArtistEvents = [...eventsByArtist.values()].map(pickRepresentative);
  const collapsedTeamEvents = [...eventsByTeam.values()].map(pickRepresentative);

  return [...nonGroupedEvents, ...collapsedArtistEvents, ...collapsedTeamEvents];
}
