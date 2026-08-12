---
name: card-art-audit
description: Verify every artist/team card image still looks right on ALL surfaces after any image change. Use whenever touching card art, art_* fields, cut-out uploads, EventArt/HeroCarousel/DetailHero, next.config image patterns, or a person's photo. Triggers on: image looks bad, cropped head, tiny artist, black card, broken image, card art, cut-out, blob art, hero carousel image.
---

# Card Art Audit (myt-main)

One image feeds five surfaces at different aspect ratios. A change that fixes one
routinely breaks another - a cut-out sized for the square catalog card gets its head
cropped on the tall hero card. **Never ship an image change after eyeballing one
surface.** Run this end to end.

## The surfaces (check every one)

| #   | Surface                                     | Component                                  | Shape              | Fit                   |
| --- | ------------------------------------------- | ------------------------------------------ | ------------------ | --------------------- |
| 1   | Homepage hero carousel                      | `components/HeroCarousel.tsx`              | tall portrait ~2:3 | contain, centered     |
| 2   | Homepage artist/team slide                  | `components/CategorySection.tsx`           | near-square        | contain, bottom       |
| 3   | Catalog page card (`/artists`, `/football`) | `components/CatalogPageTemplate.tsx`       | near-square        | contain, bottom       |
| 4   | Artist/team page hero circle                | `components/DetailHero.tsx`                | square (masked)    | contain, bottom, ×0.8 |
| 5   | Event cards + OG image                      | `components/ui/EventArt.tsx`, `lib/og.tsx` | landscape / square | contain               |

Every one renders through `components/ui/EventArt.tsx`. Fix bugs there, not per surface.

## Invariants - break one and images go bad

1. **Crest treatment is for football teams only.** `isTightCrest(url)` in `lib/eventArt.ts`
   answers "does this source honor the zoom/offset dial", NOT "is this a crest". Gate the
   `FOOTBALL_CREST_ART` lift on the entity being a team (`kind === "team"`), never on the
   bucket - the picker writes artist cut-outs to `templates` too, and the crest lift pushed
   their heads out through the top of the hero card.
2. **People render at plain contain, no dial**, on the hero card and the detail circle. The
   backoffice zoom/offset dials are tuned on the near-square catalog card and crop on tall ones.
3. **Cut-outs must be trimmed tight** - no transparent margin. The site contain-fits the whole
   canvas, so padding renders as a small artist floating in the card. The backoffice picker
   (`components/art-blob-picker.tsx`) trims on upload; anything uploaded before 2026-07-26,
   or dropped straight into a bucket, may still be padded.
4. **Trim by SOLID alpha (≥200), not `alpha > 0`.** Matting leaves a near-invisible veil across
   the whole canvas; a naive bbox trims nothing (Jay-Z: subject 52% of width, veil 100%).
5. **Every Supabase public bucket must be in `next.config.ts` `remotePatterns`.** The entry is
   `/storage/v1/object/public/**` - keep it wildcarded. A missing bucket renders a black card
   with a broken-image icon while `curl` on the raw URL happily returns 200.
6. **No event image → artist image.** `lib/events/fallbackImage.ts` fills from the matching
   artist/team. A black card usually means no person row exists, not a code bug.

## Where this is already enforced

- **Upload guard (backoffice).** `ArtBlobPicker` trims every image assigned to a card-art
  field - the file upload, a pasted URL, and browsing storage all funnel through
  `handlePickedUrl` / `trimTransparent`. Padded art is re-cropped to `templates` and the
  field takes the new URL. `autoTrim={false}` (football teams) and photo-background cards
  (shapeIndex ≥ 6) opt out, because crest margin is intentional.
- **CI.** `.github/workflows/card-art-audit.yml` runs this script weekly and on demand, and
  fails on findings. It needs the repo secrets `NEXT_SECRET_SUPABASE_URL` and
  `NEXT_SECRET_SUPABASE_SERVICE_KEY`; without them it warns and stays green.

Neither covers a row edited straight in the Supabase dashboard - that is what the manual run
below is for.

## Procedure

```bash
python .claude/skills/card-art-audit/audit_card_art.py            # report only
python .claude/skills/card-art-audit/audit_card_art.py --sheet    # + contact sheet PNG
python .claude/skills/card-art-audit/audit_card_art.py --fail-on-issues   # CI mode
```

Needs `.env.local` (`NEXT_SECRET_SUPABASE_URL`, `NEXT_SECRET_SUPABASE_SERVICE_KEY`) and
`pillow` + `numpy`.

It reports, per artist and team:

- HTTP status of the art URL and whether `next/image` will accept the bucket
- canvas size, solid-subject bbox, **% wasted canvas** (≥12% = padded, needs trimming)
- file weight (flag over ~3 MB)

Padding is only flagged for **people**. Football crests are padded deliberately - the crest
sits small on its stadium background via `FOOTBALL_CREST_ART`, and hand-trimming crests is
exactly what broke Inter, Bayern/Roma and PSG. Never "fix" a team's padding.

With `--sheet` it renders each person across the hero / catalog / circle aspect ratios into
one PNG. **Read that PNG.** You are looking for: a cropped head or hand, a subject smaller
than ~60% of the card, and a subject glued to an edge.

Then verify in the running app - the script models the geometry, the app is the truth:

```bash
curl -s "http://localhost:3100/api/revalidate?secret=$NEXT_SECRET_REVALIDATION_SECRET"
```

ISR caches art for an hour, so **always revalidate before judging a change** - otherwise you
are looking at the previous asset. Same call against production after a data fix.

## Fixing a padded / oversized asset

Trim to the solid-alpha bbox, cap the long edge at 2400 px, upload to `templates`
(never add new files to the frozen `art_blobs` bucket), then repoint the row and reset its
dials to `art_image_scale = 1`, `art_image_offset_x = 0`, `art_image_offset_y = 0`.
Keep the old file - it makes the change revertible.

## Cross-project

Upload path and dials live in the backoffice (`components/art-blob-picker.tsx`,
Templates → artists / football teams). A rendering rule changed here usually has a mirror
there - see `@.claude/rules/cross-project.md`.
