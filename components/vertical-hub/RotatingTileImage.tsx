"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Crossfading background for a picker tile (יעדים) - cycles through the
 * category's tile_images. Only the previous/current/next frames stay mounted
 * so a 12-tile grid doesn't fetch 48 photos up front; reduced-motion (and a
 * single image) renders the first frame static. `offsetMs` staggers tiles so
 * the grid doesn't blink in unison.
 */
export const RotatingTileImage = ({
  images,
  alt,
  offsetMs = 0,
  intervalMs = 5000,
  sizes = "(max-width: 640px) 45vw, 400px",
}: {
  images: string[];
  alt: string;
  offsetMs?: number;
  intervalMs?: number;
  sizes?: string;
}) => {
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setAnimate(true);
    let interval: ReturnType<typeof setInterval> | undefined;
    const kickoff = setTimeout(() => {
      interval = setInterval(
        () => setIdx((i) => (i + 1) % images.length),
        intervalMs,
      );
      setIdx((i) => (i + 1) % images.length);
    }, offsetMs + intervalMs);
    return () => {
      clearTimeout(kickoff);
      if (interval) clearInterval(interval);
    };
  }, [images.length, intervalMs, offsetMs]);

  if (!images.length) return null;

  const n = images.length;
  // Previous frame fades out, current fades in, next preloads invisibly.
  const mounted = animate
    ? [...new Set([(idx - 1 + n) % n, idx, (idx + 1) % n])]
    : [0];

  return (
    <div className="absolute inset-0">
      {mounted.map((i) => (
        <Image
          key={images[i]}
          src={images[i]}
          alt={i === idx ? alt : ""}
          aria-hidden={i !== idx}
          fill
          sizes={sizes}
          loading={i === 0 ? undefined : "lazy"}
          className={cn(
            "object-cover transition-opacity duration-1000",
            i === idx ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
};
