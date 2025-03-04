import { contentfulClient } from "@/lib/contentful";
import { FootballFields } from "@/lib/app.types";
import Link from "next/link";
import Image from "next/image";

export const revalidate = 3600;

export default async function FootballsPage() {
  const { items } = await contentfulClient.getEntries<FootballFields>({
    content_type: "footballTeamTemplate",
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold text-right mb-8">הקבוצות שלנו</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((team) => (
          <Link
            href={`/football/${team.sys?.id}`}
            key={team.sys.id}
            className="block hover:opacity-90 transition-opacity"
          >
            <div className="border rounded-lg overflow-hidden">
              {team.fields.heroBanner?.fields && (
                <Image
                  src={"https:" + team.fields.heroBanner?.fields?.file?.url}
                  alt={String(team.fields.name)}
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
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
