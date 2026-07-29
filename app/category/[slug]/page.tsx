import { notFound, permanentRedirect } from "next/navigation";

import { getAllCategories } from "@/lib/taxonomy";
import { slugPathOf } from "@/lib/taxonomy-tree";

/**
 * Legacy category URL — permanently redirected to /c/.
 *
 * There used to be two customer-facing category pages: this one, which listed
 * `member_ids` (artist/team pages) off the Templates card, and /c/[...slug],
 * which lists the EVENTS the category's tags pull in. Two URLs for one thing —
 * and the one people linked to showed no events at all. Now that a category is
 * a single row carrying both the card and its tags, /c/ IS the category page
 * and this path forwards: old links, bookmarks and search results keep
 * working, and the 301 hands the ranking over.
 */
export const dynamicParams = true;

export default async function LegacyCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const all = await getAllCategories();
  const cat = all.find((c) => c.slug === decodeURIComponent(slug));
  if (!cat) notFound();
  permanentRedirect(`/c/${slugPathOf(cat, all).join("/")}`);
}
