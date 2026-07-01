"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Artist } from "@/lib/app.types";
import { MYT } from "@/components/ui/myt";
import { MYTMark } from "@/components/ui/mytMark";
import { EventArt } from "@/components/ui/EventArt";
import { cn } from "@/lib/utils";

// Coverflow tuning.
const SIDE_MAX = 3; // cards shown each side of center (rest fade out)
const STEP_FRAC = 0.56; // gap between card centers, as a fraction of card width
const ROTATE = 46; // side-card Y rotation (deg)
const CENTER_SCALE = 1.06;

// Momentum fling — release with speed → a roulette-style glide that decelerates
// and snaps to the nearest card (velocity is in px/ms; +x = finger moving right).
const FLING_MIN_V = 0.22; // below this, a release just snaps to nearest (no spin)
const FLING_FRICTION = 0.0035; // per-ms exponential velocity decay (lower = glides longer)
const FLING_STOP_V = 0.02; // momentum ends here → final snap to nearest card
const FLING_MAX_CARDS = 20; // cap travel so a hard flick can't over-spin a small ring

// Reflection cast under each card. DESKTOP ONLY: on mobile WebKit the card is a
// composited 3D layer (will-change + translateZ + backface-visibility) and
// `-webkit-box-reflect` gets dropped once the layer is promoted to the GPU — the
// reflection flashes for one frame then vanishes. So we omit it on mobile (as
// Firefox already does on every platform) and keep it on desktop Blink.
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
  const dragStartY = useRef(0); // pointer Y at grab — for axis-lock
  const axisLock = useRef<"x" | "y" | null>(null); // gesture direction, decided once
  const dragRef = useRef(0); // live sub-card drag remainder (px)
  const interacted = useRef(false);

  // Momentum-fling state: velocity sampling during the drag + the running rAF.
  const flinging = useRef(false); // true while a release is gliding to rest
  const momentumRaf = useRef(0); // requestAnimationFrame id of the glide loop
  const velocity = useRef(0); // smoothed pointer velocity (px/ms) at release
  const lastX = useRef(0); // last sampled clientX (for velocity)
  const lastT = useRef(0); // last sample timestamp (ms, same clock as rAF)

  const baseStep = cardW * STEP_FRAC;
  // More side cards on desktop to fill the width; fewer on mobile.
  const side = Math.min(isDesktop ? 4 : SIDE_MAX, Math.max(0, Math.floor((N - 1) / 2)));
  const reflect = isDesktop ? BOX_REFLECT_DESKTOP : undefined;

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
    // Any new input (grab, arrow, tap) halts a glide in progress — grab to stop,
    // like catching a spinning roulette.
    if (momentumRaf.current) {
      cancelAnimationFrame(momentumRaf.current);
      momentumRaf.current = 0;
    }
    flinging.current = false;
  }, []);

  // Cancel a glide still running when the gallery unmounts.
  useEffect(
    () => () => {
      if (momentumRaf.current) cancelAnimationFrame(momentumRaf.current);
    },
    []
  );

  // Hard axis-lock for touch. `touch-action: pan-y` lets the browser scroll the
  // page vertically — but on a DIAGONAL swipe that vertical component still
  // scrolled the page while the finger was trying to move the ring sideways
  // (the "slides up/down when I swipe left/right" bug). A pointer handler can't
  // stop that native scroll, so we attach a NON-PASSIVE touchmove that decides
  // the axis from the raw touch delta and preventDefaults once the gesture is
  // horizontal — killing the page scroll for the rest of that swipe. Vertical
  // gestures are left alone, so the page still scrolls normally off the ring.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let decided: "x" | "y" | null = null;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      decided = null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const adx = Math.abs(t.clientX - startX);
      const ady = Math.abs(t.clientY - startY);
      if (decided === null) {
        if (Math.max(adx, ady) < 8) return; // wait until intent is clear
        decided = adx > ady ? "x" : "y";
      }
      if (decided === "x") e.preventDefault(); // horizontal swipe → no page scroll
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
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
    // Anchor so the live offset carries over from any glide we just interrupted
    // (dragRef is 0 on a fresh grab, so this is `= e.clientX` in the common case).
    dragStart.current = e.clientX - dragRef.current;
    dragStartY.current = e.clientY;
    axisLock.current = null; // decide direction on the first real move
    // Reset velocity tracking for this gesture.
    velocity.current = 0;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
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
    // Axis-lock: decide once, after enough movement, whether this gesture is a
    // horizontal ring-swipe or a vertical page-scroll. A diagonal drag used to
    // move the ring AND scroll the page at once (the jitter). Now vertical
    // intent wins and the ring yields — the page just scrolls.
    if (axisLock.current === null) {
      const adx = Math.abs(dx);
      const ady = Math.abs(e.clientY - dragStartY.current);
      if (Math.max(adx, ady) < 8) return; // wait until intent is clear
      axisLock.current = ady > adx ? "y" : "x";
      moved.current = true; // real drag (not a tap) → swallow the trailing click
      if (axisLock.current === "y") return; // page scroll owns this gesture
    }
    if (axisLock.current === "y") return;
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
    // Sample velocity (smoothed) so a release can fling. A finger that pauses
    // before lifting decays toward 0 → no spin, which is what we want.
    const dt = e.timeStamp - lastT.current;
    if (dt > 0) {
      const sample = (e.clientX - lastX.current) / dt;
      velocity.current = velocity.current * 0.6 + sample * 0.4;
      lastX.current = e.clientX;
      lastT.current = e.timeStamp;
    }
  };
  const endDrag = (e?: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    // Release the capture taken in pointerdown. Touch auto-releases on pointerup,
    // but mouse/pen don't — without this the next desktop click is misrouted.
    if (e && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    // Fold the live remainder to the nearest card (no momentum). Used for a slow
    // release, a finger that paused before lifting, or reduced-motion.
    const snapToNearest = () => {
      const steps = Math.round(-dragRef.current / baseStep); // → 0 or ±1
      dragRef.current = 0;
      setDrag(0);
      if (steps) setCurrent((c) => c + steps);
    };

    let v = velocity.current;
    const paused = e ? e.timeStamp - lastT.current > 80 : false;
    if (reducedRef.current || paused || Math.abs(v) < FLING_MIN_V) {
      snapToNearest();
      return;
    }

    // Clamp speed so total glide distance (≈ v / friction) stays within the cap.
    const maxV = FLING_MAX_CARDS * baseStep * FLING_FRICTION;
    v = Math.max(-maxV, Math.min(maxV, v));

    // Roulette glide: decay velocity each frame, fold whole card-steps into
    // `current`, keep the sub-card remainder live in `drag` (same bookkeeping as
    // the drag handler), then snap to the nearest card when it slows to a stop.
    flinging.current = true;
    let carry = dragRef.current;
    let lastFrameT = e ? e.timeStamp : lastT.current;
    const frame = (t: number) => {
      const dt = Math.min(t - lastFrameT, 50); // clamp (e.g. backgrounded tab)
      lastFrameT = t;
      v *= Math.exp(-FLING_FRICTION * dt);
      carry += v * dt;
      let steps = 0;
      while (carry <= -baseStep) {
        steps += 1;
        carry += baseStep;
      }
      while (carry >= baseStep) {
        steps -= 1;
        carry -= baseStep;
      }
      if (steps) setCurrent((c) => c + steps);
      dragRef.current = carry;
      setDrag(carry);
      if (Math.abs(v) > FLING_STOP_V) {
        momentumRaf.current = requestAnimationFrame(frame);
      } else {
        flinging.current = false;
        momentumRaf.current = 0;
        snapToNearest(); // CSS transition eases the final settle
      }
    };
    momentumRaf.current = requestAnimationFrame(frame);
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
    const { artist } = card;
    const name = String(artist.fields.name ?? "");
    const artImageUrl = artist.fields.artImageUrl;
    const heroUrl = artist.fields.heroBanner?.fields?.file?.url
      ? "https:" + artist.fields.heroBanner.fields.file.url
      : undefined;
    // Aspect-independent fill so every card looks like the catalog cards. These
    // carousel cards are TALL portrait; the catalog cards are near-square. With
    // `contain` (the catalog default) a portrait box fits the cut-out to WIDTH, so
    // padded cut-outs shrink and float in the blob. Forcing `cover` scales the
    // cut-out to fill the card HEIGHT, bottom-anchored — the subject fills the card
    // the same way it does on the square catalog cards, regardless of card aspect
    // or each cut-out's framing. Blob stays `cover` (fills) at one constant size.
    const blob = Boolean(artImageUrl);
    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-3xl"
        style={{ WebkitBoxReflect: reflect } as React.CSSProperties}
      >
        <EventArt
          id={artist.sys.id}
          imageUrl={artImageUrl || heroUrl}
          alt={name}
          variant={blob ? "blob" : "photo"}
          colorIndex={artist.fields.artColorIndex}
          shapeIndex={artist.fields.artShapeIndex}
          // "cover" makes the cut-out fill the card and bleed to ALL edges (a wide
          // pose like Weeknd's arm runs off the card edge — never floats mid-card).
          imageFit="cover"
          // ⬇️ ARTIST ZOOM DIAL (person only — blob untouched), bottom-anchored.
          // 1 = cover fill, flush to the card edges. KEEP IT >= 1: pushing it ABOVE 1
          // zooms further IN (still edge-to-edge). Going BELOW 1 shrinks the image
          // inward so its edge floats in the MIDDLE of the card with blob beside it
          // (the gap you saw) — a finite cut-out can't be both smaller AND touch the
          // edge. First value = BLOB artists, second = flat photos. Literal values
          // only (scale-[1.1]…) — Tailwind compiles classes it sees as text.
          imageClassName={
            blob ? "scale-[0.9] origin-bottom" : "scale-[1] origin-bottom"
          }
          hoverZoom={false}
          // rounded-3xl on EventArt itself (not just the wrapper): iOS Safari won't
          // clip a GPU-promoted child to a transformed ANCESTOR's radius, so the
          // centered card showed square corners. Rounding the image's own
          // overflow-hidden node fixes it.
          className="absolute inset-0 h-full w-full rounded-3xl"
        />
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
                // No transition while dragging or mid-fling (rAF drives the
                // motion frame-by-frame), nor for the far cards that wrap around
                // the ring (avoid a cross-screen slide).
                !dragging.current && !flinging.current && visible &&
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
