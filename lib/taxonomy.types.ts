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
  /**
   * Rich hub-page content (vertical hubs like כדורגל) - null on plain nodes.
   * OPTIONAL until the `categories.page_content` jsonb column is migrated;
   * meanwhile the hub pages fall back to bundled content
   * (components/vertical-hub/footballContent.ts).
   */
  page_content?: CategoryPageContent | null;
};

/** A recommended stadium card on a vertical hub page. */
export type CategoryStadium = {
  name: string;
  city: string;
  /** e.g. "74,000 מקומות" - free text, shown as a meta chip. */
  capacity?: string;
  /** Home team(s) - free text meta chip. */
  teams?: string;
  description: string;
  image_url?: string | null;
};

/**
 * Backoffice-managed content for a vertical hub page (/c/football, /c/music).
 * Stored as `categories.page_content` (jsonb). Every field optional - a
 * missing field simply hides its section on the page.
 */
export type CategoryPageContent = {
  /** Long-form marketing/SEO text shown under the hero. */
  seo_text?: string;
  /** Heading above the SEO text; falls back to a generic one. */
  seo_title?: string;
  /** Gallery image URLs (ExperienceCarousel). */
  gallery?: string[];
  stadiums?: CategoryStadium[];
  faq?: { question: string; answer: string }[];
};

// Built in memory from a flat EventCategory[] for tree UI + traversal.
export type EventCategoryNode = EventCategory & {
  children: EventCategoryNode[];
};

/**
 * Tag kind - drives the feed's custom_label mapping (vertical→0,
 * league|genre→1, team|artist→2, city→3), nav grouping and facet groups.
 */
export const TAG_TYPES = [
  "vertical",
  "league",
  "team",
  "artist",
  "genre",
  "city",
  "other",
] as const;
export type TagType = (typeof TAG_TYPES)[number];

export type EventTag = {
  id: number;
  slug: string;
  name: string;
  name_english: string | null;
  type: TagType;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};
