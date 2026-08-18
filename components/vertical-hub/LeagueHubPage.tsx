import type { FootballTeam } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { getAllFootballTeams } from "@/lib/football";
import { buildPersonHrefIndex } from "@/lib/cmsTwin";
import { clubNamesMatchAnyScript } from "@/lib/eventNameMatch";
import { isEventSoldOut } from "@/lib/events/price";

import { HubCover } from "@/components/vertical-hub/HubCover";
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

/**
 * Hebrew definite article for a league name.
 *
 * "פרמייר ליג" → "הפרמייר ליג", but a name that is ALREADY definite or opens
 * with ל ("לה ליגה", "ליגת האלופות") must not take another ה - "הלה ליגה" is
 * not Hebrew.
 */
const definite = (name: string) =>
  /^[הל]/.test(name.trim()) ? name : `ה${name}`;

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

  // Teams of THIS league: team-type tag names on the league's events, matched
  // to the CMS cards. Club-qualifier drift between the two is the norm ("FC
  // ברצלונה" the tag vs "ברצלונה" the card, "Tottenham Hotspur FC" vs
  // "טוטנהאם"), so match on identifying tokens - exact equality silently
  // dropped Barcelona from לה ליגה.
  const teamTagNames = new Set<string>();
  Object.values(tagsByEvent).forEach((chips) =>
    chips.forEach((c) => {
      if (c.type === "team") teamTagNames.add(c.name);
    }),
  );
  const leagueTeams = allTeams.filter((t) => {
    const en = String(t.fields.nameDBenglish ?? "");
    const he = String(t.fields.name ?? "");
    return [...teamTagNames].some(
      (tag) => clubNamesMatchAnyScript(tag, en) || clubNamesMatchAnyScript(tag, he),
    );
  });
  const hrefIndex = await buildPersonHrefIndex("teams", leagueTeams);

  const available = events.filter((e) => !isEventSoldOut(e));
  const featuredEvents = pickFeatured(available, tagsByEvent);

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <HubCover
        eyebrow="ליגות הכדורגל של אירופה"
        title={category.name}
        lede={
          <p>
            {content?.intro ??
              category.subtitle ??
              `כל המשחקים ב${definite(category.name)} שאפשר להזמין אצלנו - כרטיס, טיסה ומלון בחבילה אחת.`}
          </p>
        }
        stats={[
          { value: String(available.length), label: "חבילות זמינות" },
          { value: String(leagueTeams.length), label: "קבוצות" },
        ]}
        primaryCta={{ href: "#league-all-heading", label: "לכל המשחקים" }}
        secondaryCta={{ href: "/c/football", label: "לעמוד הכדורגל" }}
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- League teams carousel ---- */}
          {leagueTeams.length > 0 && (
            <section aria-labelledby="league-teams-heading">
              <SectionHeading id="league-teams-heading">
                קבוצות {definite(category.name)}
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
                משחקים בולטים ב{definite(category.name)}
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
              כל המשחקים ב{definite(category.name)}
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
                title={`רגעים מ${definite(category.name)}`}
                subtitle="לקוחות מגה איבנטס במשחקים הגדולים"
              />
            </section>
          )}

          {/* ---- League facts ---- */}
          {(content?.facts?.length ?? 0) > 0 && (
            <section aria-labelledby="league-facts-heading">
              <SectionHeading id="league-facts-heading">
                מידע מעניין על {definite(category.name)}
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
