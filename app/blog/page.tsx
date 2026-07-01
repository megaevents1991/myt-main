import { getAllBlogPosts } from "@/lib/blog";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { EventArt } from "@/components/ui/EventArt";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "הבלוגים שלנו - מגה איבנטס",
  alternates: {
    canonical: "https://www.mega-events.co.il/blog",
  },
};

export default async function BlogPage() {
  const timestamp = Date.now();

  try {
    const items = await getAllBlogPosts();

    return (
      <main dir="rtl" className="container mx-auto py-8 px-4">
        <div id="page-timestamp" data-timestamp={timestamp} style={{ display: 'none' }} />
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">הבלוגים שלנו</h1>
        </header>
        <section
          dir="rtl"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          role="main"
          aria-label="רשימת הבלוגים"
        >
          {items.map((post) => (
            <Link
              href={`/blog/${post.sys?.id}`}
              key={post.sys.id}
              className="block hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
              aria-label={`עמוד הבלוג ${post.fields.title || "ללא כותרת"}`}
            >
              <article className="border rounded-lg overflow-hidden h-full flex flex-col">
                <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-[#0A1A14] to-[#178189]">
                  {post.fields.artImageUrl ? (
                    <EventArt
                      id={post.sys.id}
                      imageUrl={post.fields.artImageUrl}
                      alt={`תמונה לבלוג ${String(post.fields.title)}`}
                      colorIndex={post.fields.artColorIndex}
                      shapeIndex={post.fields.artShapeIndex}
                      priority
                      className="h-full w-full"
                    />
                  ) : post.fields.heroBanner?.fields?.file?.url ? (
                    <Image
                      src={"https:" + post.fields.heroBanner.fields.file.url}
                      alt={`תמונה לבלוג ${String(post.fields.title)}`}
                      priority={true}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      style={{ objectPosition: 'center top' }}
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/80 text-5xl font-bold">
                      ✍
                    </div>
                  )}
                </div>
                <div className="p-2 px-4 text-right flex-1" dir="rtl">
                  <h2 className="text-xl font-bold mb-2">
                    {String(post.fields.title)}
                  </h2>
                  <p className="text-gray-600 line-clamp-2">
                    {String(post.fields?.previewText || "")}
                  </p>
                  {post.fields.byWho && (
                    <p className="text-xs text-gray-500 mt-2">
                      מאת {String(post.fields.byWho)}
                    </p>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </section>
      </main>
    );
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return (
      <main className="container mx-auto py-8 px-4">
        <header>
          <h1 className="text-4xl font-bold text-right mb-8">הבלוגים שלנו</h1>
        </header>
        <p className="text-center text-gray-500" role="alert" aria-live="polite">שגיאה בטעינת הנתונים</p>
      </main>
    );
  }
}
