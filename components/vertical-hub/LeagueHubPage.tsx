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
import { HubEventsCarousel } from "@/components/vertical-hub/HubEventsCarousel";
import { StadiumCards } from "@/components/vertical-hub/StadiumCards";
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

  // DB-first content: whatever the backoffice wrote in page_content wins
  // field-by-field; the bundled launch copy fills the gaps.
  const local = LEAGUE_CONTENT[category.slug];
  const content = {
    intro: local?.intro,
    facts: local?.facts,
    gallery: local?.gallery,
    stadiums: local?.stadiums,
    // An empty backoffice array must not shadow bundled content - only a
    // field someone actually filled wins.
    ...(Object.fromEntries(
      Object.entries(category.page_content ?? {}).filter(
        ([, v]) => v != null && (!Array.isArray(v) || v.length > 0),
      ),
    ) as typeof category.page_content),
  };

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
  // Slider of up to 8 (creative 2026-08-20: "סליידר עד 8 משחקים").
  const featuredEvents = pickFeatured(
    available,
    tagsByEvent,
    8,
    content?.featured_event_ids,
  );

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
        strip={
          // Same structure as the football page (creative 2026-08-20): the
          // league's crests ride the cover as a compact roster strip - the
          // old big-card section below is gone ("זה עף כי עובר לסליידר").
          leagueTeams.length > 0 ? (
            <TeamCardsRow
              teams={leagueTeams}
              hrefById={Object.fromEntries(hrefIndex)}
              size="compact"
            />
          ) : undefined
        }
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- משחקים בולטים - slider, up to 8 ---- */}
          {featuredEvents.length > 0 && (
            <section aria-labelledby="league-featured-heading">
              <SectionHeading id="league-featured-heading">
                משחקים בולטים ב{definite(category.name)}
              </SectionHeading>
              <HubEventsCarousel
                events={featuredEvents}
                ariaLabel={`משחקים בולטים ב${definite(category.name)}`}
              />
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
                searchPlaceholder="קבוצה או עיר"
                hideTagTypes={["artist", "genre"]}
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

          {/* ---- League stadiums (creative 2026-08-20: "להוסיף אצטדיונים
               בפרמייר ליג כמו בעמוד כדורגל") ---- */}
          {(content?.stadiums?.length ?? 0) > 0 && (
            <section aria-labelledby="league-stadiums-heading">
              <SectionHeading id="league-stadiums-heading">
                אצטדיוני {definite(category.name)}
              </SectionHeading>
              <StadiumCards stadiums={content?.stadiums ?? []} variant="carousel" />
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
