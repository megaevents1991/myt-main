import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";

export default async function ArtistsPage() {
  const { items } = await contentfulClient.getEntries<ArtistFields>({
    content_type: "artistTemplate",
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8">Our Artists</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((artist) => (
          <Link
            href={`/artists/${artist.sys?.id}`}
            key={artist.sys.id}
            className="block hover:opacity-90 transition-opacity"
          >
            <div className="border rounded-lg overflow-hidden">
              {artist.fields.heroBanner?.fields && (
                <Image
                  src={"https:" + artist.fields.heroBanner?.fields?.file?.url}
                  alt={String(artist.fields.name)}
                  width={400}
                  height={300}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-2 px-4 text-right" dir="rtl">
                <h2 className="text-xl font-bold mb-2">
                  {String(artist.fields.name)}
                </h2>
                <p className="text-gray-600 line-clamp-2">
                  {String(artist.fields?.previewText)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
