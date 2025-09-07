import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";
import CacheValidator from "../../components/CacheValidator";

export const revalidate = 3600;

export default async function ArtistsPage() {
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  try {
    const { items } = await contentfulClient.getEntries<ArtistFields>({
      content_type: "artistTemplate",
    });

    return (
      <div className="container mx-auto py-8 px-4">
        <CacheValidator pageId="artists-list" />
        {/* Add invisible element with timestamp for client checking */}
        <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
        <h1 className="text-4xl font-bold text-right mb-8">האומנים שלנו</h1>
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="main"
          aria-label="רשימת האומנים"
        >
          {items.map((artist) => (
            <Link
              href={`/artists/${artist.sys?.id}`}
              key={artist.sys.id}
              className="block hover:opacity-90 transition-opacity"
              aria-label={`עמוד האומן ${artist.fields.name || "לא ידוע"}`}
            >
              <article className="border rounded-lg overflow-hidden">
                {artist.fields.heroBanner?.fields && (
                  <Image
                    src={"https:" + artist.fields.heroBanner?.fields?.file?.url}
                    alt={`תמונה של האומן ${String(artist.fields.name)}`}
                    priority={true}
                    width={400}
                    height={300}
                    style={{
                      objectPosition: 'center top' // or 'center center', '20% 30%', etc.
                    }}
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
              </article>
            </Link>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error fetching artists:', error);
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold text-right mb-8">האומנים שלנו</h1>
        <p className="text-center text-gray-500" role="alert" aria-live="polite">שגיאה בטעינת הנתונים</p>
      </div>
    );
  }
}