import type { Metadata } from "next";
import { FootballTeamsCatalog } from "@/components/FootballTeamsCatalog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "הקבוצות שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/football",
  },
};

export default async function FootballsPage() {
  return <FootballTeamsCatalog title="הקבוצות שלנו" />;
}
