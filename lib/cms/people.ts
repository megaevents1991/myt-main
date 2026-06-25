import { supabase } from "@/lib/supabase";
import { contentfulClient } from "@/lib/contentful";
import type { Artist } from "@/lib/app.types";

/**
 * Readers for the "people" CMS tables (artists, football_teams) — typed rows in
 * Supabase that are replacing Contentful. Each reader maps a row back to the
 * exact `Artist`/`FootballTeam` runtime shape the UI already consumes, so no
 * component changes are needed. (Artist and FootballTeam are structurally
 * identical.)
 *
 * MIGRATION SAFETY: Supabase is the primary source; if it returns nothing
 * (empty / missing row), we fall back to Contentful so the live site never
 * loses content mid-migration. Remove the Contentful fallback once verified.
 */
type PersonRow = {
  slug: string;
  name: string;
  name_english: string | null;
  preview_text: string | null;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  bio: unknown;
  seo_title: string | null;
  meta_description: string | null;
  meta_tags: string | null;
  featured_order: number | null;
  art_image_url?: string | null;
  art_color_index?: number | null;
  art_shape_index?: number | null;
  // Page enrichments (may be absent on Contentful-fallback rows).
  hero_video_url?: string | null;
  banners?: { image_url?: string; link_url?: string; title?: string }[] | null;
  gallery?: string[] | null;
  videos?: { url?: string; label?: string }[] | null;
};

type PeopleConfig = {
  table: "artists" | "football_teams";
  contentType: "artistTemplate" | "footballTeamTemplate";
  carouselId: string;
};

// Consumers build the final src as `"https:" + url`, so return a
// protocol-relative URL (strip the scheme) to keep that pattern working.
const toPerson = (r: PersonRow): Artist => ({
  sys: { id: r.slug },
  fields: {
    name: r.name ?? undefined,
    nameDBenglish: r.name_english ?? undefined,
    previewText: r.preview_text ?? undefined,
    heroBanner: r.image_url
      ? {
          fields: {
            file: {
              url: r.image_url.replace(/^https:/, ""),
              details:
                r.image_width && r.image_height
                  ? { image: { width: r.image_width, height: r.image_height } }
                  : undefined,
            },
          },
        }
      : undefined,
    bio: (r.bio as Artist["fields"]["bio"]) ?? undefined,
    seoTitle: r.seo_title ?? undefined,
    metaDescription: r.meta_description ?? undefined,
    metaTags: r.meta_tags ?? undefined,
    heroVideoUrl: r.hero_video_url ?? undefined,
    banners: r.banners?.length ? r.banners : undefined,
    gallery: r.gallery?.length ? r.gallery : undefined,
    videos: r.videos?.length ? r.videos : undefined,
    artImageUrl: r.art_image_url ?? undefined,
    artColorIndex: r.art_color_index ?? undefined,
    artShapeIndex: r.art_shape_index ?? undefined,
  },
});

// Contentful entry → same runtime shape. Contentful asset URLs are already
// protocol-relative ("//images.ctfassets.net/…"), so pass them through as-is.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfToPerson = (e: any): Artist => ({
  sys: { id: e.sys.id },
  fields: {
    name: e.fields?.name,
    nameDBenglish: e.fields?.nameDBenglish,
    previewText: e.fields?.previewText,
    heroBanner: e.fields?.heroBanner,
    bio: e.fields?.bio,
    seoTitle: e.fields?.seoTitle,
    metaDescription: e.fields?.metaDescription,
    metaTags: e.fields?.metaTags,
  },
});

export function makePeopleReaders(cfg: PeopleConfig) {
  const { table, contentType, carouselId } = cfg;
  const base = () => supabase.from(table).select("*").eq("is_deleted", false);

  return {
    /** All active rows (catalog). Falls back to Contentful when empty. */
    async listAll(): Promise<Artist[]> {
      const { data, error } = await base().eq("is_active", true).order("name");
      if (!error && data && data.length) return (data as PersonRow[]).map(toPerson);
      if (error) console.error(`${table} listAll failed:`, JSON.stringify(error));
      try {
        const { items } = await contentfulClient.getEntries({ content_type: contentType, limit: 1000 });
        return items.map(cfToPerson);
      } catch (e) {
        console.error(`${table} CF fallback failed:`, e);
        return [];
      }
    },

    /** Featured rows in carousel order. Falls back to the Contentful carousel. */
    async listFeatured(): Promise<Artist[]> {
      const { data, error } = await base()
        .eq("is_active", true)
        .not("featured_order", "is", null)
        .order("featured_order", { ascending: true });
      if (!error && data && data.length) return (data as PersonRow[]).map(toPerson);
      if (error) console.error(`${table} listFeatured failed:`, JSON.stringify(error));
      try {
        const entry = await contentfulClient.getEntry(carouselId, { include: 2 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = ((entry.fields as any)?.items ?? []) as any[];
        return items.filter((i) => i && "fields" in i).map(cfToPerson);
      } catch (e) {
        console.error(`${table} CF carousel fallback failed:`, e);
        return [];
      }
    },

    /** One row by slug (= Contentful id). Falls back to the Contentful entry. */
    async getBySlug(slug: string): Promise<Artist | null> {
      const { data, error } = await base().eq("slug", slug).maybeSingle();
      if (!error && data) return toPerson(data as PersonRow);
      if (error) console.error(`${table} getBySlug failed:`, JSON.stringify(error));
      try {
        const entry = await contentfulClient.getEntry(slug);
        return entry ? cfToPerson(entry) : null;
      } catch {
        return null;
      }
    },

    /** Slugs for static params. Union of Supabase + Contentful (dedup). */
    async listSlugs(): Promise<string[]> {
      const slugs = new Set<string>();
      const { data, error } = await base().select("slug");
      if (!error && data) for (const r of data as { slug: string }[]) slugs.add(r.slug);
      try {
        const { items } = await contentfulClient.getEntries({ content_type: contentType, limit: 1000 });
        for (const it of items) slugs.add(it.sys.id);
      } catch {
        /* ignore */
      }
      return [...slugs];
    },
  };
}
