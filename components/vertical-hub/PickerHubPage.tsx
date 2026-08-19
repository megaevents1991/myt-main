import Image from "next/image";
import Link from "next/link";

import type { Artist, FootballTeam } from "@/lib/app.types";
import type { EventCategory } from "@/lib/taxonomy.types";
import { getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { getAllFootballTeams } from "@/lib/football";
import { getAllArtists } from "@/lib/artists";
import { clubNamesMatchAnyScript } from "@/lib/eventNameMatch";
import { slugPathOf } from "@/lib/taxonomy-tree";
import { isEventSoldOut } from "@/lib/events/price";
import { EVENT_ART_BLOB_SHAPES, EVENT_ART_COLORS } from "@/lib/eventArt";

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
  destinations: {
    motif: "stage" as const,
    eyebrow: "טסים לאירוע",
    lede: "בוחרים עיר - ורואים את כל המשחקים וההופעות שמחכים בה. כרטיס, טיסה ומלון בחבילה אחת.",
    introLine: "לאן בא לכם?",
    statLabel: "יעדים",
    backHref: "/",
    backLabel: "לעמוד הבית",
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

  // Destinations + genres: up to 3 cut-out blobs per tile - the people
  // catalogued to that city/genre (redesign spec; genres joined 2026-08-19,
  // artists only - crests don't belong on a music tile).
  const collage: Record<number, string[]> = {};
  if (kind === "destinations" || kind === "genres") {
    const [teams, artists] = await Promise.all([
      kind === "destinations"
        ? getAllFootballTeams().catch(() => [] as FootballTeam[])
        : Promise.resolve([] as FootballTeam[]),
      getAllArtists().catch(() => [] as Artist[]),
    ]);
    const people = [...artists, ...teams].filter((p) => p.fields.artImageUrl);
    await Promise.all(
      children.map(async (child) => {
        const { events: childEvents } = await getEventsInCategory(child.slug);
        const tagsBy = await getTagsForEvents(childEvents.slice(0, 40).map((e) => e.id));
        const names = new Set<string>();
        Object.values(tagsBy).forEach((chips) =>
          chips.forEach((c) => {
            if (c.type === "artist" || (kind === "destinations" && c.type === "team"))
              names.add(c.name);
          }),
        );
        const arts: string[] = [];
        for (const p of people) {
          if (arts.length >= 3) break;
          const en = String(p.fields.nameDBenglish ?? "");
          const he = String(p.fields.name ?? "");
          if (
            [...names].some(
              (t) => clubNamesMatchAnyScript(t, en) || clubNamesMatchAnyScript(t, he),
            )
          )
            arts.push(String(p.fields.artImageUrl));
        }
        collage[child.id] = arts;
      }),
    );
  }

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
            {children.map((child, idx) => {
              // Brand blob per tile - color/shape spread by position (steps 1
              // and 5, coprime with the pool sizes) so neighbours never match.
              const blobShape =
                EVENT_ART_BLOB_SHAPES[(idx * 5 + 1) % EVENT_ART_BLOB_SHAPES.length];
              const blobColor = EVENT_ART_COLORS[idx % EVENT_ART_COLORS.length];
              return (
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
                  <div className="relative flex h-full w-full flex-col items-center justify-end overflow-hidden bg-[hsl(var(--surface-inverse))] pb-3">
                    {/* Brand blob ground - same pool as the event cards. */}
                    <svg
                      className="absolute inset-0 h-full w-full opacity-80 transition-transform duration-300 group-hover:scale-105"
                      viewBox={`0 0 ${blobShape.w} ${blobShape.h}`}
                      preserveAspectRatio="xMidYMid slice"
                      aria-hidden="true"
                    >
                      <path
                        d={blobShape.d}
                        fill={`hsl(${blobColor})`}
                        transform={
                          blobShape.mirror
                            ? `translate(${blobShape.w},0) scale(-1,1)`
                            : undefined
                        }
                      />
                    </svg>
                    {/* Legibility ground under the name, over the blob. */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
                    {(collage[child.id]?.length ?? 0) > 0 && (
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-2 flex items-end justify-center"
                      >
                        {collage[child.id].map((src, i) => (
                          <Image
                            key={src}
                            src={src}
                            alt=""
                            width={96}
                            height={96}
                            className={`h-20 w-20 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.55)] sm:h-24 sm:w-24 ${
                              i === 1 ? "z-10 -mx-4 scale-110" : "opacity-90"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <h3 className="relative z-10 px-3 text-center font-display text-xl font-extrabold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.8)] transition-colors group-hover:text-secondary">
                      {child.name}
                    </h3>
                  </div>
                )}
              </Link>
              );
            })}
          </div>
        </div>
      </div>

      <TrustSection />
    </>
  );
}
