import Image from "next/image";

import { cn } from "@/lib/utils";
import { EVENT_ART_COLORS, getEventArt } from "@/lib/eventArt";

// Real blob shapes exported from the Figma brand file (public/brand/blob-*.svg),
// each in its own viewBox. Mirrored variants double the pool: 3 shapes × 2 = 6.
const BASE_SHAPES: { d: string; w: number; h: number }[] = [
  {
    // blob-1 — angular lightning swoosh (violet original)
    d: "M376.567 312.293L311.733 247.245L360.413 239.179C395.964 233.277 409.983 189.739 384.522 164.305L331.689 111.226L370.84 104.771C398.3 100.259 409.156 66.545 389.487 46.8578L338.009 -4.75832C316.883 -25.942 286.807 -35.6261 257.394 -30.7155L185.469 -18.8338C158.009 -14.3216 147.154 19.3922 166.822 39.0795L194.851 67.1655L120.973 79.4455C85.4226 85.3477 71.4037 128.886 96.8645 154.319L133.914 191.587L46.4259 206.105C1.962 213.474 -15.5866 267.975 16.2236 299.904L99.5124 383.449C133.647 417.724 182.326 433.398 230.047 425.48L346.435 406.228C390.829 398.722 408.377 344.222 376.567 312.293Z",
    w: 400,
    h: 358,
  },
  {
    // blob-2 — four-point star flow (mint original)
    d: "M311.49 43.3357C307.568 14.9081 259.771 22.7798 196.776 58.596C179.306 -13.6957 151.603 -55.2606 127.922 -38.2394C104.241 -21.2181 91.9314 49.1704 95.8559 131.198C35.6311 184.076 -5.24942 239.816 -1.34339 268.128C2.57858 296.556 50.3756 288.684 113.371 252.868C130.86 321.145 157.627 359.699 180.55 343.223C203.473 326.746 215.732 260.141 212.981 181.334C273.956 128.235 315.428 71.8789 311.49 43.3357Z",
    w: 311,
    h: 311,
  },
  {
    // blob-3 — wide cross bloom (aqua original)
    d: "M414.973 186.331C410.064 153.061 341.982 130.658 251.657 128.637C228.526 39.1825 190.141 -23.6711 156.104 -20.5852C122.066 -17.4994 102.938 50.637 106.6 141.856C19.8136 160.072 -39.5599 193.893 -34.6713 227.028C-29.7628 260.298 38.3197 282.701 128.644 284.723C151.896 369.849 189.021 428.842 221.97 425.855C254.918 422.868 273.886 358.789 271.815 271.811C359.673 253.841 419.901 219.737 414.973 186.331Z",
    w: 315,
    h: 315,
  },
];

// 0-2 = originals, 3-5 = mirrored
const SHAPES = [
  ...BASE_SHAPES.map((s) => ({ ...s, mirror: false })),
  ...BASE_SHAPES.map((s) => ({ ...s, mirror: true })),
];

// Photo backgrounds — shapeIndex 6-8, set explicitly in the backoffice picker
// (the deterministic default only picks 0-5). The cut-out sits on the photo
// instead of a neon blob. Files duplicated in the backoffice public folder.
const PHOTO_BACKGROUNDS = [
  "/art-backgrounds/cars.jpg",
  "/art-backgrounds/tennis.jpg",
  "/art-backgrounds/football.jpg",
];

/**
 * Event card art: a dark panel with a neon brand blob behind the artist image
 * (the image should ideally be a transparent cut-out). Colour + shape are chosen
 * from the event id; pass colorIndex/shapeIndex to override (backoffice fields).
 */
export const EventArt = ({
  id,
  imageUrl,
  alt,
  className,
  colorIndex,
  shapeIndex,
  priority,
  variant = "blob",
  blobFit = "cover",
  imageFit,
  imageClassName,
  hoverZoom = true,
}: {
  id: string | number;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  colorIndex?: number;
  shapeIndex?: number;
  priority?: boolean;
  /** "blob" = neon brand blob + cut-out artist (contain); "photo" = full image (cover). */
  variant?: "blob" | "photo";
  /**
   * How the blob fills the box. "cover" (default) slices to fill — right for
   * square/landscape cards. "contain" fits the whole blob at width-scale and
   * centers it — use on tall/portrait cards (e.g. the hero carousel) so the
   * blob doesn't zoom bigger than on the square cards.
   */
  blobFit?: "cover" | "contain";
  /**
   * How the cut-out image fills the box. Defaults follow `variant`
   * (blob → contain, photo → cover). Override to "cover" on portrait cards so a
   * cut-out with transparent margins fills the card instead of shrinking.
   */
  imageFit?: "cover" | "contain";
  /** Extra classes on the cut-out image — e.g. "scale-125 origin-bottom" to grow it. */
  imageClassName?: string;
  /**
   * Subtle zoom on parent `group` hover. On by default for cards. Turn OFF where
   * the whole region is one big `group` (e.g. the hero carousel) so the image
   * keeps one constant size and doesn't resize on hover.
   */
  hoverZoom?: boolean;
}) => {
  const fit = imageFit ?? (variant === "blob" ? "contain" : "cover");
  const art = getEventArt(id, { colorIndex, shapeIndex });
  const color = EVENT_ART_COLORS[art.colorIndex % EVENT_ART_COLORS.length];
  // Indices 6+ select a photo background instead of a blob shape.
  const photoBg =
    art.shapeIndex >= SHAPES.length
      ? PHOTO_BACKGROUNDS[(art.shapeIndex - SHAPES.length) % PHOTO_BACKGROUNDS.length]
      : null;
  const shape = SHAPES[art.shapeIndex % SHAPES.length];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[hsl(var(--surface-inverse))]",
        className
      )}
    >
      {variant === "blob" &&
        (photoBg ? (
          <Image
            src={photoBg}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 400px"
            aria-hidden="true"
            className="object-cover"
          />
        ) : (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${shape.w} ${shape.h}`}
            preserveAspectRatio={blobFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}
            aria-hidden="true"
          >
            <path
              d={shape.d}
              fill={`hsl(${color})`}
              transform={shape.mirror ? `translate(${shape.w},0) scale(-1,1)` : undefined}
            />
          </svg>
        ))}

      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          priority={priority}
          className={cn(
            "transition-transform duration-300",
            hoverZoom && "group-hover:scale-105",
            fit === "contain" ? "object-contain" : "object-cover",
            variant === "photo" ? "object-top" : "object-bottom",
            imageClassName
          )}
        />
      ) : null}
    </div>
  );
};
