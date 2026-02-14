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
  type TixStockListing,
  cleanupDuplicateSections,
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
  /** Callback when the user clicks a section on the map */
  onSectionFilterChange?: (filter: {
    section: string | null;
    category: string | null;
  }) => void;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TixstockDynamicMap({
  mapUrl,
  tickets,
  hoveredTicket,
  onSectionFilterChange,
}: Props) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Reset selection when the map URL changes (new venue)
  useEffect(() => {
    setSelectedSection(null);
    setSelectedCategory(null);
  }, [mapUrl]);

  /* ---------- 5. Section/category filtering callback ------------------- */

  useEffect(() => {
    onSectionFilterChange?.({
      section: selectedSection,
      category: selectedCategory,
    });
  }, [selectedSection, selectedCategory, onSectionFilterChange]);

  /* ---------- 2 + 3 + 4. Cleanup, font enlarge, highlighting ---------- */

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !svgContent) return;

    // 2. Duplicate section cleanup
    cleanupDuplicateSections(root);

    const sectionEls = Array.from(root.querySelectorAll("[data-section]"));

    // Reset all sections to their base colours
    sectionEls.forEach((el) => paintSection(el, "base"));

    // 7. Colour available sections with the ticket colour
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
      }
    });

    // 4. Click-selected highlight (overrides base colouring)
    if (selectedCategory) {
      sectionEls.forEach((el) => {
        const cat = getCategoryIdFromSectionEl(el);
        if (cat?.toLowerCase() === selectedCategory.toLowerCase()) {
          paintSection(el, "selected");
        }
      });
    } else if (selectedSection) {
      sectionEls.forEach((el) => {
        const sec = el.getAttribute("data-section") || "";
        if (sec === selectedSection) paintSection(el, "selected");
      });
    }

    // 4. Hover highlight (overrides selection)
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
  }, [svgContent, hoveredTicket, selectedSection, selectedCategory, tickets]);

  /* ---------- 4. Click handler ---------------------------------------- */

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const sectionEl = target?.closest("[data-section]");
      if (!sectionEl) return;

      const sectionId = sectionEl.getAttribute("data-section");
      if (!sectionId) return;

      const categoryId = getCategoryIdFromSectionEl(sectionEl);

      // Does the clicked section have category-only tickets?
      const hasCategoryOnlyTickets =
        !!categoryId &&
        tickets.some(
          (t) =>
            isCategoryOnlyTicket(t) && isTicketMatchingCategory(t, categoryId),
        );

      if (hasCategoryOnlyTickets && categoryId) {
        setSelectedCategory((prev) =>
          prev === categoryId ? null : categoryId,
        );
        setSelectedSection(null);
      } else {
        setSelectedSection((prev) =>
          prev === sectionId ? null : sectionId,
        );
        setSelectedCategory(null);
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [tickets]);

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

      // Determine whether this section is currently selected
      const isSelected =
        (selectedSection && secId === selectedSection) ||
        (selectedCategory &&
          catId?.toLowerCase() === selectedCategory.toLowerCase());

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
  }, [tickets, selectedSection, selectedCategory]);

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
      {/* Reset filter button */}
      {(selectedSection || selectedCategory) && (
        <div className="mb-2 flex justify-end" dir="rtl">
          <button
            type="button"
            onClick={() => {
              setSelectedSection(null);
              setSelectedCategory(null);
            }}
            className="rounded-md bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 transition-colors"
          >
            הצג הכל
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svgContent }}
        className="rounded-lg overflow-hidden [&_svg]:w-full [&_svg]:h-auto"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook: filter tickets by the selected section / category            */
/* ------------------------------------------------------------------ */

export function useFilteredSourceTickets(
  tickets: TixStockListing[],
  selected: { section: string | null; category: string | null },
): TixStockListing[] {
  return useMemo(() => {
    if (selected.category) {
      return tickets.filter((t) =>
        isTicketMatchingCategory(t, selected.category!),
      );
    }
    if (selected.section) {
      return tickets.filter((t) =>
        isTicketMatchingSection(t, selected.section!),
      );
    }
    return tickets;
  }, [tickets, selected]);
}
