import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
import { notFound } from "next/navigation";
import Image from "next/image";

export async function generateStaticParams() {
  const { items } = await contentfulClient.getEntries({
    content_type: "artistTemplate",
  });

  return items.map((item) => ({
    slug: item.fields.slug,
  }));
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await contentfulClient.getEntry<ArtistFields>(slug);

  if (!artist) {
    notFound();
  }

  const { name, bio, heroBanner } = artist.fields;

  return (
    <div className="container mx-auto py-8 px-4">
      {heroBanner?.fields?.file?.url && (
        <Image
          src={`https:${heroBanner.fields.file.url}`}
          alt={name || ""}
          width={heroBanner.fields.file.details?.image?.width || 1024}
          height={heroBanner.fields.file.details?.image?.height || 384}
          className="w-full h-96 object-cover rounded-lg mb-8"
        />
      )}
      <h1 className="text-4xl font-bold mb-4">{name}</h1>
      <div className="prose max-w-none">
        {bio.content[0].content[0].value || ""}
      </div>
    </div>
  );
}
