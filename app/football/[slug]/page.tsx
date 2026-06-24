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
import ClientTracker from "@/components/ClientTracker";
import { DetailHero } from "@/components/DetailHero";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrustSection } from "@/components/TrustSection";
import { FAQ } from "@/components/ui/FAQ";
import { ArtistBanners } from "@/components/ArtistBanners";
import { ArtistGallery } from "@/components/ArtistGallery";
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

    const { name, previewText, seoTitle, metaDescription, metaTags, heroBanner } = team.fields;
    const title = String(seoTitle || "") || `${name} - כרטיסים וחבילות | MYT`;
    const description = String(metaDescription || previewText || "") || `הזמינו כרטיסים וחבילות טיסה + מלון למשחקים של ${name}`;
    const keywords = metaTags || `${name}, כרטיסים, כדורגל, MYT`;
    const imageUrl = heroBanner?.fields?.file?.url
      ? `https:${heroBanner.fields.file.url}`
      : undefined;

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical: `https://www.mega-events.co.il/football/${slug}`,
      },
      openGraph: {
        title,
        description,
        ...(imageUrl && {
          images: [{ url: imageUrl, width: 800, height: 600, alt: String(name) }],
        }),
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

    return (
      <>
        <ClientTracker />
        <DetailHero
          name={String(name)}
          bio={documentToReactComponents(bio as Document, bioOptions)}
          imageUrl={imageUrl}
          imageAlt={`לוגו של קבוצת ${String(name)}`}
          heroVideoUrl={heroVideoUrl}
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
            <div
              className="grid gap-4 sm:grid-cols-2"
              role="list"
              aria-label="רשימת משחקים קרובים"
            >
              {events.map((event) => (
                <EventCard key={event.id} event={event} title={event.name} />
              ))}
            </div>
          ) : (
            <EmptyState title="אין אירועים קרובים" />
          )}
        </section>

        <ArtistVideos videos={videos} />
        <ArtistGallery images={gallery} />
        <TrustSection />
        <FAQ />
      </>
    );
  } catch (error) {
    console.error('Error fetching football team:', error);
    notFound();
  }
}
