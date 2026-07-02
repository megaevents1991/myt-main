import Link from "next/link";
import Image from "next/image";

import { Badge } from "@/components/ui/Badge";
import { EventArt } from "@/components/ui/EventArt";

/**
 * Homepage category banner card (per Dor's mock) — e.g. "ליגת האלופות", "F1".
 * A wide banner image with the category name, a meta subtitle, an optional tag,
 * and a CTA into the category page that lists its packages.
 */
export const CategoryCard = ({
  slug,
  name,
  subtitle,
  tag,
  imageUrl,
  linkUrl,
  artImageUrl,
  artColorIndex,
  artShapeIndex,
  artImageScale,
  artBgScale,
}: {
  slug: string;
  name: string;
  subtitle?: string;
  tag?: string;
  imageUrl?: string;
  /** Optional override; when set the card links here instead of /category/[slug]. */
  linkUrl?: string;
  artImageUrl?: string;
  artColorIndex?: number;
  artShapeIndex?: number;
  artImageScale?: number;
  artBgScale?: number;
}) => (
  <Link
    href={linkUrl || `/category/${slug}`}
    aria-label={`${name} — לצפייה בחבילות`}
    className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
    dir="rtl"
  >
    <div className="relative h-40 sm:h-44">
      {artImageUrl ? (
        <EventArt
          id={slug}
          imageUrl={artImageUrl}
          alt={name}
          colorIndex={artColorIndex}
          shapeIndex={artShapeIndex}
          imageScale={artImageScale}
          bgScale={artBgScale}
          className="h-full w-full"
        />
      ) : imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 90vw, 480px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-main" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
    </div>

    <div className="p-4 text-right">
      <h3 className="text-xl font-extrabold leading-tight text-foreground">
        {name}
      </h3>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        {tag ? <Badge variant="urgent">{tag}</Badge> : <span />}
        <span className="rounded-full bg-main px-5 py-2.5 text-sm font-bold text-main-foreground transition-colors group-hover:bg-main/90">
          לצפייה בחבילות
        </span>
      </div>
    </div>
  </Link>
);
