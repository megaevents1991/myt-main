import type { TagType } from "@/lib/taxonomy.types";

/**
 * Customer-facing names for league TAGS (redesign spec: "פרמייר ליג לא ליגה
 * אנגלית"). Display-only - filtering, feeds and the backoffice keep the raw
 * tag names, so Meta custom_labels don't shift mid-campaign. Rename the tags
 * in the DB later, coordinated with the feed, and this map dies.
 */
export const LEAGUE_DISPLAY: Record<string, string> = {
  "ליגה אנגלית": "פרמייר ליג",
  "ליגה ספרדית": "לה ליגה",
  "ליגה איטלקית": "סריה א",
  "ליגה גרמנית": "בונדסליגה",
  "ליגה הולנדית": "ארדיוויזיה",
  "ליגה צרפתית": "ליג 1",
};

export const displayTagName = (name: string, type?: TagType): string =>
  type === "league" ? LEAGUE_DISPLAY[name] ?? name : name;
