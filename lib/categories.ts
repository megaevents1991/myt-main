import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/app.types";

/**
 * Categories are a backoffice-managed CMS type, stored in the typed Supabase
 * `categories` table. This app reads the active ones for the homepage cards and
 * the /category/[slug] pages.
 */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getCategories failed:", JSON.stringify(error));
    return [];
  }
  return (data ?? []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    console.error("getCategoryBySlug failed:", JSON.stringify(error));
    return null;
  }
  return (data as Category) ?? null;
}
