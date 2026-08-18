import Image from "next/image";
import Link from "next/link";

import type { FootballTeam } from "@/lib/app.types";
import { EventCard } from "@/components/EventCard";
import type { CategoryPageContent, EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { getAllFootballTeams, getFeaturedFootballTeams } from "@/lib/football";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import { isEventSoldOut } from "@/lib/events/price";

import { HeroSearch } from "@/components/HeroSearch";
import { HeroCarousel, type HeroCarouselItem } from "@/components/HeroCarousel";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { Aurora } from "@/components/ui/Aurora";
import { TrustSection } from "@/components/TrustSection";
import { HubReviews } from "@/components/vertical-hub/HubReviews";
import { ExperienceCarousel } from "@/components/ExperienceCarousel";
import { CategoryEventsBrowser } from "@/components/CategoryEventsBrowser";
import FAQAccordion from "@/components/ui/FAQAccordion";
import { FAQStructuredData } from "@/components/FAQStructuredData";
import { faqItems as globalFaqItems } from "@/components/ui/FAQ";
import { HubEventsCarousel } from "@/components/vertical-hub/HubEventsCarousel";
import { StadiumCards } from "@/components/vertical-hub/StadiumCards";
import { SectionHeading } from "@/components/vertical-hub/SectionHeading";

/**
 * Vertical hub page - the rich, homepage-style experience for a ROOT vertical
 * (/c/football now; /c/music next), per the redesign spec (ROAD MAP V1 →
 * כדורגל → עמוד כדורגל):
 *
 *   homepage-style cover (search + team carousel) → league tiles → SEO text →
 *   חבילות מומלצות → לקוחות משתפים → משחקים בולטים → כל החבילות (filters) →
 *   גלריה → אצטדיונים מומלצים → בידיים בטוחות → FAQ.
 *
 * Backoffice-managed content (SEO text, gallery, stadiums, FAQ) lives in
 * `categories.page_content` (jsonb) - every missing field hides its section,
 * so the page degrades gracefully while content is still being written.
 */

// Tag names (normalized: lowercase, spaces/dashes stripped) that mark an event
// as a "משחק בולט". The backoffice team just attaches one of these event tags -
// no schema change needed.
const FEATURED_TAG_NAMES = new Set([
  "בולט",
  "משחקבולט",
  "אירועבולט",
  "featured",
  "highlight",
  "highlighted",
]);
const normalizeTag = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/** Homepage-identical ordering: featured (backoffice `featured_order`) first. */
const featuredFirst = (featured: FootballTeam[], all: FootballTeam[]) => {
  const seen = new Set(featured.map((x) => x.sys.id));
  return [...featured, ...all.filter((x) => !seen.has(x.sys.id))];
};

/** Events carrying a "featured" tag (משחקים בולטים); falls back to the
 * soonest `cap` available events while nothing is tagged yet. Shared by the
 * vertical hub and the league pages. */
export function pickFeatured<T extends { id: number }>(
  available: T[],
  tagsByEvent: Record<number, { name: string }[]>,
  cap = 4,
): T[] {
  const tagged = available.filter((e) =>
    (tagsByEvent[e.id] ?? []).some((t) => FEATURED_TAG_NAMES.has(normalizeTag(t.name))),
  );
  return (tagged.length ? tagged : available).slice(0, cap);
}

export async function VerticalHubPage({
  category,
  all,
  fallbackContent,
}: {
  category: EventCategory;
  all: EventCategory[];
  /** Bundled content used until `categories.page_content` is migrated + filled;
   * DB fields win field-by-field once they exist. */
  fallbackContent?: CategoryPageContent;
}) {
  const [{ events }, featuredTeams, allTeams, isAvailable] = await Promise.all([
    // Whole vertical: the root node + every league/team beneath it.
    getEventsInCategory(category.slug, { includeDescendants: true }),
    getFeaturedFootballTeams().catch(() => [] as FootballTeam[]),
    getAllFootballTeams().catch(() => [] as FootballTeam[]),
    getAvailabilityChecker(),
  ]);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  const content: CategoryPageContent = {
    ...fallbackContent,
    ...(category.page_content ?? {}),
  };

  // Hero-carousel ring: available teams only, featured order first - the same
  // rule as the homepage carousel.
  const heroItems: HeroCarouselItem[] = featuredFirst(featuredTeams, allTeams)
    .filter((t) => isAvailable(String(t.fields.nameDBenglish ?? "")))
    .map((entry) => ({ kind: "team" as const, entry }));

  const available = events.filter((e) => !isEventSoldOut(e));

  // משחקים בולטים: backoffice tags an event "בולט"; soonest-4 fallback until then.
  const featuredEvents = pickFeatured(available, tagsByEvent);

  // חבילות מומלצות: the rest of the available pool, so the two sections don't
  // open with the exact same cards.
  const featuredIds = new Set(featuredEvents.map((e) => e.id));
  const recommendedPool = available.filter((e) => !featuredIds.has(e.id));
  const recommended = (recommendedPool.length ? recommendedPool : available).slice(0, 12);

  // League tiles - the node's child categories (minus the CMS teams hub, which
  // the hero carousel already covers). A pure hub child (e.g. the "ליגות" node
  // that only groups the leagues) is flattened to ITS children, so the tiles
  // show actual leagues instead of one opaque "ליגות" tile.
  const byOrder = (a: EventCategory, b: EventCategory) =>
    a.display_order - b.display_order || a.name.localeCompare(b.name);
  const children = all
    .filter((c) => c.parent_id === category.id && c.slug !== "teams")
    .sort(byOrder)
    .flatMap((child) => {
      const grandchildren = all.filter((c) => c.parent_id === child.id).sort(byOrder);
      return grandchildren.length ? grandchildren : [child];
    });
  const teamsHub = all.find((c) => c.parent_id === category.id && c.slug === "teams");

  const faq = content.faq?.length ? content.faq : globalFaqItems;

  return (
    <main>
      {/* ---- Cover: homepage-style hero scoped to the vertical ---- */}
      <section
        className="relative flex min-h-[88svh] w-full flex-col justify-center gap-3 overflow-hidden bg-main px-4 pb-8 pt-24 text-white md:px-6 md:pb-10"
        role="banner"
      >
        <Aurora intensity={0.5} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 46%, hsl(160 55% 28% / 0.32), transparent 72%)",
          }}
        />
        <div className="container relative z-10 mx-auto max-w-3xl text-center" dir="rtl">
          <h1 className="mb-2 font-display text-3xl font-bold sm:text-4xl md:text-5xl lg:mb-3">
            חבילות <span className="text-secondary">{category.name}</span> לאירופה
            <span className="mt-1.5 block text-lg sm:text-2xl md:text-3xl">
              {category.subtitle ?? "כרטיס, טיסה ומלון - חבילה אחת למשחק שלא שוכחים"}
            </span>
          </h1>
        </div>
        <div className="relative z-20 mt-4 md:mt-6">
          <HeroSearch events={events} overlay />
        </div>
        <TrustBadges className="relative z-10 mt-3 justify-center text-main-foreground/80 md:mt-8" />
        {heroItems.length > 0 && (
          <div className="relative z-10 mt-1 sm:mt-2">
            <HeroCarousel items={heroItems} />
          </div>
        )}
      </section>

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- League tiles (child categories) ---- */}
          {children.length > 0 && (
            <section aria-label="ליגות">
              <SectionHeading id="hub-leagues-heading">הליגות הגדולות</SectionHeading>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="list">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/c/${slugPathOf(child, all).join("/")}`}
                    role="listitem"
                    className="group relative block h-32 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    {child.image_url ? (
                      <Image
                        src={child.image_url}
                        alt={child.name}
                        fill
                        sizes="(max-width: 640px) 45vw, 300px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-main" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                      {child.name}
                    </h3>
                  </Link>
                ))}
                {teamsHub && (
                  <Link
                    href={`/c/${slugPathOf(teamsHub, all).join("/")}`}
                    role="listitem"
                    className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-border bg-main shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="font-display text-lg font-extrabold text-main-foreground">
                      לכל הקבוצות ←
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* ---- SEO / marketing text ---- */}
          {content.seo_text && (
            <section aria-labelledby="hub-about-heading">
              <SectionHeading id="hub-about-heading">
                {content.seo_title ?? `חבילות ${category.name} בחו"ל`}
              </SectionHeading>
              <div className="max-w-4xl space-y-4 leading-relaxed text-muted-foreground">
                {content.seo_text.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          {/* ---- חבילות מומלצות ---- */}
          {recommended.length > 0 && (
            <section aria-labelledby="hub-recommended-heading">
              <SectionHeading id="hub-recommended-heading">חבילות מומלצות</SectionHeading>
              <HubEventsCarousel events={recommended} ariaLabel="חבילות מומלצות" />
            </section>
          )}

          {/* ---- לקוחות משתפים (Google reviews) ---- */}
          <section aria-labelledby="hub-reviews-heading">
            <SectionHeading id="hub-reviews-heading">לקוחות משתפים</SectionHeading>
            <HubReviews />
          </section>

          {/* ---- משחקים בולטים ---- */}
          {featuredEvents.length > 0 && (
            <section aria-labelledby="hub-featured-heading">
              <SectionHeading id="hub-featured-heading">
                משחקים בולטים זמינים באתר
              </SectionHeading>
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                role="list"
                aria-label="משחקים בולטים"
              >
                {featuredEvents.map((event) => (
                  <div key={event.id}>
                    <EventCard event={event} showName />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- כל החבילות + filters ---- */}
          <section aria-labelledby="hub-all-heading">
            <SectionHeading id="hub-all-heading">כל חבילות ה{category.name}</SectionHeading>
            {events.length > 0 ? (
              <CategoryEventsBrowser
                events={events}
                tagsByEvent={tagsByEvent}
                headingId="hub-all-heading"
              />
            ) : (
              <p className="text-muted-foreground">אין חבילות זמינות כרגע.</p>
            )}
          </section>

          {/* ---- גלריה ---- */}
          {(content.gallery?.length ?? 0) > 0 && (
            <section aria-label="גלריה">
              <ExperienceCarousel
                images={content.gallery}
                title="רגעים מהמשחקים"
                subtitle="לקוחות מגה איבנטס במשחקים הגדולים באירופה"
              />
            </section>
          )}

          {/* ---- אצטדיונים מומלצים ---- */}
          {(content.stadiums?.length ?? 0) > 0 && (
            <section aria-labelledby="hub-stadiums-heading">
              <SectionHeading id="hub-stadiums-heading">אצטדיונים מומלצים</SectionHeading>
              <StadiumCards stadiums={content.stadiums ?? []} />
            </section>
          )}
        </div>
      </div>

      {/* ---- בידיים בטוחות ---- */}
      <TrustSection />

      {/* ---- FAQ ---- */}
      <section
        className="bg-background px-4 pb-16 md:px-6"
        aria-labelledby="hub-faq-heading"
        dir="rtl"
      >
        <div className="container mx-auto">
          <SectionHeading id="hub-faq-heading">שאלות נפוצות</SectionHeading>
          <FAQStructuredData faqItems={faq} />
          <FAQAccordion items={faq} />
        </div>
      </section>
    </main>
  );
}
