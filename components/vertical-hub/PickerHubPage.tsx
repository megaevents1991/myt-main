import Image from "next/image";
import Link from "next/link";

import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { isEventSoldOut } from "@/lib/events/price";

import { HubCover } from "@/components/vertical-hub/HubCover";
import { HeaderTitle } from "@/components/HeaderTitle";
import ClientTracker from "@/components/ClientTracker";
import { TrustSection } from "@/components/TrustSection";

/**
 * Picker hubs - עמוד הליגות ועמוד הז'אנרים (redesign spec items: "טקסט על
 * הבאנר הראשי" + a line above the tiles). One job: choose your league/genre,
 * so it is a floodlit cover + the tile grid, nothing else.
 */
const PICKERS = {
  leagues: {
    motif: "pitch" as const,
    eyebrow: "הכדורגל שלנו",
    lede: "מהפרמייר ליג ועד ליגת האלופות - בחרו ליגה וכל המשחקים, הקבוצות והחבילות שלה לפניכם.",
    introLine: "בחרו את הליגה האהובה עליכם",
    statLabel: "ליגות",
    backHref: "/c/football",
    backLabel: "לעמוד הכדורגל",
  },
  genres: {
    motif: "stage" as const,
    eyebrow: "המוזיקה שלנו",
    lede: "פופ, רוק, היפ הופ או קלאסי - בחרו סגנון וכל ההופעות והאמנים שלו לפניכם.",
    introLine: "איזה סגנון מוזיקה אתם מחפשים?",
    statLabel: "ז'אנרים",
    backHref: "/c/music",
    backLabel: "לעמוד המוזיקה",
  },
} as const;

export type PickerKind = keyof typeof PICKERS;

export async function PickerHubPage({
  category,
  all,
  kind,
}: {
  category: EventCategory;
  all: EventCategory[];
  kind: PickerKind;
}) {
  const cfg = PICKERS[kind];
  const children = all
    .filter((c) => c.parent_id === category.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  // Bookable packages across the whole subtree - the cover's honest number.
  const { events } = await getEventsInCategory(category.slug, {
    includeDescendants: true,
  });
  const available = events.filter((e) => !isEventSoldOut(e));

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <HubCover
        motif={cfg.motif}
        eyebrow={cfg.eyebrow}
        title={category.name}
        lede={<p>{category.subtitle ?? cfg.lede}</p>}
        stats={[
          { value: String(children.length), label: cfg.statLabel },
          { value: String(available.length), label: "חבילות זמינות" },
        ]}
        primaryCta={{ href: "#picker-grid", label: cfg.introLine }}
        secondaryCta={{ href: cfg.backHref, label: cfg.backLabel }}
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto">
          <p
            className="mb-6 scroll-mt-24 text-center font-display text-xl font-bold text-foreground sm:text-2xl"
            id="picker-grid"
          >
            {cfg.introLine}
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" role="list">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/c/${slugPathOf(child, all).join("/")}`}
                role="listitem"
                className="group relative block h-36 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:h-44"
              >
                {child.image_url ? (
                  <>
                    <Image
                      src={child.image_url}
                      alt={child.name}
                      fill
                      sizes="(max-width: 640px) 45vw, 400px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                      {child.name}
                    </h3>
                  </>
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        "radial-gradient(80% 90% at 50% -20%, hsl(150 60% 62% / 0.22), hsl(var(--surface-inverse)))",
                    }}
                  >
                    <h3 className="px-3 text-center font-display text-xl font-extrabold text-main-foreground transition-colors group-hover:text-secondary">
                      {child.name}
                    </h3>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <TrustSection />
    </>
  );
}
