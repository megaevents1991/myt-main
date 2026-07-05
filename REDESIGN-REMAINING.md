# Redesign — remaining items (#16, #23)

Status of the 26-item redesign doc: **24 done.** The two below are **not code- or
data-blocked** — they're blocked on a **design decision**. I can build either in a
few hours once there's a target to build against.

Everything else (search, carousel, cards, order flow, dark mode, categories,
artist/team page extras — banners, gallery, videos, hero video, sticky header,
new logo) is shipped.

---

## #16 — New package display for a specific artist / team

> Doc: *"תצוגה חדשה לחבילות של אמן ספציפי או קבוצה / ליגה ספציפית בכדורגל. בנייח הרבה יותר יפה."*
> (New display for the packages of a specific artist or team/league. **Desktop** much nicer.)

### What this is
The **"אירועים קרובים"** list on an artist/team page — the grid of event "package"
cards (date · price · icons · "בחרו תאריך"). Today it's a simple 2-column grid of
`EventCard`s. Dor wants a **richer desktop layout**.

### Current state
- File: `app/artists/[slug]/page.tsx` + `app/football/[slug]/page.tsx` — the
  `<section id="upcoming-events">` block.
- Renders `components/EventCard.tsx` in `grid gap-4 sm:grid-cols-2`.
- Mobile is fine; desktop just stretches the same 2-up grid.

### What's missing
A **desktop-specific layout** that looks more designed — but the exact shape is a
visual decision, not something I can infer. Options I can build (pick one or sketch
your own):

1. **Table / row list** — each date is a wide row: date + venue on the right,
   price + package icons in the middle, big CTA on the left. Denser, "schedule"
   feel. Good when there are many dates.
2. **Featured + grid** — first/cheapest date as a large hero card, the rest in a
   3-up grid beside it.
3. **3-up card grid** with bigger cards (image strip per card, more breathing room)
   — closest to today, just upgraded for `lg:grid-cols-3`.

### What I need from you
- A **screenshot / Figma frame** of the target desktop layout, **or**
- Pick one of the 3 options above (+ any tweaks).

### How I'd build it (once decided)
- Add a desktop variant to `EventCard` (or a new `EventRow` for option 1).
- Swap the grid in both detail pages to the chosen `lg:` layout (keep the mobile
  grid as-is).
- No data or backoffice change — same `events` already fetched.

---

## #23 — Team page "strong" desktop

> Doc: *"עמוד קבוצה - בנייח ממש השקענו שיראה חזק שם."*
> (Team page — on **desktop**, really invest so it looks strong/impressive there.)

### What this is
The **football team page** (`app/football/[slug]/page.tsx`) should feel premium on
desktop — a flagship look for big clubs.

### Current state
- Same structure as the artist page: `DetailHero` + events grid + (now) banners,
  videos, gallery, FAQ, trust.
- It works, but the layout is the generic detail-page layout — not a bespoke
  "strong" team page.

### What's missing
This overlaps #16 (the events layout) **plus** a more impactful hero/section
treatment specific to teams. Concretely it needs decisions on:
- **Hero**: big club crest + stadium imagery? full-width banner vs the current
  split blob-circle hero?
- **Section order / emphasis** on desktop (fixtures first? a stats/era strip? the
  gallery bigger?).
- Whether teams get a layout **distinct from artists**, or share #16's upgrade.

### What I need from you
- A **mock of the desktop team page** (even rough), **or** answers to:
  1. Should the team hero differ from the artist hero? How?
  2. Section order + which sections to emphasize.
  3. Distinct team layout, or "artist layout but bigger/stronger"?

### How I'd build it (once decided)
- Likely a `TeamHero` variant of `DetailHero` (or props to widen/skin it).
- Reorder/upsize sections in `app/football/[slug]/page.tsx`.
- Reuse the existing data (events, banners, gallery, videos) — no schema change.

---

## TL;DR — what's needed from you
| # | Blocker | Send me |
|---|---------|---------|
| 16 | layout choice | a desktop mock, or pick option 1/2/3 above |
| 23 | team-page design | a desktop mock, or answers to the 3 questions above |

Both are pure frontend once decided — no DB, no backoffice, no new data.
