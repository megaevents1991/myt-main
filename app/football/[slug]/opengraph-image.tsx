import { getFootballTeamBySlug } from "@/lib/football";
import { getEventArt } from "@/lib/eventArt";
import { personOgImage, OG_SIZE } from "@/lib/og";

// Branded link-preview card (WhatsApp/social) — new card-art design.
// File-based OG beats the generateMetadata heroBanner image.
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MegaEvents — חבילות למשחקים";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getFootballTeamBySlug(slug);
  const hero = team?.fields.heroBanner?.fields?.file?.url;
  return personOgImage({
    name: String(team?.fields.name ?? "MegaEvents"),
    nameEnglish: team?.fields.nameDBenglish
      ? String(team.fields.nameDBenglish)
      : undefined,
    cutoutUrl: team?.fields.artImageUrl ?? null,
    photoUrl: hero ? `https:${hero}` : null,
    colorIndex: team?.fields.artColorIndex ?? getEventArt(slug).colorIndex,
    shapeIndex: team?.fields.artShapeIndex ?? getEventArt(slug).shapeIndex,
    imageScale: team?.fields.artImageScale,
  });
}
