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
}: CatalogPageTemplateProps) => (
  <div className="container mx-auto px-4 py-8">
    <header>
      <h1 className="mb-8 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
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
      <section
        className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
        aria-label={gridLabel}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={`${hrefBase}/${item.id}`}
            aria-label={`${cardLabelPrefix} ${item.name}`}
            className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
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
          </Link>
        ))}
      </section>
    )}
  </div>
);
