import { supabase } from "@/lib/supabase";
import type { Artist } from "@/lib/app.types";

/**
 * Readers for the "people" CMS tables (artists, football_teams) — typed rows in
 * Supabase (managed by the backoffice Templates section). Each reader maps a
 * row back to the exact `Artist`/`FootballTeam` runtime shape the UI already
 * consumes, so no component changes are needed. (Artist and FootballTeam are
 * structurally identical.) Slugs of pre-migration rows are old Contentful
 * entry ids — that's just a string format, there is no Contentful at runtime.
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
  display_order?: number | null;
  art_image_url?: string | null;
  art_color_index?: number | null;
  art_shape_index?: number | null;
  art_image_scale?: number | null;
  art_bg_scale?: number | null;
  art_image_offset_x?: number | null;
  art_image_offset_y?: number | null;
  // Page enrichments (may be absent on Contentful-fallback rows).
  hero_video_url?: string | null;
  banners?: { image_url?: string; link_url?: string; title?: string }[] | null;
  gallery?: string[] | null;
  videos?: { url?: string; label?: string }[] | null;
};

type PeopleConfig = {
  table: "artists" | "football_teams";
};

/** One row of the name→image fallback index (see listImageIndex). */
export type PersonImageEntry = {
  name: string;
  /** Hero photo, full https URL (artist-page main image). */
  url: string | null;
  /** Blob card-art set — preferred fallback; null when the person has none. */
  art: {
    imageUrl: string;
    colorIndex: number | null;
    shapeIndex: number | null;
    imageScale: number | null;
    bgScale: number | null;
    offsetX: number | null;
    offsetY: number | null;
  } | null;
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
    displayOrder: r.display_order ?? undefined,
    heroVideoUrl: r.hero_video_url ?? undefined,
    banners: r.banners?.length ? r.banners : undefined,
    gallery: r.gallery?.length ? r.gallery : undefined,
    videos: r.videos?.length ? r.videos : undefined,
    artImageUrl: r.art_image_url ?? undefined,
    artColorIndex: r.art_color_index ?? undefined,
    artShapeIndex: r.art_shape_index ?? undefined,
    artImageScale: r.art_image_scale ?? undefined,
    artBgScale: r.art_bg_scale ?? undefined,
    artImageOffsetX: r.art_image_offset_x ?? undefined,
    artImageOffsetY: r.art_image_offset_y ?? undefined,
  },
});

export function makePeopleReaders(cfg: PeopleConfig) {
  const { table } = cfg;
  const base = () => supabase.from(table).select("*").eq("is_deleted", false);

  return {
    /** All active rows (catalog). */
    async listAll(): Promise<Artist[]> {
      const { data, error } = await base().eq("is_active", true).order("name");
      if (error) {
        console.error(`${table} listAll failed:`, JSON.stringify(error));
        return [];
      }
      return ((data ?? []) as PersonRow[]).map(toPerson);
    },

    /** Featured rows in carousel order. */
    async listFeatured(): Promise<Artist[]> {
      const { data, error } = await base()
        .eq("is_active", true)
        .not("featured_order", "is", null)
        .order("featured_order", { ascending: true });
      if (error) {
        console.error(`${table} listFeatured failed:`, JSON.stringify(error));
        return [];
      }
      return ((data ?? []) as PersonRow[]).map(toPerson);
    },

    /** One row by slug (pre-migration rows use the old Contentful id string).
     *  Inactive rows (is_active=false) are logo-only records for the
     *  backoffice creative generator — they must not get a public page. */
    async getBySlug(slug: string): Promise<Artist | null> {
      const { data, error } = await base()
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) {
        console.error(`${table} getBySlug failed:`, JSON.stringify(error));
        return null;
      }
      return data ? toPerson(data as PersonRow) : null;
    },

    /**
     * Lightweight name→image index for the event-image fallback
     * (docs/superpowers/specs/2026-07-01-event-photo-artist-fallback-design.md).
     * Carries the person's blob card-art (preferred fill) AND the hero photo.
     * Full https URLs as stored — events consume them directly in next/image.
     * No Contentful fallback: on error return [] so enrichment is a no-op.
     */
    async listImageIndex(): Promise<PersonImageEntry[]> {
      const { data, error } = await supabase
        .from(table)
        .select(
          "name_english, image_url, art_image_url, art_color_index, art_shape_index, art_image_scale, art_bg_scale, art_image_offset_x, art_image_offset_y"
        )
        .eq("is_deleted", false)
        .eq("is_active", true);
      if (error) {
        console.error(`${table} listImageIndex failed:`, JSON.stringify(error));
        return [];
      }
      return ((data ?? []) as PersonRow[])
        .filter((r) => r.name_english && (r.image_url || r.art_image_url))
        .map((r) => ({
          name: r.name_english as string,
          url: r.image_url ?? null,
          art: r.art_image_url
            ? {
                imageUrl: r.art_image_url,
                colorIndex: r.art_color_index ?? null,
                shapeIndex: r.art_shape_index ?? null,
                imageScale: r.art_image_scale ?? null,
                bgScale: r.art_bg_scale ?? null,
                offsetX: r.art_image_offset_x ?? null,
                offsetY: r.art_image_offset_y ?? null,
              }
            : null,
        }));
    },

    /** Slugs for static params.
     *  Inactive (logo-only) rows excluded — no page, no sitemap entry. */
    async listSlugs(): Promise<string[]> {
      const { data, error } = await base().select("slug").eq("is_active", true);
      if (error) {
        console.error(`${table} listSlugs failed:`, JSON.stringify(error));
        return [];
      }
      return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
    },
  };
}
