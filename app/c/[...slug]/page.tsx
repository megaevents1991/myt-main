import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAllCategories, getEventsInCategory } from "@/lib/taxonomy";
import { ancestorsOf, slugPathOf } from "@/lib/taxonomy-tree";
import { DetailHero } from "@/components/DetailHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventCard } from "@/components/EventCard";
import ClientTracker from "@/components/ClientTracker";

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Dynamic taxonomy pages — one page per node of the backoffice category tree,
 * at its canonical nested path: /c/football, /c/football/premier-league, ...
 * The LAST segment resolves the node (slugs are globally unique); non-canonical
 * paths 301 to the canonical one. Events include every descendant node's
 * events (ancestors inferred at read time — Shopify-style).
 */

export async function generateStaticParams() {
  const all = await getAllCategories();
  return all.map((c) => ({ slug: slugPathOf(c, all) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const leaf = slug[slug.length - 1];
  const all = await getAllCategories();
  const cat = all.find((c) => c.slug === leaf);
  if (!cat) return { title: "Category Not Found - MYT" };
  const canonicalPath = slugPathOf(cat, all).join("/");
  return {
    title: `${cat.name} - כרטיסים וחבילות | MYT`,
    description: cat.description || `כרטיסים וחבילות ל${cat.name}`,
    alternates: { canonical: `https://www.mega-events.co.il/c/${canonicalPath}` },
    openGraph: {
      title: cat.name,
      ...(cat.image_url && { images: [{ url: cat.image_url, alt: cat.name }] }),
    },
  };
}

export default async function TaxonomyCategoryPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const leaf = decodeURIComponent(slug[slug.length - 1] ?? "");
  const all = await getAllCategories();
  const cat = all.find((c) => c.slug === leaf);
  if (!cat || !cat.is_active) notFound();

  // Canonical path enforcement: /c/premier-league → /c/football/premier-league.
  const canonical = slugPathOf(cat, all);
  if (slug.join("/") !== canonical.join("/")) {
    redirect(`/c/${canonical.join("/")}`);
  }

  const breadcrumbs = ancestorsOf(cat, all);
  const children = all
    .filter((c) => c.parent_id === cat.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  const { events } = await getEventsInCategory(cat.slug);

  return (
    <>
      <ClientTracker />
      <DetailHero
        name={cat.name}
        bio={cat.description ? <p>{cat.description}</p> : null}
        imageUrl={cat.image_url ?? undefined}
        imageAlt={`באנר ${cat.name}`}
      />

      <div className="container mx-auto px-4 py-8" dir="rtl">
        {/* Breadcrumbs — walk UP the tree */}
        <nav aria-label="ניווט קטגוריות" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:text-foreground hover:underline">
                עמוד הבית
              </Link>
            </li>
            {breadcrumbs.map((b) => (
              <li key={b.id} className="flex items-center gap-1">
                <span aria-hidden>‹</span>
                <Link
                  href={`/c/${slugPathOf(b, all).join("/")}`}
                  className="hover:text-foreground hover:underline"
                >
                  {b.name}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-1">
              <span aria-hidden>‹</span>
              <span className="font-semibold text-foreground">{cat.name}</span>
            </li>
          </ol>
        </nav>

        {/* Child categories — walk DOWN the tree */}
        {children.length > 0 && (
          <section aria-labelledby="subcategories-heading" className="mb-10">
            <h2
              id="subcategories-heading"
              className="mb-4 font-display text-2xl font-extrabold text-foreground"
            >
              קטגוריות
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="list">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/c/${slugPathOf(child, all).join("/")}`}
                  role="listitem"
                  className="group relative block h-32 overflow-hidden rounded-2xl border border-border shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  {child.image_url ? (
                    <Image
                      src={child.image_url}
                      alt={child.name}
                      fill
                      sizes="(max-width: 640px) 90vw, 300px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-main" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <h3 className="absolute inset-x-4 bottom-3 text-lg font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                    {child.name}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Events in this branch (node + all descendants) */}
        <section aria-labelledby="category-events-heading">
          <h2
            id="category-events-heading"
            className="mb-6 font-display text-2xl font-extrabold text-foreground"
          >
            אירועים ב{cat.name}
          </h2>
          {events.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {events.map((event) => (
                <EventCard key={event.id} event={event} showName />
              ))}
            </div>
          ) : (
            <EmptyState title="אין אירועים בקטגוריה זו כרגע" />
          )}
        </section>
      </div>
    </>
  );
}
