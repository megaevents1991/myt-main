import Image from "next/image";
import Link from "next/link";

import type { FootballTeam } from "@/lib/app.types";
import { HubEventCard } from "@/components/vertical-hub/HubEventCard";
import type { CategoryPageContent, EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { getAllFootballTeams, getFeaturedFootballTeams } from "@/lib/football";
import { getAllArtists, getFeaturedArtists } from "@/lib/artists";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import { isEventSoldOut } from "@/lib/events/price";

import { buildPersonHrefIndex } from "@/lib/cmsTwin";
import { HubCover } from "@/components/vertical-hub/HubCover";
import { TeamCardsRow } from "@/components/vertical-hub/TeamCardsRow";
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
 *   cover (lede + live counts) → crest strip → league tiles → חבילות מומלצות →
 *   לקוחות משתפים → משחקים בולטים → כל החבילות (filters) → גלריה →
 *   אצטדיונים מומלצים → על הוורטיקל → בידיים בטוחות → FAQ.
 *
 * The cover is deliberately NOT the homepage hero: no search (you already chose
 * the vertical) and no full-height stage - it states what is bookable and hands
 * you to the packages.
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
const featuredFirst = <T extends { sys: { id: string } }>(featured: T[], all: T[]): T[] => {
  const seen = new Set(featured.map((x) => x.sys.id));
  return [...featured, ...all.filter((x) => !seen.has(x.sys.id))];
};

/** Resolve a backoffice-curated id list against the available pool, keeping
 * the curated order. Ids that are sold out / gone just drop. */
export function pickCurated<T extends { id: number }>(
  available: T[],
  manualIds: number[] | null | undefined,
  cap: number,
): T[] {
  if (!manualIds?.length) return [];
  const byId = new Map(available.map((e) => [e.id, e]));
  return manualIds
    .map((id) => byId.get(id))
    .filter((e): e is T => e != null)
    .slice(0, cap);
}

/** Events for the בולטים section. Priority: the backoffice's hand-picked list
 * (page_content.featured_event_ids) → events carrying a "featured" tag →
 * the soonest `cap` available events. Shared by the vertical hub and the
 * league/genre/destination pages. */
export function pickFeatured<T extends { id: number }>(
  available: T[],
  tagsByEvent: Record<number, { name: string }[]>,
  cap = 4,
  manualIds?: number[] | null,
): T[] {
  const curated = pickCurated(available, manualIds, 8);
  if (curated.length) return curated;
  const tagged = available.filter((e) =>
    (tagsByEvent[e.id] ?? []).some((t) => FEATURED_TAG_NAMES.has(normalizeTag(t.name))),
  );
  return (tagged.length ? tagged : available).slice(0, cap);
}

/**
 * Per-vertical wording + which CMS people ride the cover strip. The page
 * structure is identical; only the vocabulary and the roster source differ.
 * Genre tiles are intentionally OFF for music (redesign spec: "לא צריך את
 * הקוביות השחורות" - genres stay as filters in the browser).
 */
const HUB_KINDS = {
  football: {
    peopleKind: "teams" as const,
    fetchFeatured: getFeaturedFootballTeams,
    fetchAll: getAllFootballTeams,
    eyebrow: (name: string) => `${name} באירופה`,
    titleAccent: "לכל המשחקים הגדולים",
    fallbackLede: "כרטיס, טיסה ומלון - חבילה אחת למשחק שלא שוכחים.",
    statChildren: "ליגות",
    statPeople: "קבוצות",
    peopleCta: "לכל הקבוצות",
    showChildTiles: true,
    tilesHeading: "הליגות הגדולות",
    featuredHeading: "משחקים בולטים זמינים באתר",
    allHeading: (name: string) => `כל חבילות ה${name}`,
    motif: "pitch" as const,
    galleryTitle: "רגעים מהמשחקים",
    gallerySubtitle: "לקוחות מגה איבנטס במשחקים הגדולים באירופה",
  },
  music: {
    peopleKind: "artists" as const,
    fetchFeatured: getFeaturedArtists,
    fetchAll: getAllArtists,
    eyebrow: () => "ההופעות הגדולות בעולם",
    titleAccent: "לכל ההופעות הגדולות",
    fallbackLede: "כרטיס, טיסה ומלון - חבילה אחת להופעה שלא שוכחים.",
    statChildren: "ז'אנרים",
    statPeople: "אמנים",
    peopleCta: "לכל האמנים",
    showChildTiles: false,
    tilesHeading: "",
    featuredHeading: "הופעות בולטות זמינות באתר",
    allHeading: () => "כל ההופעות",
    motif: "stage" as const,
    galleryTitle: "רגעים מההופעות",
    gallerySubtitle: "לקוחות מגה איבנטס במופעים הגדולים בעולם",
  },
} satisfies Record<string, unknown>;

export type HubKind = keyof typeof HUB_KINDS;

export async function VerticalHubPage({
  category,
  all,
  kind,
  fallbackContent,
}: {
  category: EventCategory;
  all: EventCategory[];
  kind: HubKind;
  /** Bundled content used until `categories.page_content` is migrated + filled;
   * DB fields win field-by-field once they exist. */
  fallbackContent?: CategoryPageContent;
}) {
  const cfg = HUB_KINDS[kind];
  const [{ events }, featuredPeople, allPeople, isAvailable] = await Promise.all([
    // Whole vertical: the root node + every league/genre/person beneath it.
    getEventsInCategory(category.slug, { includeDescendants: true }),
    cfg.fetchFeatured().catch(() => [] as FootballTeam[]),
    cfg.fetchAll().catch(() => [] as FootballTeam[]),
    getAvailabilityChecker(),
  ]);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  const content: CategoryPageContent = {
    ...fallbackContent,
    ...(category.page_content ?? {}),
  };

  // Cover strip: bookable people only, featured order first.
  const coverPeople = featuredFirst(featuredPeople, allPeople).filter((t) =>
    isAvailable(String(t.fields.nameDBenglish ?? "")),
  );
  const coverPeopleHrefs = await buildPersonHrefIndex(cfg.peopleKind, coverPeople);

  const available = events.filter((e) => !isEventSoldOut(e));

  // משחקים בולטים: backoffice hand-pick (page_content) → "בולט" tag → soonest-4.
  const featuredEvents = pickFeatured(available, tagsByEvent, 4, content.featured_event_ids);

  // חבילות מומלצות: backoffice hand-pick first; otherwise the rest of the
  // available pool, so the two sections don't open with the exact same cards.
  const featuredIds = new Set(featuredEvents.map((e) => e.id));
  const recommendedPool = available.filter((e) => !featuredIds.has(e.id));
  const curatedRecommended = pickCurated(available, content.recommended_event_ids, 12);
  const recommended = curatedRecommended.length
    ? curatedRecommended
    : (recommendedPool.length ? recommendedPool : available).slice(0, 12);

  // League tiles - the node's child categories (minus the CMS teams hub, which
  // the hero carousel already covers). A pure hub child (e.g. the "ליגות" node
  // that only groups the leagues) is flattened to ITS children, so the tiles
  // show actual leagues instead of one opaque "ליגות" tile.
  const byOrder = (a: EventCategory, b: EventCategory) =>
    a.display_order - b.display_order || a.name.localeCompare(b.name);
  const peopleHubSlug = cfg.peopleKind;
  const children = all
    .filter((c) => c.parent_id === category.id && c.slug !== peopleHubSlug)
    .sort(byOrder)
    .flatMap((child) => {
      const grandchildren = all.filter((c) => c.parent_id === child.id).sort(byOrder);
      return grandchildren.length ? grandchildren : [child];
    });
  const peopleHub = all.find(
    (c) => c.parent_id === category.id && c.slug === peopleHubSlug,
  );

  const faq = content.faq?.length ? content.faq : globalFaqItems;

  // The lede is the first paragraph of the marketing text - the rest stays in
  // the "about" block further down, so the cover says enough to orient you
  // without turning into an essay.
  const paragraphs = (content.seo_text ?? "").split("\n\n").filter(Boolean);
  const [lede, ...restParagraphs] = paragraphs;

  return (
    <main>
      {/* ---- Cover: content-sized, carries the lede. No search - that is the
           homepage's job; here you already chose the vertical. ---- */}
      <HubCover
        motif={cfg.motif}
        eyebrow={cfg.eyebrow(category.name)}
        title={`חבילות ${category.name}`}
        titleAccent={cfg.titleAccent}
        lede={
          content.intro ? (
            <p>{content.intro}</p>
          ) : lede ? (
            <p>{lede}</p>
          ) : (
            <p>{category.subtitle ?? cfg.fallbackLede}</p>
          )
        }
        stats={[
          { value: String(available.length), label: "חבילות זמינות" },
          { value: String(children.length), label: cfg.statChildren },
          { value: String(coverPeople.length), label: cfg.statPeople },
        ]}
        primaryCta={{ href: "#hub-all-heading", label: "לכל החבילות" }}
        secondaryCta={
          peopleHub
            ? { href: `/c/${slugPathOf(peopleHub, all).join("/")}`, label: cfg.peopleCta }
            : undefined
        }
        strip={
          coverPeople.length > 0 ? (
            <TeamCardsRow
              teams={coverPeople}
              hrefById={Object.fromEntries(coverPeopleHrefs)}
              size="compact"
            />
          ) : undefined
        }
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto space-y-12 lg:space-y-16">
          {/* ---- League tiles (child categories) ---- */}
          {cfg.showChildTiles && children.length > 0 && (
            <section aria-label={cfg.tilesHeading}>
              <SectionHeading id="hub-leagues-heading">{cfg.tilesHeading}</SectionHeading>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="list">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/c/${slugPathOf(child, all).join("/")}`}
                    role="listitem"
                    className="group relative block h-32 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    {child.image_url ? (
                      <>
                        <Image
                          src={child.image_url}
                          alt={child.name}
                          fill
                          sizes="(max-width: 640px) 45vw, 300px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                          {child.name}
                        </h3>
                      </>
                    ) : (
                      // No tile image yet (creative pending) - floodlit ground with
                      // the league name as the tile, matching the cover's world.
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          background:
                            "radial-gradient(80% 90% at 50% -20%, hsl(150 60% 62% / 0.22), hsl(var(--surface-inverse)))",
                        }}
                      >
                        <h3 className="px-3 text-center font-display text-xl font-extrabold text-main-foreground transition-colors group-hover:text-secondary">
                          {child.name}
                        </h3>
                      </div>
                    )}
                  </Link>
                ))}
                {peopleHub && (
                  <Link
                    href={`/c/${slugPathOf(peopleHub, all).join("/")}`}
                    role="listitem"
                    className="group relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-border bg-main shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <span className="font-display text-lg font-extrabold text-main-foreground">
                      {cfg.peopleCta} ←
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* ---- About the vertical - the paragraphs the cover's lede didn't take ---- */}
          {restParagraphs.length > 0 && (
            <section aria-labelledby="hub-about-heading">
              <SectionHeading id="hub-about-heading">
                {content.seo_title ?? `חבילות ${category.name} בחו"ל`}
              </SectionHeading>
              <div className="max-w-4xl space-y-4 leading-relaxed text-muted-foreground">
                {restParagraphs.map((para, i) => (
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
                {cfg.featuredHeading}
              </SectionHeading>
              <div
                className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4"
                role="list"
                aria-label={cfg.featuredHeading}
              >
                {featuredEvents.map((event) => (
                  <HubEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {/* ---- כל החבילות + filters ---- */}
          <section aria-labelledby="hub-all-heading">
            <SectionHeading id="hub-all-heading">{cfg.allHeading(category.name)}</SectionHeading>
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
                title={cfg.galleryTitle}
                subtitle={cfg.gallerySubtitle}
              />
            </section>
          )}

          {/* ---- אצטדיונים מומלצים ---- */}
          {(content.stadiums?.length ?? 0) > 0 && (
            <section aria-labelledby="hub-stadiums-heading">
              <SectionHeading id="hub-stadiums-heading">אצטדיונים מומלצים</SectionHeading>
              <StadiumCards stadiums={content.stadiums ?? []} variant="carousel" />
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
