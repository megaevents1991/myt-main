import Image from "next/image";
import { Landmark, MapPin, Users } from "lucide-react";

import type { CategoryStadium } from "@/lib/taxonomy.types";

/**
 * "אצטדיונים מומלצים" - recommended-stadium cards on a vertical hub page.
 * Content comes from `categories.page_content.stadiums` (backoffice-managed).
 * Works with or without a photo: no photo → brand gradient with a stadium
 * glyph, so the section still looks intentional before images are uploaded.
 */
export const StadiumCards = ({ stadiums }: { stadiums: CategoryStadium[] }) => {
  if (!stadiums.length) return null;

  return (
    <div
      role="list"
      aria-label="אצטדיונים מומלצים"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {stadiums.map((s) => (
        <article
          key={s.name}
          role="listitem"
          className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
        >
          <div className="relative h-40 w-full overflow-hidden bg-main">
            {s.image_url ? (
              <Image
                src={s.image_url}
                alt={`אצטדיון ${s.name}`}
                fill
                sizes="(max-width: 640px) 90vw, 400px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(80%_120%_at_50%_0%,hsl(160_55%_28%/0.9),hsl(var(--main)))]">
                <Landmark
                  className="size-14 text-main-foreground/70"
                  aria-hidden
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <h3 className="absolute inset-x-4 bottom-3 font-display text-xl font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
              {s.name}
            </h3>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4 text-primary" aria-hidden />
                {s.city}
              </span>
              {s.capacity && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4 text-primary" aria-hidden />
                  {s.capacity}
                </span>
              )}
            </div>
            {s.teams && (
              <p className="text-sm font-semibold text-foreground">{s.teams}</p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {s.description}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
};
