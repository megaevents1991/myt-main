import type { FootballTeam } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { getAllFootballTeams } from "@/lib/football";
import { buildPersonHrefIndex } from "@/lib/cmsTwin";
import { normalizeName } from "@/lib/eventNameMatch";
import { isEventSoldOut } from "@/lib/events/price";

import { DetailHero } from "@/components/DetailHero";
import { HeaderTitle } from "@/components/HeaderTitle";
import ClientTracker from "@/components/ClientTracker";
import { TrustSection } from "@/components/TrustSection";
import { ExperienceCarousel } from "@/components/ExperienceCarousel";
import { CategoryEventsBrowser } from "@/components/CategoryEventsBrowser";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/vertical-hub/SectionHeading";
import { TeamCardsRow } from "@/components/vertical-hub/TeamCardsRow";
import { pickFeatured } from "@/components/vertical-hub/VerticalHubPage";
import { LEAGUE_CONTENT } from "@/components/vertical-hub/leagueContent";

/**
 * League page (/c/football/premier-league etc.) - redesign spec (ROAD MAP V1 →
 * כדורגל → עמוד ליגה):
 *
 *   league text (hero) → league-teams carousel (homepage card design) →
 *   משחקים בולטים (backoffice "בולט" tag, soonest fallback) →
 *   all games + filters → gallery → league facts → trust.
 *
 * League→teams mapping is derived, not stored: the league's events carry
 * team-type tags, and those tag names are matched to the CMS team cards via
 * normalizeName. A team with no CMS card simply doesn't get a card.
 */
export async function LeagueHubPage({
  category,
}: {
  category: EventCategory;
}) {
  const [{ events }, allTeams] = await Promise.all([
    getEventsInCategory(category.slug),
    getAllFootballTeams().catch(() => [] as FootballTeam[]),
  ]);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  const content = LEAGUE_CONTENT[category.slug];

  // Teams of THIS league: team-type tag names on the league's events,
  // normalized-matched to the CMS cards.
  const teamTagNames = new Set<string>();
  Object.values(tagsByEvent).forEach((chips) =>
    chips.forEach((c) => {
      if (c.type === "team") teamTagNames.add(normalizeName(c.name));
    }),
  );
  const leagueTeams = allTeams.filter((t) => {
    const en = normalizeName(String(t.fields.nameDBenglish ?? ""));
    const he = normalizeName(String(t.fields.name ?? ""));
    return (en && teamTagNames.has(en)) || (he && teamTagNames.has(he));
  });
  const hrefIndex = await buildPersonHrefIndex("teams", leagueTeams);

  const available = events.filter((e) => !isEventSoldOut(e));
  const featuredEvents = pickFeatured(available, tagsByEvent);

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <DetailHero
        name={category.name}
        bio={
          content?.intro ? (
            <p>{content.intro}</p>
          ) : category.subtitle ? (
            <p>{category.subtitle}</p>
          ) : null
        }
        imageUrl={category.image_url ?? undefined}
        imageAlt={`באנר ${category.name}`}
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- League teams carousel ---- */}
          {leagueTeams.length > 0 && (
            <section aria-labelledby="league-teams-heading">
              <SectionHeading id="league-teams-heading">
                קבוצות ה{category.name}
              </SectionHeading>
              <TeamCardsRow
                teams={leagueTeams}
                hrefById={Object.fromEntries(hrefIndex)}
              />
            </section>
          )}

          {/* ---- משחקים בולטים ---- */}
          {featuredEvents.length > 0 && (
            <section aria-labelledby="league-featured-heading">
              <SectionHeading id="league-featured-heading">
                משחקים בולטים ב{category.name}
              </SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="list">
                {featuredEvents.map((event) => (
                  <div key={event.id}>
                    <EventCard event={event} showName />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- All games + filters ---- */}
          <section aria-labelledby="league-all-heading">
            <SectionHeading id="league-all-heading">
              כל משחקי ה{category.name}
            </SectionHeading>
            {events.length > 0 ? (
              <CategoryEventsBrowser
                events={events}
                tagsByEvent={tagsByEvent}
                headingId="league-all-heading"
              />
            ) : (
              <EmptyState
                title="אין חבילות בליגה זו כרגע"
                description="הקטגוריה נבנית מתגיות - ברגע שאירוע יתויג בהתאם הוא יופיע כאן."
              />
            )}
          </section>

          {/* ---- Gallery (creative-team images pending) ---- */}
          {(content?.gallery?.length ?? 0) > 0 && (
            <section aria-label="גלריה">
              <ExperienceCarousel
                images={content?.gallery}
                title={`רגעים מה${category.name}`}
                subtitle="לקוחות מגה איבנטס במשחקים הגדולים"
              />
            </section>
          )}

          {/* ---- League facts ---- */}
          {(content?.facts?.length ?? 0) > 0 && (
            <section aria-labelledby="league-facts-heading">
              <SectionHeading id="league-facts-heading">
                מידע מעניין על ה{category.name}
              </SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2" role="list">
                {content?.facts?.map((f) => (
                  <div
                    key={f.title}
                    role="listitem"
                    className="rounded-2xl border border-border bg-card p-6 shadow-card"
                  >
                    <h3 className="mb-2 font-display text-lg font-bold text-foreground">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <TrustSection />
    </>
  );
}
