// Fixture-aware team ↔ event matching.
//
// `getEventsByName` finds events with a broad `name_english ILIKE %team%`
// substring match. That over-matches when one club's name is a substring of
// another's: team "Milan" (AC Milan) wrongly pulls in every "Inter Milan" /
// "Inter Milano" fixture. This refinement keeps a football fixture ("X vs Y")
// only when the searched team actually plays in it, while leaving non-fixture
// events (artists/concerts, which have no " vs ") untouched.

// League/corporate qualifier tokens that don't identify a club on their own
// (so "AC Milan" ≡ "Milan", "AS Roma" ≡ "Roma", "FC Barcelona" ≡ "Barcelona").
// "Inter" is a real club identifier, not a qualifier - so it is NOT listed here.
const GENERIC_TOKENS = new Set([
  "fc",
  "afc",
  "cf",
  "cfc",
  "sc",
  "ac",
  "as",
  "ss",
  "ssc",
  "us",
  "ud",
  "ca",
  "rc",
  "rcd",
  "sl",
  "bc",
  "de",
  "del",
  "calcio",
  "club",
  "balompie",
]);

/**
 * Case-, accent- and whitespace-insensitive canonical form of a person/event
 * name, for substring matching. Backoffice-entered names drift on exactly
 * these axes ("André Rieu " vs "Andre Rieu"), so EVERY name↔event substring
 * comparison in the app must go through this - raw `.toLowerCase().includes`
 * silently drops accented artists.
 *
 * Quotes/apostrophes/commas/periods are dropped too ("Guns N' Roses" ≡
 * "Guns N Roses"). Hyphens are kept: the homepage splits fixture names on
 * " - " AFTER normalizing, so eating hyphens would merge the two sides.
 */
export function normalizeName(s?: string | null): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents ("André" → "andre")
    .replace(/['‘’`´"“”,.׳״]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents ("Atlético" → "atletico")
    .replace(/[^a-z0-9]/g, "");
}

/** Club's identifying tokens: lowercased, accent-free, minus qualifiers/years. */
function significantTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t && !GENERIC_TOKENS.has(t) && !/^\d{4}$/.test(t));
}

function tokensEqual(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((t, i) => t === b[i]);
}

/** `sup` strictly contains every token of `sub` (e.g. ["inter","milan"] ⊃ ["milan"]). */
function tokensStrictSuperset(sup: string[], sub: string[]): boolean {
  return (
    sub.length > 0 &&
    sup.length > sub.length &&
    sub.every((t) => sup.includes(t))
  );
}

/** One fixture side (e.g. "AC Milan") denotes exactly the given team. */
function sideIsTeam(side: string, team: string): boolean {
  return tokensEqual(significantTokens(side), significantTokens(team));
}

/**
 * Same-club check for crest-library lookups: identifying tokens equal, so
 * qualifier drift between the teams table and the football_logos library
 * ("AFC Ajax" ≡ "Ajax", "Tottenham Hotspur FC" ≡ "Tottenham Hotspur",
 * "Barcelona" ≡ "FC Barcelona") still resolves. Hebrew names have no latin
 * tokens and never match here - compare those exactly instead.
 */
export function clubNamesMatch(a: string, b: string): boolean {
  return tokensEqual(significantTokens(a), significantTokens(b));
}

/**
 * Same-club check that ALSO works on Hebrew names.
 *
 * `clubNamesMatch` compares LATIN identifying tokens, so a Hebrew name reduces
 * to zero tokens and never matches - which silently dropped the tag "FC
 * ברצלונה" against the CMS card "ברצלונה", leaving Barcelona out of the
 * לה ליגה teams carousel. Here the club qualifiers are stripped whatever the
 * script and the remainder is compared canonically, so "FC ברצלונה" ≡
 * "ברצלונה" and "Tottenham Hotspur FC" ≡ "Tottenham Hotspur" both resolve.
 */
export function clubNamesMatchAnyScript(a: string, b: string): boolean {
  const strip = (s: string) =>
    normalizeName(s)
      .split(/\s+/)
      .filter((t) => t && !GENERIC_TOKENS.has(t) && !/^\d{4}$/.test(t))
      .join(" ");
  const [x, y] = [strip(a), strip(b)];
  return !!x && x === y;
}

const VS_SPLIT = /\s+vs\.?\s+/i;
const DASH_SPLIT = /\s+[-–—]\s+/;
// TixStock names fixtures "Home vs Away - Competition [season]" ("As Roma Vs
// Real Madrid Cf - Champions League 2026-2027"). Everything after the first
// " - " in the AWAY side is the competition, never part of the club name.
const COMPETITION_TAIL = /\s+[-–—]\s+.*$/;

/** Split "X vs Y" (after any "Competition:" prefix) into sides, else null.
 *  A trailing " - Competition" on the last side is dropped (TixStock format). */
function fixtureSides(eventName: string): string[] | null {
  const noPrefix = eventName.replace(/^[^:]+:\s*/, "");
  const parts = noPrefix.split(VS_SPLIT);
  if (parts.length < 2) return null;
  parts[parts.length - 1] = parts[parts.length - 1].replace(COMPETITION_TAIL, "");
  return parts;
}

