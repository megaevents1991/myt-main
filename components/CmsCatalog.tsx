import { CatalogPageTemplate, type CatalogItem } from "@/components/CatalogPageTemplate";
import { DetailHero } from "@/components/DetailHero";
import { buildPersonHrefIndex } from "@/lib/cmsTwin";
import { getAllFootballTeams } from "@/lib/football";
import { getAllArtists } from "@/lib/artists";
import { getAvailabilityChecker } from "@/lib/tourStatus";

/**
 * The full people catalog (CMS cards with blob art + availability) for either
 * kind - ONE component behind /football, /artists AND the taxonomy hubs
 * /c/football/teams + /c/music/artists, so every URL shows the identical
 * experience with zero duplication.
 */
const KINDS = {
  teams: {
    fetch: getAllFootballTeams,
    hrefBase: "/football",
    gridLabel: "רשימת קבוצות הכדורגל",
    cardLabelPrefix: "עמוד קבוצת כדורגל",
    imageAltPrefix: "לוגו של קבוצת",
    ctaLabel: "לכל הקבוצות",
  },
  artists: {
    fetch: getAllArtists,
    hrefBase: "/artists",
    gridLabel: "רשימת האומנים",
    cardLabelPrefix: "עמוד האומן",
    imageAltPrefix: "תמונה של האומן",
    ctaLabel: "לכל האומנים",
  },
} as const;

export async function CmsCatalog({
  kind,
  title,
  heroImageUrl,
  heroSubtitle,
}: {
  kind: keyof typeof KINDS;
  title: string;
  /** Category card image/subtitle when rendered as a /c/ hub. */
  heroImageUrl?: string | null;
  heroSubtitle?: string | null;
}) {
  const cfg = KINDS[kind];
  const hero = (
    <DetailHero
      name={title}
      bio={heroSubtitle ? <p>{heroSubtitle}</p> : null}
      imageUrl={heroImageUrl ?? undefined}
      imageAlt={title}
      ctaHref="#catalog-grid"
      ctaLabel={cfg.ctaLabel}
    />
  );
  try {
    const items = await cfg.fetch();
    const isAvailable = await getAvailabilityChecker();
    // Canonical /c/ links; a person with no category twin falls back to the
    // LEGACY-ROUTE detail page (which itself 308s once a twin appears).
    const hrefIndex = await buildPersonHrefIndex(kind, items);

    const rows: CatalogItem[] = items.map((p) => ({
      id: p.sys.id,
      href: hrefIndex.get(p.sys.id),
      name: String(p.fields.name ?? ""),
      previewText: p.fields.previewText ? String(p.fields.previewText) : undefined,
      imageUrl: p.fields.heroBanner?.fields?.file?.url
        ? "https:" + p.fields.heroBanner.fields.file.url
        : undefined,
      artImageUrl: p.fields.artImageUrl,
      artColorIndex: p.fields.artColorIndex,
      artShapeIndex: p.fields.artShapeIndex,
      artImageScale: p.fields.artImageScale,
      artBgScale: p.fields.artBgScale,
      artImageOffsetX: p.fields.artImageOffsetX,
      artImageOffsetY: p.fields.artImageOffsetY,
      available: isAvailable(String(p.fields.nameDBenglish ?? "")),
    }));

    return (
      <>
        {hero}
        <CatalogPageTemplate
          title={title}
          hrefBase={cfg.hrefBase}
          items={rows}
          gridLabel={cfg.gridLabel}
          cardLabelPrefix={cfg.cardLabelPrefix}
          imageAltPrefix={cfg.imageAltPrefix}
          hideTitle
        />
      </>
    );
  } catch (error) {
    console.error(`Error fetching ${kind} catalog:`, error);
    return (
      <>
        {hero}
        <CatalogPageTemplate
          title={title}
          hrefBase={cfg.hrefBase}
          items={[]}
          gridLabel={cfg.gridLabel}
          cardLabelPrefix={cfg.cardLabelPrefix}
          imageAltPrefix={cfg.imageAltPrefix}
          error
          hideTitle
        />
      </>
    );
  }
}
