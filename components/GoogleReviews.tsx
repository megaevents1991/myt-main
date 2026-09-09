"use client";

import { useState } from "react";
import { Carousel } from "@mantine/carousel";
import { Modal } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/he";
import type { GoogleReview, GoogleReviewsData } from "@/lib/googleReviews";

dayjs.extend(relativeTime);

/**
 * "לקוחות משתפים" - the Google reviews carousel. A 1:1 rebuild of the Elfsight
 * widget we used until 2026-09-09 (carousel, header5, classic cards, min 5
 * stars, text-only) on our own data (lib/googleReviews.ts), so it follows the
 * site theme instead of needing CSS overrides, and never disappears behind a
 * view quota.
 *
 * Renders nothing when there is no data - the section simply drops out.
 */

const STAR = "#FCBF02";
const ACCENT = "#006DFF";

function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} מתוך 5 כוכבים`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
          fill={i < rating ? STAR : "none"}
          stroke={STAR}
          strokeWidth={i < rating ? 0 : 1.5}
        >
          <path d="M12 2.5l2.95 6.26 6.85.75-5.1 4.66 1.4 6.78L12 17.5l-6.1 3.45 1.4-6.78-5.1-4.66 6.85-.75L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

/** The four-colour Google "G". */
function GoogleG({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-label="מאומת" className="shrink-0">
      <path
        fill={ACCENT}
        d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"
      />
    </svg>
  );
}

function Avatar({ review }: { review: GoogleReview }) {
  const initial = review.authorName.trim().charAt(0) || "?";
  return (
    <span className="relative inline-block h-12 w-12 shrink-0">
      {review.authorPhotoUrl ? (
        // Google avatar URLs rotate and live on lh3.googleusercontent.com - a
        // plain <img> keeps them out of the next/image host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={review.authorPhotoUrl}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-bold text-foreground">
          {initial}
        </span>
      )}
      <span className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
        <GoogleG size={12} />
      </span>
    </span>
  );
}

function relativeHe(iso: string): string {
  return dayjs(iso).locale("he").fromNow(); // "לפני 4 ימים"
}

function ReviewCard({ review, onOpen }: { review: GoogleReview; onOpen: () => void }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-3xl border border-foreground/10 bg-transparent p-5 text-start">
      <header className="flex items-center gap-3">
        <Avatar review={review} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-base font-bold text-foreground">{review.authorName}</span>
            <VerifiedBadge />
          </div>
          <time dateTime={review.publishedAt} className="text-sm text-muted-foreground">
            {relativeHe(review.publishedAt)}
          </time>
        </div>
      </header>
      <Stars rating={review.rating} />
      <p className="line-clamp-3 whitespace-pre-line text-base leading-relaxed text-foreground">
        {review.text}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-auto self-start text-base font-medium hover:underline"
        style={{ color: ACCENT }}
      >
        קרא עוד
      </button>
    </article>
  );
}

export function GoogleReviews({ data }: { data: GoogleReviewsData | null | undefined }) {
  const [open, setOpen] = useState<GoogleReview | null>(null);
  if (!data || data.reviews.length === 0) return null;

  const rating = data.rating ?? 5;
  const header = (
    <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 px-4">
      <h2 className="text-center text-2xl font-bold text-foreground">לקוחות משתפים</h2>
      <a
        href={data.mapsUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2"
        aria-label={`דירוג ${rating.toFixed(1)} בגוגל, ${data.count ?? data.reviews.length} ביקורות - נפתח בחלון חדש`}
      >
        <GoogleG size={26} />
        <span className="text-2xl font-bold text-foreground" dir="ltr">
          {rating.toFixed(1)}
        </span>
        <Stars rating={Math.round(rating)} size={22} />
        <span className="text-sm text-muted-foreground" dir="ltr">
          ({data.count ?? data.reviews.length})
        </span>
      </a>
    </div>
  );

  return (
    <section aria-label="לקוחות משתפים" className="mx-auto w-full max-w-[1280px] py-10">
      {header}
      <div className="relative mt-8 px-4">
        <Carousel
          slideSize={{ base: "100%", sm: "50%", md: "33.333333%", lg: "25%" }}
          slideGap={20}
          align="start"
          containScroll="trimSnaps"
          withIndicators
          withControls={data.reviews.length > 1}
          // RTL page: embla flips the visual order, so the icons swap too.
          nextControlIcon={<ChevronLeft size={22} />}
          previousControlIcon={<ChevronRight size={22} />}
          classNames={{
            control:
              "!h-11 !w-11 !rounded-full !border-0 !bg-foreground/50 !text-background !opacity-100 hover:!bg-foreground data-[inactive]:!invisible",
            indicators: "!static !mt-6 !justify-center",
            indicator:
              "!h-2 !w-2 !rounded-full !bg-foreground/30 data-[active]:!bg-foreground",
          }}
          styles={{ viewport: { paddingBlock: 2 } }}
        >
          {data.reviews.map((review) => (
            <Carousel.Slide key={review.key}>
              <ReviewCard review={review} onOpen={() => setOpen(review)} />
            </Carousel.Slide>
          ))}
        </Carousel>
      </div>

      <Modal
        opened={open !== null}
        onClose={() => setOpen(null)}
        centered
        radius="lg"
        size="md"
        withCloseButton
        title={
          open ? (
            <span className="flex items-center gap-3">
              <Avatar review={open} />
              <span className="flex flex-col">
                <span className="flex items-center gap-1.5 font-bold">
                  {open.authorName}
                  <VerifiedBadge />
                </span>
                <span className="text-sm text-muted-foreground">{relativeHe(open.publishedAt)}</span>
              </span>
            </span>
          ) : null
        }
      >
        {open && (
          <div className="space-y-4 text-start">
            <Stars rating={open.rating} />
            <p className="whitespace-pre-line text-base leading-relaxed">{open.text}</p>
            {open.replyText && (
              <div className="rounded-2xl bg-muted p-4">
                <div className="mb-1 text-sm font-bold">תגובת מגה איבנטס</div>
                <p className="whitespace-pre-line text-sm leading-relaxed">{open.replyText}</p>
              </div>
            )}
            {open.reviewUrl && (
              <a
                href={open.reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-medium hover:underline"
                style={{ color: ACCENT }}
              >
                לביקורת בגוגל
              </a>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
