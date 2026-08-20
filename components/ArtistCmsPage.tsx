import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";

import type { FootballTeam } from "@/lib/app.types";
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

/**
 * The full artist page body (hero, banners, tour dates, videos, gallery,
 * trust, FAQ) - shared by /artists/[slug] and the taxonomy leaf
 * /c/music/artists/<slug>, so both URLs look identical.
 * (Artist rows are FootballTeam-shaped - the people readers share one shape.)
 */
export async function ArtistCmsPage({ artist }: { artist: FootballTeam }) {
  const { name, nameDBenglish, bio, heroBanner, heroVideoUrl, banners, gallery, videos } = artist.fields;

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
        nameEnglish={String(nameDBenglish)}
        bio={documentToReactComponents(bio as Document, bioOptions)}
        bioFirstSentence={bioFirstSentence}
        bioCanExpand={bioCanExpand}
        imageUrl={imageUrl}
        imageAlt={`תמונה של האומן ${String(name)}`}
        heroVideoUrl={heroVideoUrl}
        artId={artist.sys.id}
        artImageUrl={artist.fields.artImageUrl}
        artColorIndex={artist.fields.artColorIndex}
        artShapeIndex={artist.fields.artShapeIndex}
      />

      <ArtistBanners banners={banners} />

      <section
        id="upcoming-events"
        className="container mx-auto scroll-mt-20 px-4 py-12"
        aria-labelledby="upcoming-events-heading"
      >
        <h2
          id="upcoming-events-heading"
          className="mb-2 font-display text-2xl font-extrabold text-foreground"
        >
          אירועים קרובים
        </h2>
        <p className="mb-6 text-muted-foreground">
          בחרו תאריך הופעה והתחילו להרכיב את החבילה שלכם
        </p>
        {events.length > 0 ? (
          <ArtistEventsFilter events={events} title={String(name)} />
        ) : (
          <EmptyState title="אין אירועים קרובים" />
        )}
      </section>

      <ArtistVideos videos={videos} />
      {/* Distinct title - the default one repeated TrustSection's "בידיים
          בטוחות" line on the same page (creative 2026-08-20). */}
      <ExperienceCarousel
        images={gallery}
        title="רגעים מההופעות"
        subtitle="לקוחות מגה איבנטס במופעים הגדולים בעולם"
      />
      <TrustSection />
      <FAQ />
    </>
  );
}
