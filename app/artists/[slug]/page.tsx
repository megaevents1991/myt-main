import { getArtistBySlug, getArtistSlugs } from "@/lib/artists";
import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArtistCmsPage } from "@/components/ArtistCmsPage";
import { personCategoryHref } from "@/lib/cmsTwin";

export const revalidate = 3600;
export const dynamicParams = true; // Allow rendering pages for new artists on-demand

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const artist = await getArtistBySlug(slug);
    if (!artist?.fields?.name) {
      return { title: "Artist Not Found - MYT" };
    }

    const { name, previewText, seoTitle, metaDescription, metaTags } = artist.fields;
    const title = String(seoTitle || "") || `${name} - כרטיסים וחבילות | MYT`;
    const description = String(metaDescription || previewText || "") || `הזמינו כרטיסים וחבילות טיסה + מלון לאירועים של ${name}`;
    const keywords = metaTags || `${name}, כרטיסים, אירועים, MYT`;

    return {
      title,
      description,
      keywords,
      alternates: {
        canonical: `https://www.mega-events.co.il/artists/${slug}`,
      },
      // og:image intentionally NOT set here - the branded card from
      // opengraph-image.tsx is the preview (explicit images would override it).
      openGraph: {
        title,
        description,
      },
    };
  } catch {
    return { title: "Artist Not Found - MYT" };
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await getArtistSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error('Error generating static params for artists:', error);
    return [];
  }
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  try {
    const artist = await getArtistBySlug(slug);

    if (!artist || !artist.fields) {
      notFound();
    }

    const { name, nameDBenglish } = artist.fields;
    if (!name || !nameDBenglish) {
      console.error('Artist missing required fields:', { slug, name, nameDBenglish });
      notFound();
    }

    // LEGACY-ROUTE: /c/ is canonical - 308 to the category twin when one
    // exists (docs/LEGACY-ROUTES-TODO.md). No twin → render here as before.
    const twinHref = await personCategoryHref("artists", artist);
    if (twinHref) permanentRedirect(twinHref);

    // Body shared with the taxonomy leaf /c/music/artists/<slug>.
    return <ArtistCmsPage artist={artist} />;
  } catch (error) {
    // permanentRedirect throws by design - never swallow it.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error('Error fetching artist:', error);
    notFound();
  }
}
