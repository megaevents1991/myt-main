import type { Artist, Event, FootballTeam } from "@/lib/app.types";
import type { GoogleReview } from "@/lib/googleReviews";
import { isEventSoldOut } from "@/lib/events/price";
import { placeLabel } from "@/lib/events/lodging";
import { collapseByPage } from "@/lib/homepage/grouping";
import { toRef, type RowPool, type RowRef, type ShowFlags } from "@/lib/homepage/merge";

/**
 * The AUTOMATIC part of every homepage row, in the site's order (2026-10-14).
 *
 * Each pool is the row's own rule - the same rules ClientSideHomepage and
 * app/page.tsx applied in place until now - before staff pins, hidden cards,
 * the row length and the rows above are applied (that is lib/homepage/merge.ts).
 * The homepage renders from these, and `/api/homepage-pools` serves them to the
 * backoffice /homepage board, so the board draws the very same rows.
 *
 * One card per artist / home-team page (collapseByPage) is applied to the pool
 * as a whole: an artist the row shows, pinned or not, does not come back under
 * another date.
 */

export type PoolInput = {
  events: Event[];
  /** Every artist with a page (all, not only those on sale). */
  artists: Artist[];
  /** Every football team with a page. */
  teams: FootballTeam[];
  /** "Has an event on sale" (lib/tourStatus getAvailabilityChecker). */
  isAvailable: (nameEnglish?: string) => boolean;
  /** "לקוחות משתפים" - already filtered and newest first (lib/googleReviews). */
  reviews: GoogleReview[];
};

const eventRef = (e: Event): RowRef => toRef("event", e.id);
const artistRef = (a: Artist): RowRef => toRef("artist", a.sys.id);
const teamRef = (t: FootballTeam): RowRef => toRef("team", t.sys.id);

const time = (iso: string) => new Date(iso).getTime();

// "המבוקשים": events with a tag first, then by date.
const byTagThenDate = (a: Event, b: Event) => {
  if (a.tags && !b.tags) return -1;
  if (!a.tags && b.tags) return 1;
  return time(a.date) - time(b.date);
};

// "אירועים נוספים": a real tag (not "Sold") first, then by date.
const byPriorityTagThenDate = (a: Event, b: Event) => {
  const aHas = a.tags && a.tags !== "Sold";
  const bHas = b.tags && b.tags !== "Sold";
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  return time(a.date) - time(b.date);
};

const createdAtMs = (e: Event) => (e.created_at ? Date.parse(e.created_at) || 0 : 0);

const isMusic = (e: Event) =>
  e.type === "music_live_event_dynamic" ||
  e.type === "music_event" ||
  (e.type === "tx_event" && !e.name.startsWith("מונדיאל 2026"));

const isVip = (e: Event) => e.tags === "VIPevent";

/** The pools of the coded sections, keyed by section key. */
export function buildPools(input: PoolInput): Record<string, RowPool> {
  const { events, artists, teams, isAvailable, reviews } = input;
  const live = events.filter((e) => !isEventSoldOut(e));
  const collapse = (list: Event[]) => collapseByPage(list, artists, teams);

  // "המבוקשים ביותר": the Prioritized events, then a fill of non-VIP, non-sports events.
  const prioritized = live.filter((e) => e.is_prioritized === true).sort(byTagThenDate);
  const fill = collapse(
    live.filter((e) => e.is_prioritized === false && !isVip(e) && e.type !== "sports_event")
  ).sort(byTagThenDate);

  // "החדשים ביותר": the latest uploads.
  const newest = collapse(live.filter((e) => !isVip(e))).sort(
    (a, b) => createdAtMs(b) - createdAtMs(a) || b.id - a.id
  );

  // "אירועים נוספים": the music events.
  const more = collapse(live.filter((e) => isMusic(e) && !isVip(e))).sort(byPriorityTagThenDate);

  const onSale = (x: Artist | FootballTeam) => isAvailable(String(x.fields.nameDBenglish ?? ""));

  // Hero ring: every artist + team with an event on sale, artist / team in turn
  // (two lanes - the merge interleaves them once the pinned ones are out).
  const hero: RowPool = {
    lanes: [artists.filter(onSale).map(artistRef), teams.filter(onSale).map(teamRef)],
  };

  // "אמנים מובילים" / "כדורגל": every entry, the ones on sale first (incoming = name order).
  const availableFirst = <T extends Artist | FootballTeam>(list: T[], ref: (x: T) => RowRef) => [
    ...list.filter(onSale).map(ref),
    ...list.filter((x) => !onSale(x)).map(ref),
  ];

  return {
    hero,
    most_wanted: [...prioritized, ...fill].map(eventRef),
    newest: newest.map(eventRef),
    football: availableFirst(teams, teamRef),
    artists: availableFirst(artists, artistRef),
    reviews: reviews.map((r) => toRef("review", r.key)),
    more_events: more.map(eventRef),
  };
}

