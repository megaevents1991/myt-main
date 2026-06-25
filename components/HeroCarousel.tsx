"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";
import { EventArt } from "@/components/ui/EventArt";
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
const BOX_REFLECT_DESKTOP =
  "below 2px linear-gradient(transparent 58%, rgba(0,0,0,0.42))";

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

  // Include artists with either a plain hero image OR blob card-art set in the
  // backoffice (an artist may have only the cut-out + blob, no flat image).
  const items = useMemo(
    () =>
      artists.filter(
        (a) => a.fields.heroBanner?.fields?.file?.url || a.fields.artImageUrl
      ),
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

  // `current` is unbounded (we reduce mod N for content) so stepping never hits
  // an edge — the ring is infinite in both directions.
  const [current, setCurrent] = useState(logoIndex);
  const [cardW, setCardW] = useState(176);
  const [isDesktop, setIsDesktop] = useState(false);
  const [drag, setDrag] = useState(0); // live px offset while pointer-dragging

  const dragging = useRef(false);
  const moved = useRef(false);
  const dragStart = useRef(0);
  const dragRef = useRef(0); // live sub-card drag remainder (px)
  const interacted = useRef(false);

  const baseStep = cardW * STEP_FRAC;
  // More side cards on desktop to fill the width; fewer on mobile.
  const side = Math.min(isDesktop ? 4 : SIDE_MAX, Math.max(0, Math.floor((N - 1) / 2)));
  const reflect = isDesktop ? BOX_REFLECT_DESKTOP : BOX_REFLECT;

  // Shortest signed distance from `current` to card `i` around the ring.
  const deltaOf = useCallback(
    (i: number) => {
      const m = (((i - current) % N) + N) % N;
      return m > N / 2 ? m - N : m;
    },
    [current, N]
  );

  // Card width tracks the responsive size (w-44 → w-56 → w-64) so baseStep and
  // the visible side count match the rendered card.
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setIsDesktop(w >= 1024);
      setCardW(w >= 1024 ? 256 : w >= 640 ? 224 : 176);
    };
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
    // Mouse/pen ONLY: capture so a drag keeps tracking if the cursor leaves the
    // stage. NEVER capture a touch pointer — WebKit/iOS has a long-standing bug
    // where setPointerCapture on an ancestor for a touch pointer makes pointermove
    // silently STOP firing (gotpointercapture lies). That is what froze the swipe
    // on iPhone. Touch already has working *implicit* capture on its own target,
    // so moves keep bubbling here; `touch-action: pan-y` lets vertical scroll pass.
    // https://github.com/openseadragon/openseadragon/issues/1962
    if (e.pointerType !== "touch") e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    let dx = e.clientX - dragStart.current;
    // Mark a real drag (vs a tap) so the onClickCapture guard swallows the
    // post-swipe click but lets a tap through.
    if (!moved.current && Math.abs(dx) > 4) moved.current = true;
    if (!moved.current) return;
    // Step `current` as the finger crosses each card-width and keep only the
    // sub-card remainder as the live offset — so the strip scrolls card-by-card
    // under the finger and never slides off-screen.
    let steps = 0;
    while (dx <= -baseStep) {
      steps += 1;
      dx += baseStep;
    }
    while (dx >= baseStep) {
      steps -= 1;
      dx -= baseStep;
    }
    if (steps) setCurrent((c) => c + steps);
    dragStart.current = e.clientX - dx; // origin follows, remainder stays live
    dragRef.current = dx;
    setDrag(dx);
  };
  const endDrag = (e?: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    // Release the capture taken in pointerdown. Touch auto-releases on pointerup,
    // but mouse/pen don't — without this the next desktop click is misrouted.
    if (e && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const steps = Math.round(-dragRef.current / baseStep); // remainder → 0 or ±1
    dragRef.current = 0;
    setDrag(0);
    if (steps) setCurrent((c) => c + steps);
  };

  if (N === 0) return null;

  const renderInner = (card: Card, centered: boolean) => {
    if (card.kind === "logo") {
      return (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-secondary shadow-card"
          style={{ WebkitBoxReflect: reflect } as React.CSSProperties}
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
    const name = String(artist.fields.name ?? "");
    const artImageUrl = artist.fields.artImageUrl;
    const heroUrl = artist.fields.heroBanner?.fields?.file?.url
      ? "https:" + artist.fields.heroBanner.fields.file.url
      : undefined;
    return (
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-3xl",
          // EventArt brings its own dark surface; only tint when showing a flat image.
          !artImageUrl && blobColors[idx % blobColors.length]
        )}
        style={{ WebkitBoxReflect: reflect } as React.CSSProperties}
      >
        {artImageUrl ? (
          <EventArt
            id={artist.sys.id}
            imageUrl={artImageUrl}
            alt={name}
            colorIndex={artist.fields.artColorIndex}
            shapeIndex={artist.fields.artShapeIndex}
            blobFit="contain"
            imageClassName="scale-[1.4] origin-bottom"
            hoverZoom={false}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <Image
            src={heroUrl!}
            alt={name}
            fill
            sizes="(max-width: 640px) 11rem, (max-width: 1024px) 14rem, 16rem"
            className="object-cover object-bottom"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent"
        />
        <span className="absolute inset-x-2 bottom-12 truncate text-center text-base font-bold text-white drop-shadow lg:bottom-14 lg:text-xl">
          {name}
        </span>
        {/* Only the CTA navigates — clicking the card art never does. */}
        <Link
          href={`/artists/${artist.sys.id}`}
          aria-label={`עמוד האומן ${name}`}
          tabIndex={centered ? 0 : -1}
          draggable={false}
          className={cn(
            "absolute inset-x-0 bottom-3 mx-auto flex w-max items-center gap-1 rounded-full bg-secondary px-4 py-1.5 text-xs font-bold text-black shadow transition-all duration-300 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:bottom-4 lg:px-5 lg:py-2 lg:text-sm",
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
    "absolute top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-card transition-all hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex md:opacity-0 md:group-hover:opacity-100 lg:size-12";

  return (
    <div className="group relative">
      {/* Left chevron — brings the card on the left toward center. */}
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="האירועים הקודמים"
        className={cn(arrowBtn, "left-2 sm:left-6")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {/* Right chevron — brings the card on the right toward center. */}
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="האירועים הבאים"
        className={cn(arrowBtn, "right-2 sm:right-6")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>

      <div
        ref={stageRef}
        className="relative h-[340px] w-full cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing sm:h-[420px] lg:h-[480px]"
        style={{
          perspective: "1400px",
          perspectiveOrigin: "center",
          // Radial vignette so the gallery melts into the hero on every edge.
          maskImage:
            "radial-gradient(118% 80% at 50% 46%, #000 46%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(118% 80% at 50% 46%, #000 46%, transparent 100%)",
        }}
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
          const reduced = reducedRef.current;
          // Continuous position in card-units, including the live drag — so the
          // 3D interpolates smoothly during a swipe (a real slide) instead of
          // popping at each card boundary. Stepping still recycles cards.
          const pos = reduced ? d : d + drag / baseStep;
          const apos = Math.abs(pos);
          const visible = apos <= side + 0.5;
          const x = d * baseStep + drag;
          const rotateY = reduced ? 0 : -Math.sign(pos) * Math.min(apos, 1) * ROTATE;
          const translateZ = reduced ? 0 : -Math.min(apos, side) * 60;
          const scale = reduced
            ? apos < 0.5
              ? 1
              : 0.88
            : Math.max(CENTER_SCALE - apos * 0.18, 0.6);
          const opacity = !visible ? 0 : Math.max(1 - apos * 0.26, 0.22);
          const zIndex = Math.round(100 - apos * 10);
          return (
            <div
              key={i}
              data-card
              data-index={i}
              role="listitem"
              aria-hidden={!visible}
              className={cn(
                "absolute left-1/2 top-1/2 h-64 w-44 will-change-transform [backface-visibility:hidden] sm:h-80 sm:w-56 lg:h-96 lg:w-64",
                // No transition while dragging (track the finger) or for the
                // far cards that wrap around the ring (avoid a cross-screen slide).
                !dragging.current && visible &&
                  "transition-[transform,opacity] duration-500 ease-out"
              )}
              style={{
                transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex,
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
