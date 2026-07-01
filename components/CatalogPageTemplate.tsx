import Link from "next/link";
import Image from "next/image";

import { EmptyState } from "@/components/ui/EmptyState";
import { EventArt } from "@/components/ui/EventArt";

export type CatalogItem = {
  id: string;
  name: string;
  imageUrl?: string;
  previewText?: string;
  artImageUrl?: string;
  artColorIndex?: number;
  artShapeIndex?: number;
  /** True = we have a currently-available event (On-Tour). False = Wishlist. */
  available: boolean;
};

type CatalogPageTemplateProps = {
  title: string;
  /** Detail-page base path, e.g. "/artists" or "/football". */
  hrefBase: string;
  items: CatalogItem[];
  /** aria-label for the grid + per-card label prefix. */
  gridLabel: string;
  cardLabelPrefix: string;
  imageAltPrefix: string;
  /** Set when the upstream fetch failed. */
  error?: boolean;
};

const CatalogCard = ({
  item,
  imageAltPrefix,
}: {
  item: CatalogItem;
  imageAltPrefix: string;
}) => (
  <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow group-hover:shadow-card-hover">
    {item.artImageUrl ? (
      <EventArt
        id={item.id}
        imageUrl={item.artImageUrl}
        alt={`${imageAltPrefix} ${item.name}`}
        colorIndex={item.artColorIndex}
        shapeIndex={item.artShapeIndex}
        className="aspect-square"
      />
    ) : item.imageUrl ? (
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={item.imageUrl}
          alt={`${imageAltPrefix} ${item.name}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    ) : null}
    <div className="p-3 text-start">
      <h2 className="font-display text-base font-bold text-foreground sm:text-lg">
        {item.name}
      </h2>
      {item.previewText && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.previewText}
        </p>
      )}
    </div>
  </article>
);

const CatalogSection = ({
  heading,
  items,
  hrefBase,
  gridLabel,
  cardLabelPrefix,
  imageAltPrefix,
  dimmed,
}: {
  heading: string;
  items: CatalogItem[];
  hrefBase: string;
  gridLabel: string;
  cardLabelPrefix: string;
  imageAltPrefix: string;
  dimmed: boolean;
}) => {
  if (items.length === 0) return null;
  return (
    <section className="mb-12 last:mb-0" aria-label={`${gridLabel} — ${heading}`}>
      <div className="mb-4 flex flex-row items-stretch justify-start lg:mb-6">
        <div
          aria-hidden
          className={`mx-1 ${dimmed ? "bg-secondary/40" : "bg-secondary"}`}
          style={{ height: 40, width: 23 }}
        />
        <div
          aria-hidden
          className={`mx-1 hidden sm:block ${dimmed ? "bg-secondary/40" : "bg-secondary"}`}
          style={{ height: 40, width: 23 }}
        />
        <div
          aria-hidden
          className={`mx-1 hidden sm:block ${dimmed ? "bg-secondary/40" : "bg-secondary"}`}
          style={{ height: 40, width: 46 }}
        />
        <div>
          <h2 className="mx-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {heading}
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {dimmed
          ? items.map((item) => (
              <div
                key={item.id}
                aria-disabled="true"
                className="pointer-events-none opacity-60 grayscale"
              >
                <CatalogCard item={item} imageAltPrefix={imageAltPrefix} />
              </div>
            ))
          : items.map((item) => (
              <Link
                key={item.id}
                href={`${hrefBase}/${item.id}`}
                aria-label={`${cardLabelPrefix} ${item.name}`}
                className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <CatalogCard item={item} imageAltPrefix={imageAltPrefix} />
              </Link>
            ))}
      </div>
    </section>
  );
};

/**
 * Shared layout for the artist / football catalog pages — collapses what were
 * two copy-pasted page files. Pages fetch + normalise their items and hand
 * them here.
 */
export const CatalogPageTemplate = ({
  title,
  hrefBase,
  items,
  gridLabel,
  cardLabelPrefix,
  imageAltPrefix,
  error = false,
}: CatalogPageTemplateProps) => {
  const onTour = items.filter((i) => i.available);
  const offTour = items.filter((i) => !i.available);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
      </header>

      {error ? (
        <EmptyState
          title="שגיאה בטעינת הנתונים"
          description="לא הצלחנו לטעון את הרשימה כרגע. נסו לרענן את העמוד."
        />
      ) : items.length === 0 ? (
        <EmptyState title="אין תוצאות להצגה" />
      ) : (
        <>
          <CatalogSection
            heading="זמין באתר"
            items={onTour}
            hrefBase={hrefBase}
            gridLabel={gridLabel}
            cardLabelPrefix={cardLabelPrefix}
            imageAltPrefix={imageAltPrefix}
            dimmed={false}
          />
          <CatalogSection
            heading="Wishlist"
            items={offTour}
            hrefBase={hrefBase}
            gridLabel={gridLabel}
            cardLabelPrefix={cardLabelPrefix}
            imageAltPrefix={imageAltPrefix}
            dimmed
          />
        </>
      )}
    </div>
  );
};
