import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import type { Metadata } from "next";
import { CatalogPageTemplate, type CatalogItem } from "@/components/CatalogPageTemplate";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "הקבוצות שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/football",
  },
};

export default async function FootballsPage() {
  try {
    const { items } = await contentfulClient.getEntries<FootballFields>({
      content_type: "footballTeamTemplate",
    });

    const teams: CatalogItem[] = items.map((team) => ({
      id: team.sys.id,
      name: String(team.fields.name ?? ""),
      previewText: team.fields.previewText
        ? String(team.fields.previewText)
        : undefined,
      imageUrl: team.fields.heroBanner?.fields?.file?.url
        ? "https:" + team.fields.heroBanner.fields.file.url
        : undefined,
    }));

    return (
      <CatalogPageTemplate
        title="הקבוצות שלנו"
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
        title="הקבוצות שלנו"
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
