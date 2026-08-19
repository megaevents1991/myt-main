import type { Artist } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
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
import { GENRE_CONTENT } from "@/components/vertical-hub/genreContent";

/**
 * Genre page (/c/music/genres/pop etc.) - redesign spec (עמוד ז'אנר):
 *
 *   genre text (floodlit cover) → the genre's artists on the cover strip →
 *   הופעות בולטות → all shows + filters (only this genre's facets) →
 *   gallery → genre facts → trust.
 *
 * Genre→artists mapping is derived like the leagues: the genre's events carry
 * artist-type tags, matched to the CMS artist cards by identifying tokens.
 */
export async function GenreHubPage({ category }: { category: EventCategory }) {
  const [{ events }, allArtists] = await Promise.all([
    getEventsInCategory(category.slug),
    getAllArtists().catch(() => [] as Artist[]),
  ]);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  // DB-first content - backoffice page_content wins over the bundled copy.
  const local = GENRE_CONTENT[category.slug];
  const content = {
    intro: local?.intro,
    facts: local?.facts,
    gallery: local?.gallery,
    ...(Object.fromEntries(
      Object.entries(category.page_content ?? {}).filter(([, v]) => v != null),
    ) as typeof category.page_content),
  };

  // Artists of THIS genre: artist-type tag names on the genre's events.
  const artistTagNames = new Set<string>();
  Object.values(tagsByEvent).forEach((chips) =>
    chips.forEach((c) => {
      if (c.type === "artist") artistTagNames.add(c.name);
    }),
  );
  const genreArtists = allArtists.filter((a) => {
    const en = String(a.fields.nameDBenglish ?? "");
    const he = String(a.fields.name ?? "");
    return [...artistTagNames].some(
      (tag) => clubNamesMatchAnyScript(tag, en) || clubNamesMatchAnyScript(tag, he),
    );
  });
  const hrefIndex = await buildPersonHrefIndex("artists", genreArtists);

  const available = events.filter((e) => !isEventSoldOut(e));
  const featuredEvents = pickFeatured(available, tagsByEvent);

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <HubCover
        motif="stage"
        eyebrow="סגנונות המוזיקה שלנו"
        title={category.name}
        lede={
          <p>
            {content?.intro ??
              category.subtitle ??
              `כל הופעות ה${category.name} שאפשר להזמין אצלנו - כרטיס, טיסה ומלון בחבילה אחת.`}
          </p>
        }
        stats={[
          { value: String(available.length), label: "חבילות זמינות" },
          { value: String(genreArtists.length), label: "אמנים" },
        ]}
        primaryCta={{ href: "#genre-all-heading", label: "לכל ההופעות" }}
        secondaryCta={{ href: "/c/music", label: "לעמוד המוזיקה" }}
        strip={
          genreArtists.length > 0 ? (
            <TeamCardsRow
              teams={genreArtists}
              hrefById={Object.fromEntries(hrefIndex)}
              size="compact"
            />
          ) : undefined
        }
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- הופעות בולטות ---- */}
          {featuredEvents.length > 0 && (
            <section aria-labelledby="genre-featured-heading">
              <SectionHeading id="genre-featured-heading">
                הופעות בולטות
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

          {/* ---- All shows + filters (facets scoped to this genre's pool) ---- */}
          <section aria-labelledby="genre-all-heading">
            <SectionHeading id="genre-all-heading">כל ההופעות</SectionHeading>
            {events.length > 0 ? (
              <CategoryEventsBrowser
                events={events}
                tagsByEvent={tagsByEvent}
                headingId="genre-all-heading"
              />
            ) : (
              <EmptyState
                title="אין הופעות בז'אנר זה כרגע"
                description="הקטגוריה נבנית מתגיות - ברגע שהופעה תתויג בהתאם היא תופיע כאן."
              />
            )}
          </section>

          {/* ---- Gallery (creative-team images pending) ---- */}
          {(content?.gallery?.length ?? 0) > 0 && (
            <section aria-label="גלריה">
              <ExperienceCarousel
                images={content?.gallery}
                title={`רגעים מהופעות ${category.name}`}
                subtitle="לקוחות מגה איבנטס במופעים הגדולים"
              />
            </section>
          )}

          {/* ---- Genre facts ---- */}
          {(content?.facts?.length ?? 0) > 0 && (
            <section aria-labelledby="genre-facts-heading">
              <SectionHeading id="genre-facts-heading">
                מידע מעניין על {category.name}
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
