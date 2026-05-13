import type { Metadata } from "next";
import { contentfulClient } from "@/lib/contentful";
import { ArtistFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "האומנים שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/artists",
  },
  robots: { index: false, follow: false },
};

export default async function ArtistsPage() {
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  try {
    const { items } = await contentfulClient.getEntries<ArtistFields>({
      content_type: "artistTemplate",
    });

    return (
      <main className="container mx-auto py-8 px-4">
        {/* Add invisible element with timestamp for client checking */}
        <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">האומנים שלנו</h1>
        </header>
        <section 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="main"
          aria-label="רשימת האומנים"
        >
          {items.map((artist) => (
            <Link
              href={`/artists/${artist.sys?.id}`}
              key={artist.sys.id}
              className="block hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
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
                      objectPosition: 'center top'
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
        </section>
      </main>
    );
  } catch (error) {
    console.error('Error fetching artists:', error);
    return (
      <main className="container mx-auto py-8 px-4">
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">האומנים שלנו</h1>
        </header>
        <p className="text-center text-gray-500" role="alert" aria-live="polite">שגיאה בטעינת הנתונים</p>
      </main>
    );
  }
}