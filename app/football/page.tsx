import type { Metadata } from "next";
import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "הקבוצות שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/football",
  },
  robots: { index: false, follow: false },
};

export default async function FootballsPage() {
  // Add timestamp for cache validation
  const timestamp = Date.now();
  
  try {
    const { items } = await contentfulClient.getEntries<FootballFields>({
      content_type: "footballTeamTemplate",
    });

    return (
      <main className="container mx-auto py-8 px-4">
        {/* Add invisible element with timestamp for client checking */}
        <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">הקבוצות שלנו</h1>
        </header>
        <section 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="main"
          aria-label="רשימת קבוצות הכדורגל"
        >
          {items.map((team) => (
            <Link
              href={`/football/${team.sys?.id}`}
              key={team.sys.id}
              className="block hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
              aria-label={`עמוד קבוצת כדורגל ${team.fields.name || "לא ידוע"}`}
            >
              <article className="border rounded-lg overflow-hidden">
                {team.fields.heroBanner?.fields && (
                  <Image
                    src={"https:" + team.fields.heroBanner?.fields?.file?.url}
                    alt={`לוגו של קבוצת ${String(team.fields.name)}`}
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
                    {String(team.fields.name)}
                  </h2>
                  <p className="text-gray-600 line-clamp-2">
                    {String(team.fields?.previewText)}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </section>
      </main>
    );
  } catch (error) {
    console.error('Error fetching football teams:', error);
    return (
      <main className="container mx-auto py-8 px-4">
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">הקבוצות שלנו</h1>
        </header>
        <p className="text-center text-gray-500" role="alert" aria-live="polite">שגיאה בטעינת הנתונים</p>
      </main>
    );
  }
}