/**
 * The two clubs of a fixture name, in either naming convention the DB holds:
 * - TixStock / English: "Home vs Away - Competition [season]" (competition tail dropped)
 * - Backoffice / Hebrew: "Competition: Home - Away" (en/em dashes too)
 * A leading "Competition:" prefix is always dropped. null for anything that
 * isn't exactly two sides (artists, "A - B - C"). The ONE fixture splitter for
 * crest lookups - the match "logo VS logo" art and the feed creative both
 * depend on it agreeing with itself.
 */
export function fixturePair(source?: string | null): [string, string] | null {
  const noPrefix = (source ?? "").replace(/^[^:]+:\s*/, "").trim();
  if (!noPrefix) return null;
  const parts = (
    VS_SPLIT.test(noPrefix)
      ? noPrefix.split(VS_SPLIT).map((p, i, all) =>
          i === all.length - 1 ? p.replace(COMPETITION_TAIL, "") : p,
        )
      : noPrefix.split(DASH_SPLIT)
  )
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

/**
 * Whether an event legitimately belongs to a team's page.
 * - Competition hub pages (team name == the "Champions League:" prefix) keep all their events.
 * - Football fixtures are kept when the team is one of the two sides - EXCEPT
 *   an away game hosted by a club whose name strictly contains the team's
 *   ("Inter Milan vs AC Milan" is Inter's home derby, not a Milan-page event).
 *   Regular away games (Arsenal at Tottenham) still count.
 * - Non-fixture events (no " vs ") are trusted as-is (the substring match stands).
 */
export function eventBelongsToTeam(
  eventName: string,
  teamName: string,
): boolean {
  if (!eventName || !teamName) return true;

  // Hub pages like "Champions League" - the team name is the competition prefix.
  const prefixMatch = eventName.match(/^([^:]+):\s*/);
  if (
    prefixMatch &&
    tokensEqual(significantTokens(prefixMatch[1]), significantTokens(teamName))
  ) {
    return true;
  }

  const sides = fixtureSides(eventName);
  if (!sides) return true; // artists/concerts - not a fixture, leave untouched

  const [home, ...rest] = sides;
  if (sideIsTeam(home, teamName)) return true; // team hosts → always its event

  // Away side: belongs unless the HOME club's name strictly contains the
  // team's name - then the fixture is the home club's (derby disambiguation).
  const teamTokens = significantTokens(teamName);
  const homeTokens = significantTokens(home);
  if (tokensStrictSuperset(homeTokens, teamTokens)) return false;
  return rest.some((side) => sideIsTeam(side, teamName));
}

/**
 * The team's role in a fixture: "home" when it's the first side, "away" when
 * it's any other side (INCLUDING derbies hosted by a containing-name club -
 * "Inter Milan vs AC Milan" is a Milan AWAY game here). null for non-fixtures
 * (artists) and fixtures the team doesn't play in (incl. competition-hub
 * matches like the "Champions League" page, where sides never equal the team).
 */
export function teamFixtureRole(
  eventName: string,
  teamName: string,
): "home" | "away" | null {
  if (!eventName || !teamName) return null;
  const sides = fixtureSides(eventName);
  if (!sides) return null;
  const [home, ...rest] = sides;
  if (sideIsTeam(home, teamName)) return "home";
  if (rest.some((side) => sideIsTeam(side, teamName))) return "away";
  return null;
}

/**
 * Looser page-level gate than eventBelongsToTeam: keeps EVERY fixture the team
 * plays in - home AND away, derbies included - plus hub-prefix events and
 * non-fixtures. Used by the team page (which splits home/away visually) and
 * the catalog's on-tour check, so "has events on its page" ⇔ "on tour".
 * eventBelongsToTeam stays stricter for the event-art fallback (an away derby
 * must not wear the visiting team's imagery).
 */
export function eventRelatesToTeam(
  eventName: string,
  teamName: string,
): boolean {
  if (!eventName || !teamName) return true;
  const prefixMatch = eventName.match(/^([^:]+):\s*/);
  if (
    prefixMatch &&
    tokensEqual(significantTokens(prefixMatch[1]), significantTokens(teamName))
  ) {
    return true;
  }
  const sides = fixtureSides(eventName);
  if (!sides) return true; // artists/concerts - substring match stands
  return sides.some((side) => sideIsTeam(side, teamName));
}

/**
 * THE rule for "does this event belong on the artist/team page named
 * `searchName`" - shared by getEventsByName and the catalog's on-tour check.
 *
 * Normally a normalized substring match refined by eventRelatesToTeam. But a
 * club's template name and its event names drift on qualifiers the substring
 * can't see past: team "Atletico Madrid" vs event "Atlético de Madrid", team
 * "Paris Saint-Germain FC" vs event "... vs Paris Saint-Germain". Those
 * fixtures still count when one side IS the team once qualifiers are stripped
 * (2026-09-16: Atletico's page showed zero of its 5 games).
 */
export function eventMatchesName(
  eventName: string | null | undefined,
  searchName: string,
): boolean {
  const needle = normalizeName(searchName);
  if (!needle || !eventName) return false;
  if (normalizeName(eventName).includes(needle)) {
    return eventRelatesToTeam(eventName, searchName);
  }
  const sides = fixtureSides(eventName);
  return !!sides && sides.some((side) => sideIsTeam(side, searchName));
}
