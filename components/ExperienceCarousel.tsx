"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Fanned "coverflow" gallery shown near the end of an artist / team page.
 * Reuses the backoffice-managed `gallery` images (Supabase jsonb array of
 * URLs) — the active image sits upright in the centre while its neighbours are
 * rotated and tucked behind it like a spread deck. Click a side image (or the
 * arrows / swipe) to bring it to the centre. Renders nothing when empty.
 */
export const ExperienceCarousel = ({
  images,
  title = "החוויה שלכם — בידיים בטוחות",
  subtitle = "מלווים אתכם מהרגע הראשון ועד החזרה הביתה — כרטיסים, טיסות ומלון, הכל במקום אחד.",
}: {
  images?: string[];
  title?: string;
  subtitle?: string;
}) => {
  const items = (images ?? []).filter(Boolean);
  const [active, setActive] = useState(0);
  const dragX = useRef<number | null>(null);

  if (items.length === 0) return null;

  const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));
  const go = (d: number) => setActive((i) => clamp(i + d));

  // Pointer swipe — commit a step once the drag passes the threshold.
  const onDown = (e: React.PointerEvent) => {
    dragX.current = e.clientX;
  };
  const onUp = (e: React.PointerEvent) => {
    if (dragX.current === null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    // RTL: dragging left (negative dx) advances forward.
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  return (
    <section
      className="container mx-auto px-4 py-14"
      dir="rtl"
      aria-labelledby="experience-heading"
    >
      <div className="mb-8 text-center">
        <h2
          id="experience-heading"
          className="font-display text-2xl font-extrabold text-foreground sm:text-3xl"
        >
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      </div>

      <div
        className="relative mx-auto flex h-64 max-w-3xl touch-pan-y items-center justify-center [perspective:1200px] sm:h-80"
        onPointerDown={onDown}
        onPointerUp={onUp}
        role="group"
        aria-roledescription="carousel"
        aria-label="גלריית חוויה"
      >
        {items.map((src, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          const hidden = abs > 2;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`תמונה ${i + 1} מתוך ${items.length}`}
              aria-current={offset === 0}
              tabIndex={hidden ? -1 : 0}
              className={cn(
                "absolute left-1/2 top-1/2 aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] transition-all duration-500 ease-out will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none sm:w-52",
                offset === 0 ? "cursor-default" : "cursor-pointer",
                hidden && "pointer-events-none"
              )}
              style={{
                transform: `translate(-50%, -50%) translateX(${offset * 58}%) rotate(${offset * 7}deg) scale(${1 - abs * 0.12})`,
                zIndex: 20 - abs,
                opacity: hidden ? 0 : 1 - abs * 0.15,
              }}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 640px) 40vw, 208px"
                className="object-cover"
              />
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={active === 0}
          aria-label="הקודם"
          className="flex size-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-30"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="בחירת תמונה">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`מעבר לתמונה ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === active ? "w-6 bg-primary" : "w-2 bg-border hover:bg-foreground/30"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={active === items.length - 1}
          aria-label="הבא"
          className="flex size-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      </div>
    </section>
  );
};
