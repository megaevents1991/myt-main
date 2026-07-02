import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { TrustBadges } from "@/components/ui/TrustBadges";
import { Aurora } from "@/components/ui/Aurora";
import { MYT } from "@/components/ui/myt";
import { EventArt } from "@/components/ui/EventArt";
import { TicketOnlyBadge } from "@/components/TicketOnlyBadge";
import { BioReadMore } from "@/components/BioReadMore";
import { youtubeId, youtubeEmbed } from "@/lib/youtube";

/**
 * Split detail-hero for artist / football pages — dark surface, cutout image
 * (or a looping YouTube clip) on a mint blob, bold bilingual heading, bio,
 * trust row.
 */
export const DetailHero = ({
  name,
  nameEnglish,
  bio,
  bioFirstSentence,
  bioCanExpand = false,
  imageUrl,
  imageAlt,
  heroVideoUrl,
  artId,
  artImageUrl,
  artColorIndex,
  artShapeIndex,
  ctaHref = "#upcoming-events",
  ctaLabel = "לפרטים והזמנה",
  ticketOnly = false,
}: {
  name: string;
  nameEnglish?: string;
  bio: ReactNode;
  /** Plain-text first sentence — when set, the bio collapses to it on mobile
   *  with a "קרא עוד.." toggle (full bio always shown on desktop). */
  bioFirstSentence?: string;
  /** Whether the bio has more than the first sentence to reveal. */
  bioCanExpand?: boolean;
  imageUrl?: string;
  imageAlt: string;
  /** #19b: YouTube URL that loops inside the hero circle (overrides the image). */
  heroVideoUrl?: string;
  /** Homepage-card art (backoffice art_* fields) — when set, the hero circle
   *  shows the exact same EventArt as the catalog card: same colored blob,
   *  same shape, same cut-out. Hero layout/design unchanged. */
  artId?: string;
  artImageUrl?: string;
  artColorIndex?: number;
  artShapeIndex?: number;
  ctaHref?: string;
  ctaLabel?: string;
  /** Show the ticket-only marker (when this entity's events are ticket-only). */
  ticketOnly?: boolean;
}) => {
  const videoId = youtubeId(heroVideoUrl);
  return (
  <section id="detail-hero" className="relative overflow-hidden bg-main text-main-foreground">
    <Aurora intensity={0.4} />
    {ticketOnly && (
      <TicketOnlyBadge className="absolute right-4 top-5 z-20 md:right-6" />
    )}
    {/* Way home — the global header only appears after scroll, so the hero
        carries its own wordmark link. Sits at the RTL end (far left) to match
        the global header logo. */}
    <div className="container relative z-10 mx-auto flex justify-end px-4 pt-5">
      <Link href="/" aria-label="חזרה לדף הבית" className="inline-block">
        <MYT className="h-5 w-auto text-main-foreground md:h-6" />
      </Link>
    </div>
    <div className="container relative z-10 mx-auto grid items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
      {(artImageUrl || imageUrl || videoId) && (
        <div className="relative mx-auto w-full max-w-xs md:max-w-sm">
          <div className="absolute inset-0 -rotate-6 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-primary shadow-[0_0_60px_-10px_hsl(var(--brand-mint)/0.6)]" />
          <div className="relative aspect-square overflow-hidden rounded-[40%_60%_55%_45%/55%_45%_60%_40%]">
            {videoId ? (
              // 16:9 clip scaled to cover the square circle.
              <iframe
                src={youtubeEmbed(videoId, { autoplay: true, mute: true, loop: true })}
                title={imageAlt}
                allow="autoplay; encrypted-media; picture-in-picture"
                className="pointer-events-none absolute left-1/2 top-1/2 h-full w-[177.78%] -translate-x-1/2 -translate-y-1/2"
                aria-hidden
              />
            ) : artImageUrl ? (
              // Same art as the homepage card — colored blob + shape from the
              // backoffice art_* fields — clipped by the hero's existing mask.
              <EventArt
                id={artId ?? name}
                imageUrl={artImageUrl}
                alt={imageAlt}
                colorIndex={artColorIndex}
                shapeIndex={artShapeIndex}
                priority
                hoverZoom={false}
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <Image
                src={imageUrl as string}
                alt={imageAlt}
                fill
                priority
                sizes="(max-width: 768px) 90vw, 40vw"
                className="object-cover"
              />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <h1 className="order-1 font-display text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
          {name}
          {nameEnglish && (
            <span className="hidden text-main-foreground/70 md:block">{nameEnglish}</span>
          )}
        </h1>
        {/* Trust row sits right under the name on mobile; below the bio on
            desktop (order swap). */}
        <TrustBadges className="order-2 text-main-foreground/75 sm:order-3" />
        {bioFirstSentence ? (
          <BioReadMore
            className="order-3 text-base leading-relaxed text-main-foreground/85 sm:order-2"
            firstSentence={bioFirstSentence}
            canExpand={bioCanExpand}
            full={bio}
          />
        ) : (
          <div className="order-3 text-base leading-relaxed text-main-foreground/85 sm:order-2">
            {bio}
          </div>
        )}
      </div>
    </div>
  </section>
  );
};
