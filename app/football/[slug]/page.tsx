import { getFootballTeamBySlug, getFootballTeamSlugs } from "@/lib/football";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";
import { getEventsByName } from "@/lib/eventsData";
import { documentToPlainText, firstSentence } from "@/lib/richText";
import ClientTracker from "@/components/ClientTracker";
import { HeaderTitle } from "@/components/HeaderTitle";
import { DetailHero } from "@/components/DetailHero";
import { ArtistEventsFilter } from "@/components/ArtistEventsFilter";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrustSection } from "@/components/TrustSection";
import { FAQ } from "@/components/ui/FAQ";
import { ArtistBanners } from "@/components/ArtistBanners";
import { ExperienceCarousel } from "@/components/ExperienceCarousel";
import { ArtistVideos } from "@/components/ArtistVideos";

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
      // og:image intentionally NOT set here — the branded card from
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

const Bold = ({ children }: { children: ReactNode }) => (
  <strong className="font-bold">{children}</strong>
);

const bioOptions: Options = {
  renderMark: {
    [MARKS.BOLD]: (text: ReactNode): ReactNode => <Bold>{text}</Bold>,
  },
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: unknown, children: ReactNode): ReactNode => (
      <p className="mb-3 last:mb-0">{children}</p>
    ),
  },
};

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

    const { name, nameDBenglish, bio, heroBanner, heroVideoUrl, banners, gallery, videos } = team.fields;

    if (!name || !nameDBenglish) {
      console.error('Football team missing required fields:', { slug, name, nameDBenglish });
      notFound();
    }

    const { events } = await getEventsByName(String(nameDBenglish));
    const imageUrl = heroBanner?.fields?.file?.url
      ? "https:" + heroBanner.fields.file.url
      : undefined;

    // Mobile bio collapses to its first sentence with a "קרא עוד.." toggle.
    const bioPlain = documentToPlainText(bio as Document);
    const bioFirstSentence = firstSentence(bioPlain);
    const bioCanExpand = bioFirstSentence.length < bioPlain.length;

    return (
      <>
        <ClientTracker />
        <HeaderTitle name={String(name)} />
        <DetailHero
          name={String(name)}
          bio={documentToReactComponents(bio as Document, bioOptions)}
          bioFirstSentence={bioFirstSentence}
          bioCanExpand={bioCanExpand}
          imageUrl={imageUrl}
          imageAlt={`לוגו של קבוצת ${String(name)}`}
          heroVideoUrl={heroVideoUrl}
          artId={team.sys.id}
          artImageUrl={team.fields.artImageUrl}
          artColorIndex={team.fields.artColorIndex}
          artShapeIndex={team.fields.artShapeIndex}
        />

        <ArtistBanners banners={banners} />

        <section
          id="upcoming-events"
          className="container mx-auto scroll-mt-20 px-4 py-12"
          aria-labelledby="upcoming-matches-heading"
        >
          <h2
            id="upcoming-matches-heading"
            className="mb-2 font-display text-2xl font-extrabold text-foreground"
          >
            אירועים קרובים
          </h2>
          <p className="mb-6 text-muted-foreground">
            בחרו תאריך משחק והתחילו להרכיב את החבילה שלכם
          </p>
          {events.length > 0 ? (
            <ArtistEventsFilter events={events} title={String(name)} showName />
          ) : (
            <EmptyState title="אין אירועים קרובים" />
          )}
        </section>

        <ArtistVideos videos={videos} />
        <ExperienceCarousel images={gallery} />
        <TrustSection />
        <FAQ />
      </>
    );
  } catch (error) {
    console.error('Error fetching football team:', error);
    notFound();
  }
}
