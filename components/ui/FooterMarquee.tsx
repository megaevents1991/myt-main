import { MYT } from "@/components/ui/myt";

/**
 * Footer wordmark band — a slow horizontal marquee of the MegaEvents logo, as in
 * the Figma footer. Two identical tracks scroll seamlessly; the global
 * prefers-reduced-motion rule freezes it. Decorative, hidden from screen readers.
 */
export const FooterMarquee = () => {
  const Track = () => (
    <div className="flex shrink-0 items-center gap-12 pe-12">
      {Array.from({ length: 8 }).map((_, i) => (
        <MYT key={i} className="h-6 w-auto text-main-foreground/70 md:h-8" />
      ))}
    </div>
  );

  return (
    <div
      aria-hidden="true"
      // dir="ltr": the keyframes animate translateX(0 → -50%); in the page's RTL
      // flow the track scrolls out of the visible window and the band goes blank.
      dir="ltr"
      className="mb-8 flex w-full overflow-hidden border-y border-main-foreground/10 py-6"
    >
      <div
        className="flex w-max"
        style={{ animation: "marquee-scroll 40s linear infinite" }}
      >
        <Track />
        <Track />
      </div>
    </div>
  );
};
