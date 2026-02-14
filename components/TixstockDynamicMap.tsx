"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type TixStockListing,
  centerSectionLabels,
  cleanupDuplicateSections,
  doesTicketMatchAnyMapSection,
  getCategoryIdFromSectionEl,
  isCategoryOnlyTicket,
  isTicketMatchingCategory,
  isTicketMatchingSection,
  paintSection,
  sanitizeAndPrepareSvg,
} from "@/lib/tixstock-map";
import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  /** URL to the SVG venue map (e.g. tixstock S3 URL) */
  mapUrl: string;
  /** All available TixStock-shaped tickets */
  tickets: TixStockListing[];
  /** Ticket the user is currently hovering over in the list */
  hoveredTicket: TixStockListing | null;
  /** The currently-selected ticket (from the ticket list) */
  selectedTicketId: string | null;
  /** Callback when the user clicks a section — receives the best matching ticket ID */
  onTicketSelect?: (ticketId: string) => void;
  /** Called with the set of ticket IDs that have a map match */
  onMatchedTicketIds?: (ids: Set<string>) => void;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TixstockDynamicMap({
  mapUrl,
  tickets,
  hoveredTicket,
  selectedTicketId,
  onTicketSelect,
  onMatchedTicketIds,
}: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Monotonically increasing counter – bumped every time the ref callback
  // fires (container div is mounted).  Used as a dependency in effects
  // that need to know "the DOM node is ready".
  const [domReady, setDomReady] = useState(0);

  /** Callback ref: fires synchronously when React attaches the div. */
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) setDomReady((n) => n + 1);
  }, []);

  /* ---------- 1. SVG parsing from URL --------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadSvg() {
      if (!mapUrl) {
        setSvgContent(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(mapUrl);
        if (!res.ok) throw new Error(`Failed to load map (${res.status})`);
        const raw = await res.text();
        const prepared = sanitizeAndPrepareSvg(raw);
        if (!cancelled) {
          setSvgContent(prepared);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[TixstockDynamicMap] SVG load error:", err);
          setError("Failed to load venue map");
          setSvgContent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSvg();
    return () => {
      cancelled = true;
    };
  }, [mapUrl]);

  /* ---------- 2 + 3 + 4. Painting & match reporting ------------------- */

  /** Extracted painting logic so it can be called from effects */
  const repaint = useCallback(() => {
    const root = containerRef.current;
    if (!root || !svgContent) return;

    // 2. Duplicate section cleanup (idempotent)
    cleanupDuplicateSections(root);

    // Centre section labels on their parent shapes (idempotent).
    // Must run after DOM mount so getBBox() works.
    centerSectionLabels(root);

    const sectionEls = Array.from(root.querySelectorAll("[data-section]"));

    // Reset all sections to their base colours
    sectionEls.forEach((el) => paintSection(el, "base"));

    // 7. Colour sections: available (has tickets) or inactive (light border only)
    sectionEls.forEach((el) => {
      const secId = el.getAttribute("data-section") || "";
      const catId = getCategoryIdFromSectionEl(el);

      const hasMatchingTicket = tickets.some((t) => {
        if (isCategoryOnlyTicket(t)) {
          return !!catId && isTicketMatchingCategory(t, catId);
        }
        return isTicketMatchingSection(t, secId, catId);
      });

      if (hasMatchingTicket) {
        paintSection(el, "available");
      } else {
        paintSection(el, "inactive");
      }
    });

    // 4. Highlight the section of the currently selected ticket
    if (selectedTicketId) {
      const selTicket = tickets.find((t) => t.id === selectedTicketId);
      if (selTicket) {
        sectionEls.forEach((el) => {
          const sec = el.getAttribute("data-section") || "";
          const cat = getCategoryIdFromSectionEl(el);

          const match = isCategoryOnlyTicket(selTicket)
            ? !!cat && isTicketMatchingCategory(selTicket, cat)
            : isTicketMatchingSection(selTicket, sec, cat);

          if (match) paintSection(el, "selected");
        });
      }
    }

    // Hover highlight (overrides selection)
    if (hoveredTicket) {
      sectionEls.forEach((el) => {
        const sec = el.getAttribute("data-section") || "";
        const cat = getCategoryIdFromSectionEl(el);

        const match = isCategoryOnlyTicket(hoveredTicket)
          ? !!cat && isTicketMatchingCategory(hoveredTicket, cat)
          : isTicketMatchingSection(hoveredTicket, sec, cat);

        if (match) paintSection(el, "hover");
      });
    }
  }, [svgContent, hoveredTicket, selectedTicketId, tickets]);

  // Paint synchronously before the browser renders the frame so the
  // user never sees the raw/unstyled SVG.  `useLayoutEffect` blocks
  // the browser paint until it finishes; combined with the callback
  // ref `containerRef.current` is guaranteed to be set by now.
  useLayoutEffect(() => {
    repaint();

    // After the first successful paint, make the container visible.
    const root = containerRef.current;
    if (root && svgContent) {
      root.style.visibility = "visible";
    }
  }, [repaint, domReady]);

  // Report which tickets have a map match
  useEffect(() => {
    const root = containerRef.current;
    if (root && svgContent && onMatchedTicketIds) {
      const matched = new Set<string>();
      for (const t of tickets) {
        if (doesTicketMatchAnyMapSection(t, root)) matched.add(t.id);
      }
      onMatchedTicketIds(matched);
    }
  }, [svgContent, tickets, onMatchedTicketIds, domReady]);

  /* ---------- Click handler: select the best matching ticket ----------- */

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const sectionId = sectionEl.getAttribute("data-section") || "";
      const categoryId = getCategoryIdFromSectionEl(sectionEl);

      // Find the best matching ticket:
      // 1st priority: ticket with matching section (+ category if available)
      // 2nd priority: category-only ticket matching the category
      let bestMatch: TixStockListing | null = null;

      for (const t of tickets) {
        if (!isCategoryOnlyTicket(t) && isTicketMatchingSection(t, sectionId, categoryId)) {
          // Section match — pick it (prefer cheapest)
          if (!bestMatch || isCategoryOnlyTicket(bestMatch) ||
              (t.proceed_price ?? Infinity) < (bestMatch.proceed_price ?? Infinity)) {
            bestMatch = t;
          }
        } else if (
          isCategoryOnlyTicket(t) &&
          categoryId &&
          isTicketMatchingCategory(t, categoryId) &&
          !bestMatch // only use category-only as fallback
        ) {
          bestMatch = t;
        }
      }

      if (bestMatch && onTicketSelect) {
        onTicketSelect(bestMatch.id);
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [tickets, svgContent, onTicketSelect]);

  /* ---------- Pointer-hover on the SVG map itself ---------------------- */

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onMouseOver = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const secId = sectionEl.getAttribute("data-section") || "";
      const catId = getCategoryIdFromSectionEl(sectionEl);

      const hasTicket = tickets.some((t) => {
        if (isCategoryOnlyTicket(t))
          return !!catId && isTicketMatchingCategory(t, catId);
        return isTicketMatchingSection(t, secId, catId);
      });

      if (hasTicket) {
        paintSection(sectionEl, "hover");
      }
    };

    const onMouseOut = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const secId = sectionEl.getAttribute("data-section") || "";
      const catId = getCategoryIdFromSectionEl(sectionEl);

      // Determine whether this section belongs to the currently selected ticket
      const selTicket = selectedTicketId
        ? tickets.find((t) => t.id === selectedTicketId)
        : null;
      const isSelected = selTicket
        ? isCategoryOnlyTicket(selTicket)
          ? !!catId && isTicketMatchingCategory(selTicket, catId)
          : isTicketMatchingSection(selTicket, secId, catId)
        : false;

      if (isSelected) {
        paintSection(sectionEl, "selected");
      } else {
        // Check if it has tickets → show available colour, otherwise base
        const hasTicket = tickets.some((t) => {
          if (isCategoryOnlyTicket(t))
            return !!catId && isTicketMatchingCategory(t, catId);
          return isTicketMatchingSection(t, secId, catId);
        });
        if (hasTicket) {
          paintSection(sectionEl, "available");
        } else {
          paintSection(sectionEl, "base");
        }
      }
    };

    root.addEventListener("mouseover", onMouseOver);
    root.addEventListener("mouseout", onMouseOut);
    return () => {
      root.removeEventListener("mouseover", onMouseOver);
      root.removeEventListener("mouseout", onMouseOut);
    };
  }, [tickets, svgContent, selectedTicketId]);

  /* ---------- Render --------------------------------------------------- */

  if (!mapUrl) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="mr-2 text-gray-500">טוען מפת אירוע...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        {error}
      </div>
    );
  }

  if (!svgContent) return null;

  return (
    <div className="w-full">
      <div
        ref={setContainerRef}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ visibility: "hidden" }}
        className="rounded-lg overflow-hidden [&_svg]:w-full [&_svg]:h-auto"
      />
    </div>
  );
}
