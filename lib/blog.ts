import { supabase } from "@/lib/supabase";
import { contentfulClient } from "@/lib/contentful";

/** Runtime shape for a blog post (mirrors the old Contentful entry shape). */
export type BlogPost = {
  sys: { id: string };
  fields: {
    name?: string;
    title?: string;
    previewText?: string;
    byWho?: string;
    heroBanner?: {
      fields?: {
        file?: {
          url?: string;
          details?: { image?: { height?: number; width?: number } };
        };
      };
    };
    mainContent?: unknown; // Contentful rich-text document
    seoTitleTag?: string;
    metaDescription?: string;
    metaTags?: string;
    // Blob card-art (Supabase art_* columns; absent on Contentful-fallback rows).
    artImageUrl?: string;
    artColorIndex?: number;
    artShapeIndex?: number;
  };
};

type BlogRow = {
  slug: string;
  name: string;
  title: string | null;
  preview_text: string | null;
  by_who: string | null;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  art_image_url: string | null;
  art_color_index: number | null;
  art_shape_index: number | null;
  main_content: unknown;
  seo_title_tag: string | null;
  meta_description: string | null;
  meta_tags: string | null;
};

const toBlog = (r: BlogRow): BlogPost => ({
  sys: { id: r.slug },
  fields: {
    name: r.name ?? undefined,
    title: r.title ?? undefined,
    previewText: r.preview_text ?? undefined,
    byWho: r.by_who ?? undefined,
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
    mainContent: r.main_content ?? undefined,
    seoTitleTag: r.seo_title_tag ?? undefined,
    metaDescription: r.meta_description ?? undefined,
    metaTags: r.meta_tags ?? undefined,
    artImageUrl: r.art_image_url ?? undefined,
    artColorIndex: r.art_color_index ?? undefined,
    artShapeIndex: r.art_shape_index ?? undefined,
  },
});

// Contentful entry → same runtime shape (migration fallback).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cfToBlog = (e: any): BlogPost => ({
  sys: { id: e.sys.id },
  fields: {
    name: e.fields?.name,
    title: e.fields?.title,
    previewText: e.fields?.previewText,
    byWho: e.fields?.byWho,
    heroBanner: e.fields?.heroBanner,
    mainContent: e.fields?.mainContent,
    seoTitleTag: e.fields?.seoTitleTag,
    metaDescription: e.fields?.metaDescription,
    metaTags: e.fields?.metaTags,
  },
});

const base = () => supabase.from("blog_posts").select("*").eq("is_deleted", false);

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await base()
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (!error && data && data.length) return (data as BlogRow[]).map(toBlog);
  if (error) console.error("getAllBlogPosts failed:", JSON.stringify(error));
  try {
    const { items } = await contentfulClient.getEntries({ content_type: "blogTemplate", limit: 1000 });
    return items.map(cfToBlog);
  } catch (e) {
    console.error("blog CF fallback failed:", e);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await base().eq("slug", slug).maybeSingle();
  if (!error && data) return toBlog(data as BlogRow);
  if (error) console.error("getBlogPostBySlug failed:", JSON.stringify(error));
  try {
    const entry = await contentfulClient.getEntry(slug);
    return entry ? cfToBlog(entry) : null;
  } catch {
    return null;
  }
}

export async function getBlogPostSlugs(): Promise<string[]> {
  const slugs = new Set<string>();
  const { data, error } = await base().select("slug");
  if (!error && data) for (const r of data as { slug: string }[]) slugs.add(r.slug);
  try {
    const { items } = await contentfulClient.getEntries({ content_type: "blogTemplate", limit: 1000 });
    for (const it of items) slugs.add(it.sys.id);
  } catch {
    /* ignore */
  }
  return [...slugs];
}
