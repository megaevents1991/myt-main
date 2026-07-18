"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * #21 — image gallery on an artist / team page. Backoffice-managed (Supabase
 * `gallery` jsonb: an array of image URLs). Grid + simple lightbox. Renders
 * nothing when empty.
 */
export const ArtistGallery = ({ images }: { images?: string[] }) => {
  const items = (images ?? []).filter(Boolean);
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;

  const close = () => setOpen(null);
  const move = (d: number) =>
    setOpen((i) => (i === null ? i : (i + d + items.length) % items.length));

  return (
    <section
      className="container mx-auto px-4 py-12"
      dir="rtl"
      aria-labelledby="gallery-heading"
    >
      <h2
        id="gallery-heading"
        className="mb-6 font-display text-2xl font-extrabold text-foreground"
      >
        גלריה
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`פתח תמונה ${i + 1}`}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="סגור"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="size-6" aria-hidden />
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); move(-1); }}
                aria-label="הקודם"
                className="absolute right-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); move(1); }}
                aria-label="הבא"
                className="absolute left-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
            </>
          )}
          <div
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={items[open]}
              alt=""
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
};
