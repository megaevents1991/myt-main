"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type TixStockMatchableListing,
  categoryOnlyMatchesEl,
  centerSectionLabels,
  cleanupDuplicateSections,
  doesTicketMatchAnyMapSection,
  getCategoryIdFromSectionEl,
  isCategoryOnlyTicket,
  isTicketMatchingSection,
  paintSection,
  prePaintSvg,
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
  tickets: TixStockMatchableListing[];
  /** Ticket the user is currently hovering over in the list */
  hoveredTicket: TixStockMatchableListing | null;
  /** The currently-selected ticket (from the ticket list) */
  selectedTicketId: string | null;
  /** Callback when the user clicks a section — receives the best matching ticket ID */
  onTicketSelect?: (ticketId: string) => void;
  /** Called with the set of ticket IDs that have a map match */
  onMatchedTicketIds?: (ids: Set<string>) => void;
  /** Section IDs (data-section values) to render as disabled/excluded */
  excludedSections?: string[];
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
  excludedSections,
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
        const proxiedUrl = `/api/map-proxy?url=${encodeURIComponent(mapUrl)}`;
        const res = await fetch(proxiedUrl);
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

  /* ---------- Pre-paint SVG string before injection -------------------- */

  // Pre-paint the SVG string with ticket availability so the map is
  // correctly styled from the moment it enters the DOM.  This runs as
  // a pure computation (useMemo) — no dependency on effects or refs.
  const paintedSvg = useMemo(
    () => (svgContent ? prePaintSvg(svgContent, tickets, excludedSections) : null),
    [svgContent, tickets, excludedSections],
  );

  /* ---------- 2 + 3 + 4. Painting & match reporting ------------------- */

  /** Extracted painting logic so it can be called from effects */
  const repaint = useCallback(() => {
    const root = containerRef.current;
    if (!root || !svgContent) return;

    try {
      // Duplicate section cleanup (idempotent)
      cleanupDuplicateSections(root);

      // Centre section labels on their parent shapes (idempotent).
      // Defer to next animation frame so layout is committed and
      // getBBox() returns real geometry — otherwise on first mount
      // labels collapse to (0,0) and appear corrupted/missing.
      requestAnimationFrame(() => {
        if (containerRef.current) centerSectionLabels(containerRef.current);
      });

      const sectionEls = Array.from(root.querySelectorAll("[data-section]"));

      // Reset all sections to their base colours
      sectionEls.forEach((el) => paintSection(el, "base"));

      // Colour sections: disabled, available (has tickets), or inactive
      sectionEls.forEach((el) => {
        const secId = el.getAttribute("data-section") || "";

        // Excluded sections are always rendered as disabled
        if (excludedSections?.includes(secId)) {
          paintSection(el, "disabled");
          return;
        }

        const catId = getCategoryIdFromSectionEl(el);

        const hasMatchingTicket = tickets.some((t) => {
          if (isCategoryOnlyTicket(t)) {
            return categoryOnlyMatchesEl(t, secId, catId);
          }
          return isTicketMatchingSection(t, secId, catId);
        });

        if (hasMatchingTicket) {
          paintSection(el, "available");
        } else {
          paintSection(el, "inactive");
        }
      });

      // Highlight the section of the currently selected ticket
      if (selectedTicketId) {
        const selTicket = tickets.find((t) => t.id === selectedTicketId);
        if (selTicket) {
          sectionEls.forEach((el) => {
            const sec = el.getAttribute("data-section") || "";
            if (excludedSections?.includes(sec)) return; // never highlight disabled
            const cat = getCategoryIdFromSectionEl(el);

            const match = isCategoryOnlyTicket(selTicket)
              ? categoryOnlyMatchesEl(selTicket, sec, cat)
              : isTicketMatchingSection(selTicket, sec, cat);

            if (match) paintSection(el, "selected");
          });
        }
      }

      // Hover highlight (overrides selection)
      if (hoveredTicket) {
        sectionEls.forEach((el) => {
          const sec = el.getAttribute("data-section") || "";
          if (excludedSections?.includes(sec)) return; // never highlight disabled
          const cat = getCategoryIdFromSectionEl(el);

          const match = isCategoryOnlyTicket(hoveredTicket)
            ? categoryOnlyMatchesEl(hoveredTicket, sec, cat)
            : isTicketMatchingSection(hoveredTicket, sec, cat);

          if (match) paintSection(el, "hover");
        });
      }
    } catch (e) {
      console.error("[TixstockDynamicMap] repaint error:", e);
    }
  }, [svgContent, hoveredTicket, selectedTicketId, tickets, excludedSections]);

  // Run repaint for dynamic changes (selection, hover, label centering).
  // The initial available/inactive painting is already baked into
  // `paintedSvg`, so even if this effect is delayed the map looks correct.
  // `paintedSvg` is included so that when innerHTML is replaced (which
  // does NOT re-fire the ref callback), we still re-center labels and
  // re-apply runtime styles on the fresh nodes.
  useLayoutEffect(() => {
    repaint();
  }, [repaint, domReady, paintedSvg]);

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
      // Ignore clicks on excluded/disabled sections
      if (excludedSections?.includes(sectionId)) return;
      const categoryId = getCategoryIdFromSectionEl(sectionEl);

      // Find the best matching ticket:
      // 1st priority: ticket with matching section (+ category if available)
      // 2nd priority: category-only ticket matching the category
      let bestMatch: TixStockMatchableListing | null = null;

      for (const t of tickets) {
        if (!isCategoryOnlyTicket(t) && isTicketMatchingSection(t, sectionId, categoryId)) {
          // Section match — pick it (prefer cheapest)
          if (!bestMatch || isCategoryOnlyTicket(bestMatch) ||
              (t.proceed_price ?? Infinity) < (bestMatch.proceed_price ?? Infinity)) {
            bestMatch = t;
          }
        } else if (
          isCategoryOnlyTicket(t) &&
          categoryOnlyMatchesEl(t, sectionId, categoryId) &&
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
  }, [tickets, svgContent, onTicketSelect, excludedSections]);

  /* ---------- Pointer-hover on the SVG map itself ---------------------- */

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onMouseOver = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const secId = sectionEl.getAttribute("data-section") || "";
      // Don't hover-highlight excluded sections
      if (excludedSections?.includes(secId)) return;
      const catId = getCategoryIdFromSectionEl(sectionEl);

      const hasTicket = tickets.some((t) => {
        if (isCategoryOnlyTicket(t))
          return categoryOnlyMatchesEl(t, secId, catId);
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
      // Nothing to restore on excluded sections (they stay disabled)
      if (excludedSections?.includes(secId)) return;
      const catId = getCategoryIdFromSectionEl(sectionEl);

      // Determine whether this section belongs to the currently selected ticket
      const selTicket = selectedTicketId
        ? tickets.find((t) => t.id === selectedTicketId)
        : null;
      const isSelected = selTicket
        ? isCategoryOnlyTicket(selTicket)
          ? categoryOnlyMatchesEl(selTicket, secId, catId)
          : isTicketMatchingSection(selTicket, secId, catId)
        : false;

      if (isSelected) {
        paintSection(sectionEl, "selected");
      } else {
        // Check if it has tickets → show available colour, otherwise base
        const hasTicket = tickets.some((t) => {
          if (isCategoryOnlyTicket(t))
            return categoryOnlyMatchesEl(t, secId, catId);
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
  }, [tickets, svgContent, selectedTicketId, excludedSections]);

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

  if (!paintedSvg) return null;

  return (
    <div className="w-full" dir="ltr">
      <div
        ref={setContainerRef}
        dangerouslySetInnerHTML={{ __html: paintedSvg }}
        className="rounded-lg overflow-hidden [&_svg]:w-full [&_svg]:h-auto"
      />
    </div>
  );
}
