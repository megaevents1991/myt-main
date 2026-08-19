import Link from "next/link";
import type { ReactNode } from "react";

import { TrustBadges } from "@/components/ui/TrustBadges";

/**
 * Cover of a vertical hub (/c/football) or a league page.
 *
 * NOT the homepage: no search bar, no full-height stage. The cover's job is to
 * say what this vertical holds and drop you into it, so it is content-sized and
 * carries the marketing lede itself (that text used to sit in a mid-page block
 * nobody scrolled to).
 *
 * The ground is a floodlit night-stadium: warm light from the top corners and
 * the center-circle/penalty-area geometry drawn as hairlines - the same visual
 * world as the crest cards that follow, so the page reads as one stadium.
 */
export function HubCover({
  eyebrow,
  title,
  titleAccent,
  lede,
  stats,
  primaryCta,
  secondaryCta,
  strip,
  motif = "pitch",
}: {
  /** Small label above the headline - the vertical / competition. */
  eyebrow: string;
  title: string;
  /** Second headline line, rendered in the brand mint. */
  titleAccent?: string;
  lede?: ReactNode;
  /** Fixture-board strip: what is actually bookable right now. */
  stats?: { value: string; label: string }[];
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  /** Full-width row (crest chips) rendered INSIDE the cover, on the same
   * floodlit ground - no seam between hero and carousel. */
  strip?: ReactNode;
  /** Ground geometry: football pitch lines or concentric stage/sound arcs. */
  motif?: "pitch" | "stage";
}) {
  return (
    <section
      id="detail-hero"
      className="relative isolate overflow-hidden bg-main px-4 pb-10 pt-24 text-main-foreground md:px-6 md:pb-12 md:pt-28"
      role="banner"
      dir="rtl"
    >
      {/* Floodlights: two warm cones from the top corners + a ground haze. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 18% -10%, hsl(150 60% 62% / 0.28), transparent 70%)," +
            "radial-gradient(60% 55% at 82% -10%, hsl(150 60% 62% / 0.22), transparent 70%)," +
            "radial-gradient(90% 60% at 50% 108%, hsl(160 55% 24% / 0.55), transparent 72%)",
        }}
      />
      {/* Ground geometry, hairline + bottom-anchored: pitch lines for football,
          concentric stage/sound arcs for music. */}
      <svg
        aria-hidden
        viewBox="0 0 800 300"
        preserveAspectRatio="xMidYMax slice"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 w-full text-main-foreground/[0.07] md:h-64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {motif === "pitch" ? (
          <>
            <circle cx="400" cy="300" r="120" />
            <circle cx="400" cy="300" r="4" fill="currentColor" stroke="none" />
            <path d="M180 300v-70h440v70" />
            <path d="M300 300v-28h200v28" />
          </>
        ) : (
          <>
            <circle cx="400" cy="300" r="60" />
            <circle cx="400" cy="300" r="120" />
            <circle cx="400" cy="300" r="180" />
            <circle cx="400" cy="300" r="240" />
            <circle cx="400" cy="300" r="4" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>

      <div className="container mx-auto max-w-4xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary">
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          {title}
          {titleAccent && (
            <span className="mt-1 block text-secondary">{titleAccent}</span>
          )}
        </h1>

        {lede && (
          <div className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-main-foreground/80 md:text-lg">
            {lede}
          </div>
        )}

        {/* Fixture board - hairline-divided counts, tabular so they don't jitter. */}
        {stats && stats.length > 0 && (
          <dl className="mx-auto mt-7 flex max-w-lg items-stretch justify-center divide-x divide-x-reverse divide-main-foreground/15">
            {stats.map((s) => (
              <div key={s.label} className="flex-1 px-4">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-display text-2xl font-bold tabular-nums md:text-3xl">
                    {s.value}
                  </span>
                  <span className="mt-0.5 block text-xs text-main-foreground/60">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={primaryCta.href}
            className="rounded-full bg-secondary px-7 py-3 font-bold text-main shadow-[0_10px_30px_-10px_hsl(var(--brand-mint)/0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            {primaryCta.label}
          </Link>
          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="rounded-full border border-main-foreground/25 px-7 py-3 font-bold transition-colors hover:bg-main-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>

        <TrustBadges className="mt-8 justify-center text-main-foreground/70" />
      </div>

      {strip && <div className="container mx-auto mt-10">{strip}</div>}
    </section>
  );
}
