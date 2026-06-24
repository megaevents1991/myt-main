import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { TrustBadges } from "@/components/ui/TrustBadges";
import { Aurora } from "@/components/ui/Aurora";
import { MYT } from "@/components/ui/myt";
import { TicketOnlyBadge } from "@/components/TicketOnlyBadge";

/**
 * Split detail-hero for artist / football pages — dark surface, cutout image
 * on a mint blob, bold bilingual heading, bio, trust row, mint CTA.
 */
export const DetailHero = ({
  name,
  nameEnglish,
  bio,
  imageUrl,
  imageAlt,
  ctaHref = "#upcoming-events",
  ctaLabel = "לפרטים והזמנה",
  ticketOnly = false,
}: {
  name: string;
  nameEnglish?: string;
  bio: ReactNode;
  imageUrl?: string;
  imageAlt: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Show the ticket-only marker (when this entity's events are ticket-only). */
  ticketOnly?: boolean;
}) => (
  <section id="detail-hero" className="relative overflow-hidden bg-main text-main-foreground">
    <Aurora intensity={0.4} />
    {ticketOnly && (
      <TicketOnlyBadge className="absolute left-4 top-5 z-20 md:left-6" />
    )}
    {/* Way home — the global header only appears after scroll, so the hero
        carries its own wordmark link. */}
    <div className="container relative z-10 mx-auto px-4 pt-5">
      <Link href="/" aria-label="חזרה לדף הבית" className="inline-block">
        <MYT className="h-5 w-auto text-main-foreground md:h-6" />
      </Link>
    </div>
    <div className="container relative z-10 mx-auto grid items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
      {imageUrl && (
        <div className="relative mx-auto w-full max-w-xs md:max-w-sm">
          <div className="absolute inset-0 -rotate-6 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-primary shadow-[0_0_60px_-10px_hsl(var(--brand-mint)/0.6)]" />
          <div className="relative aspect-square overflow-hidden rounded-[40%_60%_55%_45%/55%_45%_60%_40%]">
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              priority
              sizes="(max-width: 768px) 90vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
          {name}
          {nameEnglish && (
            <span className="hidden text-main-foreground/70 md:block">{nameEnglish}</span>
          )}
        </h1>
        <div className="text-base leading-relaxed text-main-foreground/85">
          {bio}
        </div>
        <TrustBadges className="text-main-foreground/75" />
      </div>
    </div>
  </section>
);
