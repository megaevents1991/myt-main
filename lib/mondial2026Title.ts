export const MONDIAL_2026_MAIN_TITLE = "מונדיאל 2026";

export type Mondial2026ParsedTitle = {
  isMondial2026: boolean;
  mainTitle?: string;
  teamsTitle?: string;
  matchNumber?: number;
};

export function parseMondial2026EventName(name?: string): Mondial2026ParsedTitle {
  if (!name) return { isMondial2026: false };

  const match = name.match(/^מונדיאל 2026 משחק\s+(\d+)\s*:\s*(.+)$/);
  if (!match) return { isMondial2026: false };

  return {
    isMondial2026: true,
    mainTitle: MONDIAL_2026_MAIN_TITLE,
    teamsTitle: match[2].trim(),
    matchNumber: Number(match[1]),
  };
}

export function getMondial2026MatchPrefix(name?: string): string | undefined {
  const parsed = parseMondial2026EventName(name);
  if (!parsed.isMondial2026 || !parsed.matchNumber) return undefined;
  return `${MONDIAL_2026_MAIN_TITLE} משחק ${parsed.matchNumber}`;
}
