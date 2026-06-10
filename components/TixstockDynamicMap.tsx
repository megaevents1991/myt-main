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
  cleanupDuplicateSections,
  doesTicketMatchAnyMapSection,
  getCategoryIdFromSectionEl,
  isCategoryOnlyTicket,
  isTicketMatchingSection,
  paintSection,
  prePaintSvg,
  sanitizeAndPrepareSvg,
  ticketCategoryMatchesEl,
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
  /** Ticket IDs that should be rendered as unavailable/disabled on the map */
  disabledTicketIds?: Set<string>;
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
  disabledTicketIds,
}: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMapTicket, setHoveredMapTicket] =
    useState<TixStockMatchableListing | null>(null);
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

  const ticketMatchesSection = useCallback(
    (
      ticket: TixStockMatchableListing,
      sectionId: string,
      categoryId: string | null,
    ) => {
      if (isCategoryOnlyTicket(ticket)) {
        return categoryOnlyMatchesEl(ticket, sectionId, categoryId);
      }
      return isTicketMatchingSection(ticket, sectionId, categoryId);
    },
    [],
  );

  const ticketCategoryOrSectionMatches = useCallback(
    (
      ticket: TixStockMatchableListing,
      sectionId: string,
      categoryId: string | null,
    ) =>
      ticketCategoryMatchesEl(ticket, sectionId, categoryId) ||
      ticketMatchesSection(ticket, sectionId, categoryId),
    [ticketMatchesSection],
  );

  const findBestTicketForSection = useCallback(
    (sectionId: string, categoryId: string | null) => {
      const enabledTickets = tickets.filter(
        (ticket) => !disabledTicketIds?.has(ticket.id),
      );

      const categoryMatches = enabledTickets.filter((ticket) =>
        ticketCategoryMatchesEl(ticket, sectionId, categoryId),
      );

      if (categoryMatches.length > 0) {
        return categoryMatches.reduce((best, ticket) =>
          (ticket.proceed_price ?? Infinity) < (best.proceed_price ?? Infinity)
            ? ticket
            : best,
        );
      }

      const sectionMatches = enabledTickets.filter((ticket) =>
        ticketMatchesSection(ticket, sectionId, categoryId),
      );

      if (sectionMatches.length === 0) return null;

      return sectionMatches.reduce((best, ticket) =>
        (ticket.proceed_price ?? Infinity) < (best.proceed_price ?? Infinity)
          ? ticket
          : best,
      );
    },
    [tickets, disabledTicketIds, ticketMatchesSection],
  );

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
    () =>
      svgContent
        ? prePaintSvg(svgContent, tickets, excludedSections, disabledTicketIds)
        : null,
    [svgContent, tickets, excludedSections, disabledTicketIds],
  );

  /* ---------- 2 + 3 + 4. Painting & match reporting ------------------- */

  /** Extracted painting logic so it can be called from effects */
  const repaint = useCallback(() => {
    const root = containerRef.current;
    if (!root || !svgContent) return;

    try {
      // Duplicate section cleanup (idempotent)
      cleanupDuplicateSections(root);

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

        const matchingTickets = tickets.filter((t) => {
          if (isCategoryOnlyTicket(t)) {
            return categoryOnlyMatchesEl(t, secId, catId);
          }
          return isTicketMatchingSection(t, secId, catId);
        });

        const hasEnabledTicket = matchingTickets.some(
          (t) => !disabledTicketIds?.has(t.id),
        );
        const hasDisabledTicket = matchingTickets.some((t) =>
          disabledTicketIds?.has(t.id),
        );

        if (hasEnabledTicket) {
          paintSection(el, "available");
        } else if (hasDisabledTicket) {
          paintSection(el, "disabled");
        } else {
          paintSection(el, "inactive");
        }
      });

      const activeHoverTicket = hoveredTicket ?? hoveredMapTicket;

      // Highlight the selected ticket only when no ticket/card hover is active.
      // During hover, the hovered category should be the only emphasized group;
      // when hover clears, the selected state is restored by this same repaint.
      if (selectedTicketId && !activeHoverTicket) {
        const selTicket = tickets.find((t) => t.id === selectedTicketId);
        if (selTicket) {
          sectionEls.forEach((el) => {
            const sec = el.getAttribute("data-section") || "";
            if (excludedSections?.includes(sec)) return; // never highlight disabled
            const cat = getCategoryIdFromSectionEl(el);

            const match =
              !disabledTicketIds?.has(selTicket.id) &&
              ticketCategoryOrSectionMatches(selTicket, sec, cat);

            if (match) paintSection(el, "selected");
          });
        }
      }

      // Hover highlight (overrides selection)
      if (activeHoverTicket) {
        sectionEls.forEach((el) => {
          const sec = el.getAttribute("data-section") || "";
          if (excludedSections?.includes(sec)) return; // never highlight disabled
          const cat = getCategoryIdFromSectionEl(el);

          const match =
            !disabledTicketIds?.has(activeHoverTicket.id) &&
            ticketCategoryOrSectionMatches(activeHoverTicket, sec, cat);

          if (match) paintSection(el, "hover");
        });
      }
    } catch (e) {
      console.error("[TixstockDynamicMap] repaint error:", e);
    }
  }, [
    svgContent,
    hoveredTicket,
    hoveredMapTicket,
    selectedTicketId,
    tickets,
    excludedSections,
    disabledTicketIds,
    ticketCategoryOrSectionMatches,
  ]);

  // Run repaint for dynamic changes (selection, hover).
  // The initial available/inactive painting is already baked into
  // `paintedSvg`, so even if this effect is delayed the map looks correct.
  // `paintedSvg` is included so that when innerHTML is replaced (which
  // does NOT re-fire the ref callback), we still re-apply runtime styles
  // on the fresh nodes.
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

      const bestMatch = findBestTicketForSection(sectionId, categoryId);

      if (bestMatch && onTicketSelect) {
        onTicketSelect(bestMatch.id);
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [svgContent, onTicketSelect, excludedSections, findBestTicketForSection]);

  /* ---------- Pointer-hover on the SVG map itself ---------------------- */

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onMouseOver = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) {
        setHoveredMapTicket(null);
        return;
      }

      const secId = sectionEl.getAttribute("data-section") || "";
      // Don't hover-highlight excluded sections
      if (excludedSections?.includes(secId)) {
        setHoveredMapTicket(null);
        return;
      }
      const catId = getCategoryIdFromSectionEl(sectionEl);

      setHoveredMapTicket(findBestTicketForSection(secId, catId));
    };

    const onMouseOut = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const relatedTarget = ev.relatedTarget as Element | null;
      const nextSectionEl = relatedTarget?.closest("[data-section]");
      if (nextSectionEl === sectionEl) return;
      if (nextSectionEl) return;
      setHoveredMapTicket(null);
    };

    root.addEventListener("mouseover", onMouseOver);
    root.addEventListener("mouseout", onMouseOut);
    return () => {
      root.removeEventListener("mouseover", onMouseOver);
      root.removeEventListener("mouseout", onMouseOut);
    };
  }, [svgContent, excludedSections, findBestTicketForSection]);

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
        className="flex justify-center rounded-lg overflow-hidden [&_svg]:max-w-full [&_svg]:w-auto [&_svg]:h-auto [&_svg]:max-h-[45svh] lg:[&_svg]:max-h-[calc(100vh-10rem)]"
      />
    </div>
  );
}
