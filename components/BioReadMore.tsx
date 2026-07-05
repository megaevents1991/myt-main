"use client";

import { ReactNode, useState } from "react";

/**
 * Detail-hero bio: on mobile it collapses to the first sentence with a
 * "קרא עוד.." toggle; on desktop (sm+) the full bio is always shown. When there
 * is nothing to truncate (single-sentence bio) the toggle is omitted.
 */
export const BioReadMore = ({
  firstSentence,
  canExpand,
  full,
  className,
}: {
  firstSentence: string;
  canExpand: boolean;
  full: ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      {/* Mobile: collapsed to the first sentence until expanded, with a toggle
          to fold it back. */}
      <div className="sm:hidden">
        {!canExpand ? (
          full
        ) : open ? (
          <>
            {full}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-1 font-bold text-primary underline underline-offset-2"
            >
              הצג פחות
            </button>
          </>
        ) : (
          <p>
            {firstSentence}{" "}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-bold text-primary underline underline-offset-2"
            >
              קרא עוד..
            </button>
          </p>
        )}
      </div>
      {/* Desktop: always full. */}
      <div className="hidden sm:block">{full}</div>
    </div>
  );
};
