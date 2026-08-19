import { MapPin, Trophy, Info } from "lucide-react";

import { normalizeName } from "@/lib/eventNameMatch";
import type { CategoryPageContent } from "@/lib/taxonomy.types";
import { StadiumCards } from "@/components/vertical-hub/StadiumCards";
import { SectionHeading } from "@/components/vertical-hub/SectionHeading";
import { TEAM_EXTRAS } from "@/components/vertical-hub/teamExtras";

/**
 * "עמוד קבוצה - אלמנטים חסרים מהרידיזיין": stadium card, city info, matchday
 * tips and honours chips, rendered between the events list and the videos on
 * TeamCmsPage. Content-keyed by the team's English DB name - a team with no
 * TEAM_EXTRAS entry renders nothing (those are listed in MISSING-CONTENT.md).
 */
export const TeamExtrasSection = ({
  nameDBenglish,
  override,
}: {
  nameDBenglish?: string;
  /** The team CATEGORY's page_content - backoffice edits win over TEAM_EXTRAS. */
  override?: CategoryPageContent | null;
}) => {
  const extras = TEAM_EXTRAS[normalizeName(String(nameDBenglish ?? ""))];
  const stadium = override?.stadiums?.[0] ?? extras?.stadium;
  const city = override?.city_info ?? extras?.city;
  const matchday = override?.matchday ?? extras?.matchday;
  const honours = override?.honours ?? extras?.honours;
  if (!stadium && !city && !matchday?.length && !honours?.length) return null;

  return (
    <section
      className="container mx-auto px-4 py-12"
      aria-labelledby="team-extras-heading"
      dir="rtl"
    >
      <SectionHeading id="team-extras-heading">המשחק, העיר והאצטדיון</SectionHeading>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stadium - reuses the hub's stadium card design. */}
        {stadium && (
          <div className="lg:row-span-2">
            <StadiumCards stadiums={[stadium]} />
          </div>
        )}

        {/* City info */}
        {city && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <MapPin className="size-5 text-primary" aria-hidden />
              {city.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{city.text}</p>
          </div>
        )}

        {/* Matchday tips */}
        {(matchday?.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Info className="size-5 text-primary" aria-hidden />
              טיפים ליום המשחק
            </h3>
            <div className="space-y-3">
              {matchday?.map((tip) => (
                <div key={tip.title}>
                  <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{tip.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Honours chips */}
      {(honours?.length ?? 0) > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="הישגי הקבוצה">
          {honours?.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-1.5 rounded-full bg-main px-4 py-1.5 text-sm font-bold text-main-foreground"
            >
              <Trophy className="size-4 text-secondary" aria-hidden />
              {h}
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