/** A staff event slider's pool: its category's events, soonest first, one per artist / team page. */
export function sliderPool(input: PoolInput, members: ReadonlySet<number> | undefined): RowRef[] {
  if (!members || members.size === 0) return [];
  return collapseByPage(
    input.events.filter((e) => members.has(e.id) && !isEventSoldOut(e) && !isVip(e)),
    input.artists,
    input.teams
  )
    .sort((a, b) => time(a.date) - time(b.date))
    .map(eventRef);
}

/** What decides whether a card can be shown (merge.ts defaultShowable), per ref. */
export function showFlags(input: PoolInput): Map<RowRef, ShowFlags> {
  const flags = new Map<RowRef, ShowFlags>();
  for (const e of input.events) flags.set(eventRef(e), { soldOut: isEventSoldOut(e) });
  const avail = (x: Artist | FootballTeam) => input.isAvailable(String(x.fields.nameDBenglish ?? ""));
  for (const a of input.artists) flags.set(artistRef(a), { available: avail(a) });
  for (const t of input.teams) flags.set(teamRef(t), { available: avail(t) });
  for (const r of input.reviews) flags.set(toRef("review", r.key), {});
  return flags;
}

/** What the /homepage board draws for one card - the picture the site's card shows. */
export type HomepageCard = {
  ref: RowRef;
  name: string;
  /** Events: "DD/MM/YY · place"; people: the English name; reviews: the text. */
  sub: string | null;
  image: string | null;
  /** A fixture's away crest (the site draws "crest VS crest"). */
  image2: string | null;
  soldOut?: boolean;
  available?: boolean;
  prioritized?: boolean;
  vip?: boolean;
  /** Events: ISO date of the event. */
  date?: string;
  /** Events: when the event was created (the "newest" rule). */
  createdAt?: string | null;
  /** Reviews: star rating. */
  rating?: number;
};

const ddmmyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

const personImage = (x: Artist | FootballTeam): string | null =>
  x.fields.artImageUrl ||
  (x.fields.heroBanner?.fields?.file?.url ? "https:" + x.fields.heroBanner.fields.file.url : null) ||
  null;

/** Every card the board may place: all live events, artists, teams and reviews. */
export function homepageCards(input: PoolInput): HomepageCard[] {
  const avail = (x: Artist | FootballTeam) => input.isAvailable(String(x.fields.nameDBenglish ?? ""));
  return [
    ...input.events.map<HomepageCard>((e) => ({
      ref: eventRef(e),
      name: e.name,
      sub: `${ddmmyy(e.date)} · ${placeLabel(e)}`,
      // Same picture EventCard draws: a fixture's home crest, else the art / card image.
      image: (e.match_away_logo_url ? e.match_home_logo_url : e.art_image_url || e.card_image_url) ?? null,
      image2: e.match_away_logo_url ?? null,
      soldOut: isEventSoldOut(e),
      prioritized: e.is_prioritized === true,
      vip: isVip(e),
      date: e.date,
      createdAt: e.created_at ?? null,
    })),
    ...input.artists.map<HomepageCard>((a) => ({
      ref: artistRef(a),
      name: String(a.fields.name ?? a.sys.id),
      sub: a.fields.nameDBenglish ? String(a.fields.nameDBenglish) : null,
      image: personImage(a),
      image2: null,
      available: avail(a),
    })),
    ...input.teams.map<HomepageCard>((t) => ({
      ref: teamRef(t),
      name: String(t.fields.name ?? t.sys.id),
      sub: t.fields.nameDBenglish ? String(t.fields.nameDBenglish) : null,
      image: personImage(t),
      image2: null,
      available: avail(t),
    })),
    ...input.reviews.map<HomepageCard>((r) => ({
      ref: toRef("review", r.key),
      name: r.authorName,
      sub: r.text.length > 140 ? `${r.text.slice(0, 140)}…` : r.text,
      image: r.authorPhotoUrl,
      image2: null,
      rating: r.rating,
      date: r.publishedAt,
    })),
  ];
}
