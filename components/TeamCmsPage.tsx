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
import { HomeAwayEvents } from "@/components/HomeAwayEvents";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrustSection } from "@/components/TrustSection";
import { FAQ } from "@/components/ui/FAQ";
import { ArtistBanners } from "@/components/ArtistBanners";
import { ExperienceCarousel } from "@/components/ExperienceCarousel";
import { ArtistVideos } from "@/components/ArtistVideos";
import { TeamExtrasSection } from "@/components/vertical-hub/TeamExtrasSection";
import { TEAM_EXTRAS } from "@/components/vertical-hub/teamExtras";
import { normalizeName } from "@/lib/eventNameMatch";
import type { CategoryPageContent } from "@/lib/taxonomy.types";

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
 * The full team page body (hero, banners, home/away fixtures, videos,
 * gallery, trust, FAQ) - shared by /football/[slug] and the taxonomy leaf
 * /c/football/teams/<slug>, so both URLs look identical.
 */
export async function TeamCmsPage({
  team,
  pageContent,
}: {
  team: FootballTeam;
  /** The team CATEGORY's page_content (backoffice) - wins over bundled extras. */
  pageContent?: CategoryPageContent | null;
}) {
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
  // Cover extras (redesign: "קאבר יותר מחרמן") - honours as chips, stadium
  // city as the eyebrow. Teams without a TEAM_EXTRAS entry render the plain hero.
  const bundled = TEAM_EXTRAS[normalizeName(String(nameDBenglish ?? ""))];
  const extras = {
    stadium: pageContent?.stadiums?.[0] ?? bundled?.stadium,
    honours: pageContent?.honours ?? bundled?.honours,
  };

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
        eyebrow={extras?.stadium ? `${extras.stadium.name} · ${extras.stadium.city}` : undefined}
        chips={extras?.honours}
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
            {/* Home/away with a toggle - the picked kind on top, the other
                below (creative 2026-08-20). */}
            <HomeAwayEvents
              homeEvents={homeEvents}
              awayEvents={awayEvents}
              title={String(name)}
            />
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
      <TeamExtrasSection nameDBenglish={String(nameDBenglish)} override={pageContent} />

      <ArtistVideos videos={videos} />
      {/* "חוויות מהדשא" (creative 2026-08-20) - backoffice page_content
          gallery wins; the CMS card's gallery fills in behind it. */}
      <ExperienceCarousel
        images={pageContent?.gallery?.length ? pageContent.gallery : gallery}
        title="חוויות מהדשא"
        subtitle="לקוחות מגה איבנטס במשחקים הגדולים באירופה"
      />
      <TrustSection />
      <FAQ />
    </>
  );
}
