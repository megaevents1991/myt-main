import { getArtistBySlug } from "@/lib/artists";
import { getEventArt } from "@/lib/eventArt";
import { personOgImage, OG_SIZE } from "@/lib/og";

// Branded link-preview card (WhatsApp/social) — new card-art design.
// File-based OG beats the generateMetadata heroBanner image.
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "MegaEvents — חבילות לאירועים";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  const hero = artist?.fields.heroBanner?.fields?.file?.url;
  return personOgImage({
    name: String(artist?.fields.name ?? "MegaEvents"),
    nameEnglish: artist?.fields.nameDBenglish
      ? String(artist.fields.nameDBenglish)
      : undefined,
    cutoutUrl: artist?.fields.artImageUrl ?? null,
    photoUrl: hero ? `https:${hero}` : null,
    colorIndex:
      artist?.fields.artColorIndex ?? getEventArt(slug).colorIndex,
    shapeIndex:
      artist?.fields.artShapeIndex ?? getEventArt(slug).shapeIndex,
  });
}
