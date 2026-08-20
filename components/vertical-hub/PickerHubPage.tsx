import type { EventCategory } from "@/lib/taxonomy.types";
import { slugPathOf } from "@/lib/taxonomy-tree";

import { HubCover } from "@/components/vertical-hub/HubCover";
import { HeaderTitle } from "@/components/HeaderTitle";
import ClientTracker from "@/components/ClientTracker";
import { TrustSection } from "@/components/TrustSection";
import { DestinationTiles } from "@/components/vertical-hub/DestinationTiles";
import { buildPickerCollage } from "@/components/vertical-hub/pickerCollage";

/**
 * The יעדים picker (/c/destinations) - the only picker page left. The leagues
 * and genres pickers were removed by the creative review (2026-08-20): their
 * grids live on /c/football and /c/music now, and the old URLs 301 there.
 *
 * Tiles: rotating skyline photos (backoffice tile_images) with the city's
 * artists/teams crossfading in small circles on top, plus a free-text filter
 * beside the title.
 */
export async function PickerHubPage({
  category,
  all,
}: {
  category: EventCategory;
  all: EventCategory[];
}) {
  const children = all
    .filter((c) => c.parent_id === category.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  // Rotation pool per city: up to 9 people so the three circles cycle
  // through different faces instead of freezing on a trio.
  const { collage, eventCounts } = await buildPickerCollage(
    children,
    "destinations",
    9,
  );

  return (
    <>
      <ClientTracker />
      <HeaderTitle name={category.name} />
      <HubCover
        motif="stage"
        eyebrow="טסים לאירוע"
        title={category.name}
        lede={
          <p>
            {category.subtitle ??
              "בוחרים עיר - ורואים את כל המשחקים וההופעות שמחכים בה. כרטיס, טיסה ומלון בחבילה אחת."}
          </p>
        }
      />

      <div className="w-full bg-background px-4 py-10 md:px-6 lg:py-14" dir="rtl">
        <div className="container mx-auto">
          <DestinationTiles
            title="לאן בא לכם?"
            items={children.map((child) => ({
              id: child.id,
              name: child.name,
              nameEnglish: child.name_english ?? child.slug,
              href: `/c/${slugPathOf(child, all).join("/")}`,
              images: (child.page_content?.tile_images ?? []).filter(Boolean),
              imageUrl: child.image_url,
              picks: collage[child.id] ?? [],
              count: eventCounts[child.id] ?? 0,
            }))}
          />
        </div>
      </div>

      <TrustSection />
    </>
  );
}
