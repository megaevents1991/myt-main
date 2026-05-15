import { ReactNode } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/ui/TrustBadges";

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
}: {
  name: string;
  nameEnglish?: string;
  bio: ReactNode;
  imageUrl?: string;
  imageAlt: string;
  ctaHref?: string;
  ctaLabel?: string;
}) => (
  <section className="bg-main text-main-foreground">
    <div className="container mx-auto grid items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
      {imageUrl && (
        <div className="relative mx-auto w-full max-w-sm md:max-w-md">
          <div className="absolute inset-0 -rotate-6 rounded-[40%_60%_55%_45%/55%_45%_60%_40%] bg-primary" />
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
            <span className="block text-main-foreground/70">{nameEnglish}</span>
          )}
        </h1>
        <div className="text-base leading-relaxed text-main-foreground/85">
          {bio}
        </div>
        <TrustBadges className="text-main-foreground/75" />
        <Button asChild size="lg" className="w-fit">
          <a href={ctaHref}>{ctaLabel}</a>
        </Button>
      </div>
    </div>
  </section>
);
