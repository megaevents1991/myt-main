import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import { contentfulClient } from "@/lib/contentful";
import { getCategories, getCategoryBySlug } from "@/lib/categories";
import { DetailHero } from "@/components/DetailHero";
import { EmptyState } from "@/components/ui/EmptyState";
import ClientTracker from "@/components/ClientTracker";

export const revalidate = 3600;
export const dynamicParams = true;

type Member = {
  id: string;
  name: string;
  imageUrl?: string;
  href: string;
};

/** Resolve member artist/team pages (Contentful entries) by their IDs. */
async function resolveMembers(ids: string[]): Promise<Member[]> {
  if (!ids.length) return [];
  const entries = await Promise.all(
    ids.map((id) =>
      contentfulClient.getEntry(id).catch(() => null)
    )
  );
  return entries.filter(Boolean).map((entry) => {
    const e = entry as unknown as {
      sys: { id: string; contentType?: { sys?: { id?: string } } };
      fields?: { name?: string; heroBanner?: { fields?: { file?: { url?: string } } } };
    };
    const isFootball = e.sys.contentType?.sys?.id === "footballTeamTemplate";
    const url = e.fields?.heroBanner?.fields?.file?.url;
    return {
      id: e.sys.id,
      name: String(e.fields?.name ?? ""),
      imageUrl: url ? "https:" + url : undefined,
      href: `${isFootball ? "/football" : "/artists"}/${e.sys.id}`,
    };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Category Not Found - MYT" };
  return {
    title: `${cat.name} - כרטיסים וחבילות | MYT`,
    description: cat.subtitle || `כרטיסים וחבילות ל${cat.name}`,
    alternates: { canonical: `https://www.mega-events.co.il/category/${slug}` },
    openGraph: {
      title: cat.name,
      ...(cat.image_url && { images: [{ url: cat.image_url, alt: cat.name }] }),
    },
  };
}

export async function generateStaticParams() {
  const cats = await getCategories();
  return cats.map((c) => ({ slug: c.slug }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat || !cat.is_active) notFound();

  const members = await resolveMembers(cat.member_ids ?? []);

  return (
    <>
      <ClientTracker />
      <DetailHero
        name={cat.name}
        bio={cat.subtitle ? <p>{cat.subtitle}</p> : null}
        imageUrl={cat.image_url ?? undefined}
        imageAlt={`באנר ${cat.name}`}
      />

      <section className="container mx-auto px-4 py-12" aria-labelledby="category-members-heading">
        <h2
          id="category-members-heading"
          className="mb-6 font-display text-2xl font-extrabold text-foreground"
        >
          כל החבילות
        </h2>
        {members.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {members.map((m) => (
              <Link
                key={m.id}
                href={m.href}
                role="listitem"
                className="group relative block h-48 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                dir="rtl"
              >
                {m.imageUrl ? (
                  <Image
                    src={m.imageUrl}
                    alt={m.name}
                    fill
                    sizes="(max-width: 640px) 90vw, 360px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-main" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <h3 className="absolute inset-x-4 bottom-3 text-xl font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                  {m.name}
                </h3>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="אין חבילות בקטגוריה זו עדיין" />
        )}
      </section>
    </>
  );
}
