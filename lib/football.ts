import { makePeopleReaders } from "@/lib/cms/people";
import type { FootballTeam } from "@/lib/app.types";

const r = makePeopleReaders({
  table: "football_teams",
  contentType: "footballTeamTemplate",
  carouselId: "2VjS97BWIScDQXwjx9Q4nP",
});

// Artist and FootballTeam are structurally identical, so the people readers'
// Artist-shaped results are valid FootballTeam values.
export const getAllFootballTeams = (): Promise<FootballTeam[]> => r.listAll();
export const getFeaturedFootballTeams = (): Promise<FootballTeam[]> => r.listFeatured();
export const getFootballTeamBySlug = (slug: string): Promise<FootballTeam | null> =>
  r.getBySlug(slug);
export const getFootballTeamSlugs = r.listSlugs;
/** name_english → image_url index for the event-photo fallback. */
export const getFootballTeamImageIndex = r.listImageIndex;
