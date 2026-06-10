import Image from "next/image";

import { cn } from "@/lib/utils";
import { EVENT_ART_COLORS, getEventArt, type EventArt as Art } from "@/lib/eventArt";

// Four brand "swoosh" shapes. Drawn in a 0 0 300 220 box and slice-fitted to the
// image area. Each is a bold organic wave echoing the MegaEvents wordmark.
const SHAPES: string[] = [
  "M-20 70 C70 10 120 150 200 90 C260 45 300 80 340 50 L340 240 L-20 240 Z",
  "M-20 120 C60 60 110 40 170 90 C230 140 280 70 340 110 L340 240 L-20 240 Z",
  "M-20 60 C40 130 120 60 180 120 C240 180 300 110 340 150 L340 240 L-20 240 Z",
  "M-20 100 C80 150 110 30 190 70 C250 100 300 160 340 90 L340 240 L-20 240 Z",
];

/**
 * Event card art: a dark panel with a neon brand swoosh behind the artist image
 * (the image should ideally be a transparent cut-out). Colour + shape are chosen
 * from the event id for now; pass colorIndex/shapeIndex to override (backoffice).
 */
export const EventArt = ({
  id,
  imageUrl,
  alt,
  className,
  colorIndex,
  shapeIndex,
  priority,
}: {
  id: string | number;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  colorIndex?: number;
  shapeIndex?: number;
  priority?: boolean;
}) => {
  const art = getEventArt(id, { colorIndex, shapeIndex });
  const color = EVENT_ART_COLORS[art.colorIndex];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[hsl(var(--surface-inverse))]",
        className
      )}
    >
      {/* Brand swoosh */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 300 220"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d={SHAPES[art.shapeIndex]} fill={`hsl(${color})`} />
      </svg>

      {/* Artist image on top of the swoosh */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          priority={priority}
          className="object-contain object-bottom transition-transform duration-300 group-hover:scale-105"
        />
      ) : null}
    </div>
  );
};
