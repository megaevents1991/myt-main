import type { Metadata } from "next";
import { CmsCatalog } from "@/components/CmsCatalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "האומנים שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/artists",
  },
};

export default async function ArtistsPage() {
  return <CmsCatalog kind="artists" title="האומנים שלנו" />;
}
