import { BLOCKS, MARKS, Document } from "@contentful/rich-text-types";
import {
  documentToReactComponents,
  Options,
} from "@contentful/rich-text-react-renderer";
import { ReactNode } from "react";

import type { FootballTeam } from "@/lib/app.types";
import { getEventsByName } from "@/lib/eventsData";
import { teamFixtureRole } from "@/lib/eventNameMatch";
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
import { TeamExtrasSection } from "@/components/vertical-hub/TeamExtrasSection";

const Bold = ({ children }: { children: ReactNode }) => (
  <strong className="font-bold">{children}</strong>
);

/** Green-cube section heading - same look as the catalog's "זמין באתר" rows. */
const CubeHeading = ({ children }: { children: ReactNode }) => (
  <div className="mb-4 flex flex-row items-stretch justify-start lg:mb-6">
    <div aria-hidden className="mx-1 bg-secondary" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 23 }} />
    <div aria-hidden className="mx-1 hidden bg-secondary sm:block" style={{ height: 40, width: 46 }} />
    <div>
      <h3 className="mx-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {children}
      </h3>
    </div>
  </div>
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
 * The full team page body (hero, banners, home/away fixtures, videos,
 * gallery, trust, FAQ) - shared by /football/[slug] and the taxonomy leaf
 * /c/football/teams/<slug>, so both URLs look identical.
 */
export async function TeamCmsPage({ team }: { team: FootballTeam }) {
  const { name, nameDBenglish, bio, heroBanner, heroVideoUrl, banners, gallery, videos } = team.fields;

  const { events } = await getEventsByName(String(nameDBenglish));

  // Split fixtures by the team's role - "X vs Y" naming, first side hosts.
  // Unclassified = competition-hub pages ("Champions League", where sides
  // never equal the page's name) and non-fixture events → shown as one plain
  // list exactly like before the split.
  const homeEvents = events.filter(
    (e) => teamFixtureRole(e.name_english ?? "", String(nameDBenglish)) === "home"
  );
  const awayEvents = events.filter(
    (e) => teamFixtureRole(e.name_english ?? "", String(nameDBenglish)) === "away"
  );
  const unclassifiedEvents = events.filter(
    (e) => teamFixtureRole(e.name_english ?? "", String(nameDBenglish)) === null
  );
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
        artImageScale={team.fields.artImageScale}
        artImageOffsetX={team.fields.artImageOffsetX}
        artImageOffsetY={team.fields.artImageOffsetY}
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
        {events.length === 0 ? (
          <EmptyState title="אין אירועים קרובים" />
        ) : homeEvents.length === 0 && awayEvents.length === 0 ? (
          // Hub pages (e.g. ליגת האלופות) - no home/away notion, one list.
          <ArtistEventsFilter events={events} title={String(name)} showName />
        ) : (
          <div className="flex flex-col gap-10">
            {homeEvents.length > 0 && (
              <div>
                <CubeHeading>משחקי בית</CubeHeading>
                <ArtistEventsFilter
                  events={homeEvents}
                  title={String(name)}
                  showName
                />
              </div>
            )}
            {awayEvents.length > 0 && (
              <div>
                <CubeHeading>משחקי חוץ</CubeHeading>
                <ArtistEventsFilter
                  events={awayEvents}
                  title={String(name)}
                  showName
                />
              </div>
            )}
            {unclassifiedEvents.length > 0 && (
              <ArtistEventsFilter
                events={unclassifiedEvents}
                title={String(name)}
                showName
              />
            )}
          </div>
        )}
      </section>

      {/* Redesign extras - stadium / city / matchday / honours (content-keyed;
          teams without a TEAM_EXTRAS entry render nothing here). */}
      <TeamExtrasSection nameDBenglish={String(nameDBenglish)} />

      <ArtistVideos videos={videos} />
      <ExperienceCarousel images={gallery} />
      <TrustSection />
      <FAQ />
    </>
  );
}
