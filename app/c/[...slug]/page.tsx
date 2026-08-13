import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getAllCategories, getEventsInCategory, getTagsForEvents } from "@/lib/taxonomy";
import { ancestorsOf, slugPathOf } from "@/lib/taxonomy-tree";
import { FootballTeamsCatalog } from "@/components/FootballTeamsCatalog";
import { getAllFootballTeams } from "@/lib/football";
import { getAllArtists } from "@/lib/artists";
import { DetailHero } from "@/components/DetailHero";
import { HeaderTitle } from "@/components/HeaderTitle";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryEventsBrowser } from "@/components/CategoryEventsBrowser";
import ClientTracker from "@/components/ClientTracker";

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Dynamic taxonomy pages - one page per node of the backoffice category tree,
 * at its canonical nested path: /c/football, /c/football/premier-league, ...
 * The LAST segment resolves the node (slugs are globally unique); non-canonical
 * paths 301 to the canonical one. Membership is the node's OWN tags only -
 * `getEventsInCategory` does not walk descendants, so a hub node (children,
 * no tags of its own) renders its child tiles but no event grid.
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
    description: cat.subtitle || `כרטיסים וחבילות ל${cat.name}`,
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

  // The teams hub shows the full CMS team catalog ("הקבוצות שלנו" - same
  // experience as /football) instead of bare taxonomy tiles (Dor, 2026-08-13).
  if (cat.slug === "teams") {
    return (
      <>
        <ClientTracker />
        <HeaderTitle name={cat.name} />
        <FootballTeamsCatalog title={cat.name} />
      </>
    );
  }

  // Team/artist LEAVES reuse the rich CMS pages the site already has (hero,
  // bio, tour dates) - /c/football/teams/real-madrid redirects to its CMS
  // twin, matched by English then Hebrew name. No twin → the generic
  // category page below still renders (Dor, 2026-08-13).
  const parent = cat.parent_id != null ? all.find((c) => c.id === cat.parent_id) : null;
  if (parent && (parent.slug === "teams" || parent.slug === "artists")) {
    let twinHref: string | null = null;
    try {
      const entries =
        parent.slug === "teams" ? await getAllFootballTeams() : await getAllArtists();
      const en = (cat.name_english ?? "").trim().toLowerCase();
      const he = cat.name.trim().toLowerCase();
      const hit = (entries as { sys: { id: string }; fields: { name?: unknown; nameDBenglish?: unknown } }[]).find(
        (e) => {
          const cmsEn = String(e.fields.nameDBenglish ?? "").trim().toLowerCase();
          const cmsName = String(e.fields.name ?? "").trim().toLowerCase();
          return (en && (cmsEn === en || cmsName === en)) || cmsName === he;
        },
      );
      if (hit) {
        twinHref = `/${parent.slug === "teams" ? "football" : "artists"}/${hit.sys.id}`;
      }
    } catch (e) {
      console.error("CMS twin lookup failed:", JSON.stringify(e));
    }
    if (twinHref) redirect(twinHref);
  }

  const breadcrumbs = ancestorsOf(cat, all);
  const children = all
    .filter((c) => c.parent_id === cat.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  const { events } = await getEventsInCategory(cat.slug);
  const tagsByEvent = await getTagsForEvents(events.map((e) => e.id));

  return (
    <>
      <ClientTracker />
      {/* Puts the category name in the header bar once the hero scrolls away,
          exactly like the artist and team pages. */}
      <HeaderTitle name={cat.name} />
      <DetailHero
        name={cat.name}
        bio={cat.subtitle ? <p>{cat.subtitle}</p> : null}
        imageUrl={cat.image_url ?? undefined}
        imageAlt={`באנר ${cat.name}`}
      />

      <div className="container mx-auto px-4 py-8" dir="rtl">
        {/* Breadcrumbs - walk UP the tree */}
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

        {/* Child categories - walk DOWN the tree. No "קטגוריות" heading -
            the tiles speak for themselves (Dor, 2026-08-13). */}
        {children.length > 0 && (
          <section aria-label="תת-קטגוריות" className="mb-10">
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

        {/* Events tagged with this node's OWN tags - not inherited from children.
            A hub (no tags of its own, but has children) shows tiles above and
            skips this section entirely: no heading, no empty-state either. */}
        {(events.length > 0 || children.length === 0) && (
          <section aria-labelledby="category-events-heading">
            <h2
              id="category-events-heading"
              className="mb-6 font-display text-2xl font-extrabold text-foreground"
            >
              חבילות ל{cat.name}
            </h2>
            {events.length > 0 ? (
              <CategoryEventsBrowser
                events={events}
                tagsByEvent={tagsByEvent}
                headingId="category-events-heading"
              />
            ) : (
              <EmptyState
                title="אין חבילות בקטגוריה זו כרגע"
                description="הקטגוריה נבנית מתגיות - ברגע שאירוע יתויג בהתאם הוא יופיע כאן."
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}
