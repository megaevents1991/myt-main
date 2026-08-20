import type { FootballTeam } from "@/lib/app.types";
import type { CategoryPageContent, EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { getAllFootballTeams, getFeaturedFootballTeams } from "@/lib/football";
import { getAllArtists, getFeaturedArtists } from "@/lib/artists";
import { getAvailabilityChecker } from "@/lib/tourStatus";
import { computePackagePrice, isEventSoldOut } from "@/lib/events/price";

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
import { HubTilesRow } from "@/components/vertical-hub/HubTilesRow";
import { GenreTiles } from "@/components/vertical-hub/GenreTiles";
import { buildPickerCollage } from "@/components/vertical-hub/pickerCollage";
import { StadiumCards } from "@/components/vertical-hub/StadiumCards";
import { SectionHeading } from "@/components/vertical-hub/SectionHeading";

/**
 * Vertical hub page - the rich, homepage-style experience for a ROOT vertical
 * (/c/football, /c/music), per the creative review (ROAD MAP V1, 2026-08-20):
 *
 *   cover (lede, no counts/buttons) → crest strip → league slider / genre
 *   tiles → המשחקים המבוקשים ביותר → לקוחות משתפים → החבילות המשתלמות ביותר
 *   (football) → כל החבילות (filters) → גלריה → אצטדיונים → SEO text (bottom)
 *   → בידיים בטוחות → FAQ.
 *
 * Backoffice-managed content (SEO text, gallery, stadiums, FAQ, curated ids)
 * lives in `categories.page_content` (jsonb) - every missing field hides its
 * section, so the page degrades gracefully while content is being written.
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
 * the soonest `cap` available events. Destination pages pass
 * `soonestFallback: false` (creative 2026-08-20: "אם לא שמנו אירועים בולטים
 * שלא יהיה את זה בכלל") so an uncurated city shows no בולטים section. */
export function pickFeatured<T extends { id: number }>(
  available: T[],
  tagsByEvent: Record<number, { name: string }[]>,
  cap = 4,
  manualIds?: number[] | null,
  opts?: { soonestFallback?: boolean },
): T[] {
  const curated = pickCurated(available, manualIds, Math.max(cap, 8));
  if (curated.length) return curated;
  const tagged = available.filter((e) =>
    (tagsByEvent[e.id] ?? []).some((t) => FEATURED_TAG_NAMES.has(normalizeTag(t.name))),
  );
  if (tagged.length) return tagged.slice(0, cap);
  return (opts?.soonestFallback ?? true) ? available.slice(0, cap) : [];
}

/**
 * Per-vertical wording + which CMS people ride the cover strip. The page
 * structure is identical; only the vocabulary, the tiles flavor (league
 * slider vs genre clusters) and the roster source differ.
 */
const HUB_KINDS = {
  football: {
    peopleKind: "teams" as const,
    fetchFeatured: getFeaturedFootballTeams,
    fetchAll: getAllFootballTeams,
    eyebrow: (name: string) => `${name} באירופה`,
    titleAccent: "לכל המשחקים הגדולים",
    fallbackLede: "כרטיס, טיסה ומלון - חבילה אחת למשחק שלא שוכחים.",
    tilesHeading: "הליגות המבוקשות",
    requestedHeading: "המשחקים המבוקשים ביותר",
    dealsHeading: "החבילות המשתלמות ביותר" as string | null,
    allHeading: (name: string) => `כל חבילות ה${name}`,
    searchPlaceholder: "קבוצה, ליגה או עיר",
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
    tilesHeading: "איזה סגנון מוזיקה אתם מחפשים?",
    requestedHeading: "הופעות מבוקשות באתר",
    dealsHeading: null as string | null,
    allHeading: () => "כל ההופעות",
    searchPlaceholder: "אמן או עיר",
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

  // המשחקים המבוקשים ביותר: whichever list the backoffice curated wins
  // (בולטים picker first, then חבילות מומלצות) → "בולט" tag → soonest.
  const requested = (() => {
    const a = pickCurated(available, content.featured_event_ids, 12);
    if (a.length) return a;
    const b = pickCurated(available, content.recommended_event_ids, 12);
    if (b.length) return b;
    const tagged = available.filter((e) =>
      (tagsByEvent[e.id] ?? []).some((t) =>
        FEATURED_TAG_NAMES.has(normalizeTag(t.name)),
      ),
    );
    return (tagged.length ? tagged : available).slice(0, 12);
  })();

  // החבילות המשתלמות ביותר: the 8 cheapest bookable packages on the site -
  // pure math, no curation (creative 2026-08-20: "8 משחקים הזולים ביותר").
  const deals = cfg.dealsHeading
    ? available
        .map((e) => ({ e, p: computePackagePrice(e) }))
        .filter((x): x is { e: (typeof available)[number]; p: number } => x.p != null)
        .sort((a, b) => a.p - b.p)
        .slice(0, 8)
        .map((x) => x.e)
    : [];

  // Tiles - the node's child categories (minus the CMS people hub). A pure
  // hub child (the "ליגות"/"ז'אנרים" grouping node) is flattened to ITS
  // children, so the tiles show actual leagues/genres.
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

  // Music: genre tiles carry the circle-cluster collage (the genres picker
  // page is gone - its grid lives here now, right under the cover).
  const genreCollage =
    kind === "music" && children.length > 0
      ? await buildPickerCollage(children, "genres")
      : null;

  const faq = content.faq?.length ? content.faq : globalFaqItems;

  // The lede is the first paragraph of the marketing text; the REST moved to
  // the bottom of the page (creative: "להוריד לסוף העמוד - נדלן מבוזבז").
  const paragraphs = (content.seo_text ?? "").split("\n\n").filter(Boolean);
  const [lede, ...restParagraphs] = paragraphs;

  return (
    <main>
      {/* ---- Cover: content-sized, carries the lede. No counts, no buttons
           (creative 2026-08-20). ---- */}
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
          {/* ---- Tiles: league slider (football) / genre clusters (music) -
               right under the cover (creative: "זה ממש מתחת להדר"). ---- */}
          {children.length > 0 && (
            <section aria-label={cfg.tilesHeading}>
              <SectionHeading id="hub-tiles-heading">{cfg.tilesHeading}</SectionHeading>
              {kind === "music" ? (
                <GenreTiles
                  items={children.map((child) => ({
                    id: child.id,
                    name: child.name,
                    href: `/c/${slugPathOf(child, all).join("/")}`,
                    picks: genreCollage?.collage[child.id] ?? [],
                    count: genreCollage?.eventCounts[child.id] ?? 0,
                  }))}
                />
              ) : (
                <HubTilesRow
                  ariaLabel={cfg.tilesHeading}
                  items={children.map((child) => ({
                    id: child.id,
                    name: child.name,
                    href: `/c/${slugPathOf(child, all).join("/")}`,
                    imageUrl: child.image_url,
                  }))}
                />
              )}
            </section>
          )}

          {/* ---- המשחקים המבוקשים ביותר ---- */}
          {requested.length > 0 && (
            <section aria-labelledby="hub-requested-heading">
              <SectionHeading id="hub-requested-heading">
                {cfg.requestedHeading}
              </SectionHeading>
              <HubEventsCarousel events={requested} ariaLabel={cfg.requestedHeading} />
            </section>
          )}

          {/* ---- החבילות המשתלמות ביותר (football) ---- */}
          {cfg.dealsHeading && deals.length > 0 && (
            <section aria-labelledby="hub-deals-heading">
              <SectionHeading id="hub-deals-heading">{cfg.dealsHeading}</SectionHeading>
              <HubEventsCarousel events={deals} ariaLabel={cfg.dealsHeading} />
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
                searchPlaceholder={cfg.searchPlaceholder}
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

          {/* ---- Marketing/SEO text - bottom of the page (creative:
               "להוריד לסוף העמוד"). ---- */}
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

          {/* ---- לקוחות משתפים - moved to the page bottom (Dor 20.8); the
               widget draws its own title, so no SectionHeading either
               (creative: "להוריד יש פעמיים"). ---- */}
          <section aria-label="לקוחות משתפים">
            <HubReviews />
          </section>
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
