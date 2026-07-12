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
// "Inter" is a real club identifier, not a qualifier — so it is NOT listed here.
const GENERIC_TOKENS = new Set([
  "fc", "afc", "cf", "cfc", "sc", "ac", "as", "ss", "ssc", "us", "ud",
  "ca", "rc", "rcd", "sl", "bc", "de", "del", "calcio", "club", "balompie",
]);

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

/** One fixture side (e.g. "AC Milan") denotes exactly the given team. */
function sideIsTeam(side: string, team: string): boolean {
  return tokensEqual(significantTokens(side), significantTokens(team));
}

/** Split "X vs Y" (after any "Competition:" prefix) into sides, else null. */
function fixtureSides(eventName: string): string[] | null {
  const noPrefix = eventName.replace(/^[^:]+:\s*/, "");
  const parts = noPrefix.split(/\s+vs\.?\s+/i);
  return parts.length >= 2 ? parts : null;
}

/**
 * Whether an event legitimately belongs to a team's page.
 * - Competition hub pages (team name == the "Champions League:" prefix) keep all their events.
 * - Football fixtures are kept only when the team is one of the two sides.
 * - Non-fixture events (no " vs ") are trusted as-is (the substring match stands).
 */
export function eventBelongsToTeam(eventName: string, teamName: string): boolean {
  if (!eventName || !teamName) return true;

  // Hub pages like "Champions League" — the team name is the competition prefix.
  const prefixMatch = eventName.match(/^([^:]+):\s*/);
  if (
    prefixMatch &&
    tokensEqual(significantTokens(prefixMatch[1]), significantTokens(teamName))
  ) {
    return true;
  }

  const sides = fixtureSides(eventName);
  if (!sides) return true; // artists/concerts — not a fixture, leave untouched
  return sides.some((side) => sideIsTeam(side, teamName));
}
