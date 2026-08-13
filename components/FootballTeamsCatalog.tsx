import { CatalogPageTemplate, type CatalogItem } from "@/components/CatalogPageTemplate";
import { getAllFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";

/**
 * The full football-teams catalog (CMS `football_teams` cards with blob art),
 * shared by /football and the taxonomy hub /c/football/teams so both show the
 * exact same "הקבוצות שלנו" experience.
 */
export async function FootballTeamsCatalog({ title }: { title: string }) {
  try {
    const items = await getAllFootballTeams();
    const isAvailable = await getAvailabilityChecker();

    const teams: CatalogItem[] = items.map((team) => ({
      id: team.sys.id,
      name: String(team.fields.name ?? ""),
      previewText: team.fields.previewText
        ? String(team.fields.previewText)
        : undefined,
      imageUrl: team.fields.heroBanner?.fields?.file?.url
        ? "https:" + team.fields.heroBanner.fields.file.url
        : undefined,
      artImageUrl: team.fields.artImageUrl,
      artColorIndex: team.fields.artColorIndex,
      artShapeIndex: team.fields.artShapeIndex,
      artImageScale: team.fields.artImageScale,
      artBgScale: team.fields.artBgScale,
      artImageOffsetX: team.fields.artImageOffsetX,
      artImageOffsetY: team.fields.artImageOffsetY,
      available: isAvailable(String(team.fields.nameDBenglish ?? "")),
    }));

    return (
      <CatalogPageTemplate
        title={title}
        hrefBase="/football"
        items={teams}
        gridLabel="רשימת קבוצות הכדורגל"
        cardLabelPrefix="עמוד קבוצת כדורגל"
        imageAltPrefix="לוגו של קבוצת"
      />
    );
  } catch (error) {
    console.error("Error fetching football teams:", error);
    return (
      <CatalogPageTemplate
        title={title}
        hrefBase="/football"
        items={[]}
        gridLabel="רשימת קבוצות הכדורגל"
        cardLabelPrefix="עמוד קבוצת כדורגל"
        imageAltPrefix="לוגו של קבוצת"
        error
      />
    );
  }
}
