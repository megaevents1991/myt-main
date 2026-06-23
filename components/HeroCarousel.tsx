"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";
import { cn } from "@/lib/utils";

// Bright blob backgrounds cycled across the cards.
const blobColors = [
  "bg-[#5BC8E8]",
  "bg-[#F0902F]",
  "bg-badge-soldout",
  "bg-primary",
  "bg-badge-vip",
  "bg-badge-new",
];

// Coverflow tuning.
const SIDE_MAX = 3; // cards shown each side of center (rest fade out)
const STEP_FRAC = 0.56; // gap between card centers, as a fraction of card width
const ROTATE = 46; // side-card Y rotation (deg)
const CENTER_SCALE = 1.06;

// Reflection cast under every card (WebKit/Blink; Firefox simply omits it).
const BOX_REFLECT = "below 1px linear-gradient(transparent 70%, rgba(0,0,0,0.28))";

type Card =
  | { kind: "artist"; artist: Artist; idx: number }
  | { kind: "logo" };

/**
 * Hero gallery — an index-based Swiper-style coverflow (modelled on the
 * `react-coverflow` engine). A single `current` index drives everything: each
 * card is positioned purely from `index - current` (shortest path around the
 * ring), so it's infinite, fully declarative, and has no DOM-measurement
 * feedback loop. The centered card faces the viewer (full size, lit, with a
 * CTA); neighbours rotate away in 3D, recede, shrink and dim.
 *
 * - Click a side card / dot / arrow to bring it to center; click the centered
 *   card to open it. Mouse drag-pans, vertical wheel steps through cards, touch
 *   swipes — all just change `current`. CSS transitions do the animating.
 * - Opens on the brand logo, then a single "peek" nudge advertises scrolling
 *   (cancels on first interaction). Reduced-motion skips the nudge + 3D.
 */
