import type { Metadata } from "next";
import { CatalogPageTemplate, type CatalogItem } from "@/components/CatalogPageTemplate";
import { getAllArtists } from "@/lib/artists";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "האומנים שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/artists",
  },
};

export default async function ArtistsPage() {
  try {
    const items = await getAllArtists();

    const artists: CatalogItem[] = items.map((artist) => ({
      id: artist.sys.id,
      name: String(artist.fields.name ?? ""),
      previewText: artist.fields.previewText
        ? String(artist.fields.previewText)
        : undefined,
      imageUrl: artist.fields.heroBanner?.fields?.file?.url
        ? "https:" + artist.fields.heroBanner.fields.file.url
        : undefined,
    }));

    return (
      <CatalogPageTemplate
        title="האומנים שלנו"
        hrefBase="/artists"
        items={artists}
        gridLabel="רשימת האומנים"
        cardLabelPrefix="עמוד האומן"
        imageAltPrefix="תמונה של האומן"
      />
    );
  } catch (error) {
    console.error("Error fetching artists:", error);
    return (
      <CatalogPageTemplate
        title="האומנים שלנו"
        hrefBase="/artists"
        items={[]}
        gridLabel="רשימת האומנים"
        cardLabelPrefix="עמוד האומן"
        imageAltPrefix="תמונה של האומן"
        error
      />
    );
  }
}
