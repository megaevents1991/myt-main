import Link from "next/link";
import Image from "next/image";

import { Artist } from "@/lib/app.types";
import { cn } from "@/lib/utils";

// Bright blob backgrounds cycled across the tilted cards.
const blobColors = [
  "bg-[#5BC8E8]",
  "bg-[#F0902F]",
  "bg-badge-soldout",
  "bg-primary",
  "bg-badge-vip",
  "bg-badge-new",
];

// Slight alternating tilt so the row feels playful, per the Figma hero.
const tilts = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3", "-rotate-1", "rotate-1"];

/**
 * Hero gallery — a scrollable row of tilted, colorful cutout cards shown
 * under the homepage hero headline. Decorative + navigational: each card
 * links to its artist page.
 */
export const HeroCarousel = ({ artists }: { artists: Artist[] }) => {
  const items = artists.filter((a) => a.fields.heroBanner?.fields?.file?.url);
  if (items.length === 0) return null;

  return (
    <div
      className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] sm:gap-4 sm:px-8"
      role="list"
      aria-label="אירועים מובילים"
    >
      {items.map((artist, i) => {
        const url = "https:" + artist.fields.heroBanner!.fields!.file!.url;
        const name = String(artist.fields.name ?? "");
        return (
          <Link
            key={artist.sys.id}
            href={`/artists/${artist.sys.id}`}
            role="listitem"
            aria-label={`עמוד האומן ${name}`}
            className={cn(
              "group relative block shrink-0 transition-transform duration-300 hover:rotate-0 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-main",
              tilts[i % tilts.length]
            )}
          >
            <div
              className={cn(
                "relative h-64 w-44 overflow-hidden rounded-3xl sm:h-80 sm:w-56",
                blobColors[i % blobColors.length]
              )}
            >
              <Image
                src={url}
                alt={name}
                fill
                sizes="(max-width: 640px) 11rem, 14rem"
                className="object-cover object-bottom"
              />
            </div>
            <span className="absolute inset-x-2 bottom-2 truncate rounded-xl bg-main/70 px-3 py-1.5 text-center text-sm font-bold text-main-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {name}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
