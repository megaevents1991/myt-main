import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";

export const revalidate = 3600;

export default async function FootballsPage() {
  try {
    const { items } = await contentfulClient.getEntries<FootballFields>({
      content_type: "footballTeamTemplate",
    });

    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold text-right mb-8">הקבוצות שלנו</h1>
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="main"
          aria-label="רשימת קבוצות הכדורגל"
        >
          {items.map((team) => (
            <Link
              href={`/football/${team.sys?.id}`}
              key={team.sys.id}
              className="block hover:opacity-90 transition-opacity"
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
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error fetching football teams:', error);
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold text-right mb-8">הקבוצות שלנו</h1>
        <p className="text-center text-gray-500" role="alert" aria-live="polite">שגיאה בטעינת הנתונים</p>
      </div>
    );
  }
}