export const HeroCarousel = ({ artists }: { artists: Artist[] }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  const items = useMemo(
    () => artists.filter((a) => a.fields.heroBanner?.fields?.file?.url),
    [artists]
  );

  // One ring of cards — all artists, with the brand-logo card spliced into the
  // middle so the carousel opens on it.
  const cards = useMemo<Card[]>(() => {
    const out: Card[] = items.map((artist, idx) => ({
      kind: "artist" as const,
      artist,
      idx,
    }));
    out.splice(Math.floor(out.length / 2), 0, { kind: "logo" });
    return out;
  }, [items]);

  const N = cards.length;
  const logoIndex = cards.findIndex((c) => c.kind === "logo");
  const side = Math.min(SIDE_MAX, Math.max(0, Math.floor((N - 1) / 2)));

  // `current` is unbounded (we reduce mod N for content) so stepping never hits
  // an edge — the ring is infinite in both directions.
  const [current, setCurrent] = useState(logoIndex);
  const [cardW, setCardW] = useState(176);
  const [drag, setDrag] = useState(0); // live px offset while pointer-dragging

  const dragging = useRef(false);
  const moved = useRef(false);
  const dragStart = useRef(0);
  const interacted = useRef(false);

  const baseStep = cardW * STEP_FRAC;

  // Shortest signed distance from `current` to card `i` around the ring.
  const deltaOf = useCallback(
    (i: number) => {
      const m = (((i - current) % N) + N) % N;
      return m > N / 2 ? m - N : m;
    },
    [current, N]
  );

  // Card width tracks the responsive size (w-44 → w-56 at the sm breakpoint).
  useEffect(() => {
    const measure = () => setCardW(window.innerWidth >= 640 ? 224 : 176);
    measure();
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const stop = useCallback(() => {
    interacted.current = true;
  }, []);
  const step = useCallback(
    (dir: number) => {
      stop();
      setCurrent((c) => c + dir);
    },
    [stop]
  );
  const goToDelta = useCallback(
    (d: number) => {
      stop();
      if (d) setCurrent((c) => c + d);
    },
    [stop]
  );

  // One-time auto-loop on load: glide once around the whole ring (logo → every
  // card → back to the logo), advertising the gallery. Inputs are arrows + drag
  // (PC) / swipe (mobile) — no wheel, so nothing races this. Stops on the first
  // interaction; skipped under reduced-motion.
  useEffect(() => {
    if (reducedRef.current || N <= 1) return;
    let steps = 0;
    let interval = 0;
    const startT = window.setTimeout(() => {
      interval = window.setInterval(() => {
        if (interacted.current || steps >= N) {
          clearInterval(interval);
          return;
        }
        steps += 1;
        setCurrent((c) => c + 1);
      }, 750);
    }, 900);
    return () => {
      clearTimeout(startT);
      clearInterval(interval);
    };
  }, [N]);

  // --- Drag-to-pan (mouse + touch via pointer events) ---
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    dragStart.current = e.clientX;
    stop();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current;
    if (!moved.current && Math.abs(dx) > 4) {
      moved.current = true;
      // Capture only once a real drag begins, so a plain tap still delivers its
      // click to the card/CTA (capturing on down would swallow that click).
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (moved.current) setDrag(dx);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const steps = Math.round(-drag / baseStep);
    setDrag(0);
    if (steps) setCurrent((c) => c + steps);
  };

  if (N === 0) return null;

  const renderInner = (card: Card, centered: boolean) => {
    if (card.kind === "logo") {
      return (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-secondary shadow-card"
          style={{ WebkitBoxReflect: BOX_REFLECT } as React.CSSProperties}
          aria-label="מגה איבנטס"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(160_84%_39%/0.45),transparent_70%)] blur-2xl motion-safe:animate-[logo-breathe_6s_ease-in-out_infinite]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 -right-1/2 motion-reduce:hidden"
          >
            <span className="block h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md motion-safe:animate-[logo-sheen_4.5s_ease-in-out_infinite]" />
          </span>
          <div className="relative grid place-items-center">
            <MYT className="col-start-1 row-start-1 w-28 text-primary-foreground sm:w-36 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite]" />
            <MYTMark className="col-start-1 row-start-1 w-14 text-primary-foreground sm:w-16 opacity-0 motion-safe:animate-[logo-swap_7s_ease-in-out_infinite] motion-safe:[animation-delay:-3.5s]" />
          </div>
        </div>
      );
    }
    const { artist, idx } = card;
    const url = "https:" + artist.fields.heroBanner!.fields!.file!.url;
    const name = String(artist.fields.name ?? "");
    return (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-3xl",
          blobColors[idx % blobColors.length]
        )}
        style={{ WebkitBoxReflect: BOX_REFLECT } as React.CSSProperties}
      >
        <Image
          src={url}
          alt={name}
          fill
          sizes="(max-width: 640px) 11rem, 14rem"
          className="object-cover object-bottom"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent"
        />
        <span className="absolute inset-x-2 bottom-12 truncate text-center text-base font-bold text-white drop-shadow">
          {name}
        </span>
        {/* Only the CTA navigates — clicking the card art never does. */}
        <Link
          href={`/artists/${artist.sys.id}`}
          aria-label={`עמוד האומן ${name}`}
          tabIndex={centered ? 0 : -1}
          draggable={false}
          className={cn(
            "absolute inset-x-0 bottom-3 mx-auto flex w-max items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-xs font-bold text-black shadow transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            centered
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          )}
        >
          לאירועים
          <ChevronLeft className="size-3.5" aria-hidden />
        </Link>
      </div>
    );
  };

  const arrowBtn =
    "absolute top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex";

  return (
    <div className="relative">
      {/* Next (forward) — left side in RTL */}
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="האירועים הבאים"
        className={cn(arrowBtn, "left-2 sm:left-6")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {/* Prev — right side in RTL */}
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="האירועים הקודמים"
        className={cn(arrowBtn, "right-2 sm:right-6")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div
        ref={stageRef}
        className="relative h-[360px] w-full cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing sm:h-[460px]"
        style={{ perspective: "1400px", perspectiveOrigin: "center" }}
        role="list"
        aria-label="אירועים מובילים"
        aria-roledescription="carousel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {cards.map((card, i) => {
          const d = deltaOf(i);
          const adist = Math.abs(d);
          const visible = adist <= side;
          const reduced = reducedRef.current;
          const x = d * baseStep + drag;
          const rotateY = reduced || d === 0 ? 0 : d < 0 ? ROTATE : -ROTATE;
          const translateZ = reduced ? 0 : -Math.min(adist, side) * 60;
          const scale =
            d === 0
              ? CENTER_SCALE
              : reduced
              ? 0.88
              : Math.max(0.82 - (adist - 1) * 0.06, 0.62);
          const opacity = !visible
            ? 0
            : d === 0
            ? 1
            : Math.max(0.9 - (adist - 1) * 0.28, 0.25);
          return (
            <div
              key={i}
              data-card
              data-index={i}
              role="listitem"
              aria-hidden={!visible}
              className={cn(
                "absolute left-1/2 top-1/2 h-64 w-44 will-change-transform [backface-visibility:hidden] sm:h-80 sm:w-56",
                // No transition while dragging (track the finger) or for the
                // far cards that wrap around the ring (avoid a cross-screen slide).
                !dragging.current && visible &&
                  "transition-[transform,opacity] duration-500 ease-out"
              )}
              style={{
                transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex: 100 - adist,
                pointerEvents: visible ? "auto" : "none",
              }}
              onClickCapture={(e) => {
                if (moved.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  moved.current = false;
                  return;
                }
                if (d !== 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  goToDelta(d);
                }
              }}
            >
              {renderInner(card, d === 0)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
