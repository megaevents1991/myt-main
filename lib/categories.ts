import { supabase } from "@/lib/supabase";
import type { Category, CategoryData, Template } from "@/lib/app.types";

/**
 * Categories are stored as rows of the generic backoffice `templates` table
 * (type = "category"); type-specific fields live in `data` (jsonb). This app
 * reads the active ones and flattens them for the homepage cards + /category
 * pages.
 */
const toCategory = (t: Template<CategoryData>): Category => ({
  slug: t.slug,
  name: t.name,
  name_english: t.name_english,
  image_url: t.image_url,
  display_order: t.display_order,
  is_active: t.is_active,
  subtitle: t.data?.subtitle ?? null,
  tag: t.data?.tag ?? null,
  sport: t.data?.sport ?? null,
  link_url: t.data?.link_url ?? null,
  member_ids: t.data?.member_ids ?? [],
});

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("type", "category")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getCategories failed:", JSON.stringify(error));
    return [];
  }
  return ((data ?? []) as Template<CategoryData>[]).map(toCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("type", "category")
    .eq("slug", slug)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    console.error("getCategoryBySlug failed:", JSON.stringify(error));
    return null;
  }
  return data ? toCategory(data as Template<CategoryData>) : null;
}
