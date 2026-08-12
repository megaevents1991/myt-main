/**
 * Event taxonomy types - mirrored from myt-backoffice `types/taxonomy.types.ts`.
 * Keep both copies in sync (/sync-types).
 *
 * ONE category table: `categories` - the Templates card, which also carries
 * the tree (`parent_id`) and the tags composing it (`category_tags`). The old
 * parallel `event_categories` node is gone.
 */

export type EventCategory = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  name_english: string | null;
  image_url: string | null;
  /** Card strapline, doubles as the category page's meta description. */
  subtitle: string | null;
  display_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

// Built in memory from a flat EventCategory[] for tree UI + traversal.
export type EventCategoryNode = EventCategory & {
  children: EventCategoryNode[];
};

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
