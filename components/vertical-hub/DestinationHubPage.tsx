import Image from "next/image";
import Link from "next/link";
import { Landmark, Martini, Sparkles, UtensilsCrossed } from "lucide-react";

import type { Artist, FootballTeam } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { getAllFootballTeams } from "@/lib/football";
import { getAllArtists } from "@/lib/artists";
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
import { DESTINATION_CONTENT } from "@/components/vertical-hub/destinationContent";

/** Icon per useful-info card, keyed by what the title opens with. */
const infoIcon = (title: string) => {
  if (title.includes("בר") || title.includes("בירה")) return Martini;
  if (title.includes("מסעד")) return UtensilsCrossed;
  if (title.includes("אצטדיון") || title.includes("אולמ")) return Landmark;
  return Sparkles;
};

/**
 * Destination page (/c/destinations/london etc.) - redesign spec (עמוד יעד):
 *
 *   city cover (intro text) → who plays here (mixed teams+artists strip) →
 *   אירועים בולטים → all events + filters (city facet hidden - everything here
 *   IS the city) → מידע מועיל ללקוח → gallery → יעדים נוספים → trust.
 */
export async function DestinationHubPage({
  category,
  all,
}: {
  category: EventCategory;
  all: EventCategory[];
}) {
  const [{ events }, allTeams, allArtists] = await Promise.all([
    getEventsInCategory(category.slug),
    getAllFootballTeams().catch(() => [] as FootballTeam[]),
    getAllArtists().catch(() => [] as Artist[]),
  ]);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  const content = DESTINATION_CONTENT[category.slug];

  // Who plays here: team+artist tags on the city's events, matched to CMS cards.
  const personTagNames = { team: new Set<string>(), artist: new Set<string>() };
  Object.values(tagsByEvent).forEach((chips) =>
    chips.forEach((c) => {
      if (c.type === "team") personTagNames.team.add(c.name);
      if (c.type === "artist") personTagNames.artist.add(c.name);
    }),
  );
  const matchPeople = <T extends FootballTeam | Artist>(people: T[], names: Set<string>) =>
    people.filter((p) => {
      const en = String(p.fields.nameDBenglish ?? "");
      const he = String(p.fields.name ?? "");
      return [...names].some(
        (tag) => clubNamesMatchAnyScript(tag, en) || clubNamesMatchAnyScript(tag, he),
      );
    });
  const cityTeams = matchPeople(allTeams, personTagNames.team);
  const cityArtists = matchPeople(allArtists, personTagNames.artist);
  // Interleave so the strip alternates faces and crests.
  const cityPeople: (FootballTeam | Artist)[] = [];
  for (let i = 0; i < Math.max(cityTeams.length, cityArtists.length); i++) {
    if (cityArtists[i]) cityPeople.push(cityArtists[i]);
    if (cityTeams[i]) cityPeople.push(cityTeams[i]);
  }
  const [teamHrefs, artistHrefs] = await Promise.all([
    buildPersonHrefIndex("teams", cityTeams),
    buildPersonHrefIndex("artists", cityArtists),
  ]);
  const hrefById = Object.fromEntries([...teamHrefs, ...artistHrefs]);

  const available = events.filter((e) => !isEventSoldOut(e));
  const featuredEvents = pickFeatured(available, tagsByEvent);

  // יעדים נוספים - the sibling cities, for the closing carousel.
  const otherCities = all
    .filter((c) => c.parent_id === category.parent_id && c.id !== category.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <HubCover
        motif="stage"
        eyebrow="היעדים שלנו"
        title={category.name}
        lede={
          <p>
            {content?.intro ??
              category.subtitle ??
              `כל האירועים ב${category.name} - כרטיס, טיסה ומלון בחבילה אחת.`}
          </p>
        }
        stats={[
          { value: String(available.length), label: "חבילות זמינות" },
          { value: String(cityPeople.length), label: "קבוצות ואמנים" },
        ]}
        primaryCta={{ href: "#destination-all-heading", label: "לכל האירועים" }}
        secondaryCta={{ href: "/c/destinations", label: "לכל היעדים" }}
        strip={
          cityPeople.length > 0 ? (
            <TeamCardsRow teams={cityPeople} hrefById={hrefById} size="compact" />
          ) : undefined
        }
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- אירועים בולטים ---- */}
          {featuredEvents.length > 0 && (
            <section aria-labelledby="destination-featured-heading">
              <SectionHeading id="destination-featured-heading">
                אירועים בולטים ב{category.name}
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

          {/* ---- All events + filters. No city facet - this page IS the city. ---- */}
          <section aria-labelledby="destination-all-heading">
            <SectionHeading id="destination-all-heading">
              כל האירועים ב{category.name}
            </SectionHeading>
            {events.length > 0 ? (
              <CategoryEventsBrowser
                events={events}
                tagsByEvent={tagsByEvent}
                headingId="destination-all-heading"
                hideCityFacet
              />
            ) : (
              <EmptyState
                title="אין אירועים ביעד זה כרגע"
                description="הקטגוריה נבנית מתגיות - ברגע שאירוע יתויג בהתאם הוא יופיע כאן."
              />
            )}
          </section>

          {/* ---- מידע מועיל ללקוח ---- */}
          {(content?.info?.length ?? 0) > 0 && (
            <section aria-labelledby="destination-info-heading">
              <SectionHeading id="destination-info-heading">
                טוב לדעת ב{category.name}
              </SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2" role="list">
                {content?.info?.map((card) => {
                  const Icon = infoIcon(card.title);
                  return (
                    <div
                      key={card.title}
                      role="listitem"
                      className="rounded-2xl border border-border bg-card p-6 shadow-card"
                    >
                      <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                        <Icon className="size-5 text-primary" aria-hidden />
                        {card.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {card.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---- Gallery (creative-team images pending) ---- */}
          {(content?.gallery?.length ?? 0) > 0 && (
            <section aria-label="גלריה">
              <ExperienceCarousel
                images={content?.gallery}
                title={`רגעים מ${category.name}`}
                subtitle="לקוחות מגה איבנטס באירועים הגדולים"
              />
            </section>
          )}

          {/* ---- יעדים נוספים ---- */}
          {otherCities.length > 0 && (
            <section aria-labelledby="destination-others-heading">
              <SectionHeading id="destination-others-heading">יעדים נוספים</SectionHeading>
              <div
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="list"
              >
                {otherCities.map((city) => (
                  <Link
                    key={city.id}
                    href={`/c/${slugPathOf(city, all).join("/")}`}
                    role="listitem"
                    className="group relative block h-32 w-[60%] shrink-0 snap-start overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:w-[240px]"
                  >
                    {city.image_url ? (
                      <>
                        <Image
                          src={city.image_url}
                          alt={city.name}
                          fill
                          sizes="(max-width: 640px) 60vw, 240px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                          {city.name}
                        </h3>
                      </>
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          background:
                            "radial-gradient(80% 90% at 50% -20%, hsl(150 60% 62% / 0.22), hsl(var(--surface-inverse)))",
                        }}
                      >
                        <h3 className="px-3 text-center font-display text-lg font-extrabold text-main-foreground transition-colors group-hover:text-secondary">
                          {city.name}
                        </h3>
                      </div>
                    )}
                  </Link>
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
