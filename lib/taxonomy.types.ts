/**
 * Event taxonomy types — mirrored from myt-backoffice `types/taxonomy.types.ts`.
 * The backoffice writes `event_categories` / `event_tags` and the junction
 * tables; this app reads them. Keep both copies in sync (/sync-types).
 */

export type EventCategory = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  name_english: string | null;
  image_url: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

// Built in memory from a flat EventCategory[] for tree UI + traversal.
export type EventCategoryNode = EventCategory & { children: EventCategoryNode[] };

export type EventTag = {
  id: number;
  slug: string;
  name: string;
  name_english: string | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};
