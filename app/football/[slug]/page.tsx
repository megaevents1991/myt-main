import { getFootballTeamBySlug, getFootballTeamSlugs } from "@/lib/football";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamCmsPage } from "@/components/TeamCmsPage";

export const revalidate = 3600;
export const dynamicParams = true; // Allow rendering pages for new teams on-demand

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const team = await getFootballTeamBySlug(slug);
    if (!team?.fields?.name) {
      return { title: "Team Not Found - MYT" };
    }

    const { name, previewText, seoTitle, metaDescription, metaTags } = team.fields;
    const title = String(seoTitle || "") || `${name} - כרטיסים וחבילות | MYT`;
    const description = String(metaDescription || previewText || "") || `הזמינו כרטיסים וחבילות טיסה + מלון למשחקים של ${name}`;
    const keywords = metaTags || `${name}, כרטיסים, כדורגל, MYT`;

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical: `https://www.mega-events.co.il/football/${slug}`,
      },
      // og:image intentionally NOT set here - the branded card from
      // opengraph-image.tsx is the preview (explicit images would override it).
      openGraph: {
        title,
        description,
      },
    };
  } catch {
    return { title: "Team Not Found - MYT" };
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await getFootballTeamSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error('Error generating static params for football teams:', error);
    return [];
  }
}

export default async function FootballPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const team = await getFootballTeamBySlug(slug);

    if (!team || !team.fields) {
      notFound();
    }

    const { name, nameDBenglish } = team.fields;
    if (!name || !nameDBenglish) {
      console.error('Football team missing required fields:', { slug, name, nameDBenglish });
      notFound();
    }

    // Body shared with the taxonomy leaf /c/football/teams/<slug>.
    return <TeamCmsPage team={team} />;
  } catch (error) {
    console.error('Error fetching football team:', error);
    notFound();
  }
}
