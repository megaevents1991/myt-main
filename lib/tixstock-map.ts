/**
 * TixStock Dynamic SVG Map utilities
 *
 * Handles SVG parsing, section matching, duplicate cleanup,
 * and visual highlighting for tx_event venue maps.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TixStockListing = {
  id: string;
  ticket_group_id?: string | null;
  proceed_price?: number | null;
  face_value?: number | null;
  seat_details: {
    category?: string | null;
    section?: string | null;
    row?: string | null;
  };
};

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

export const TX_TICKET_COLOR = "rgb(5, 32, 60)";
/** Light solid fill for sections with available tickets (opaque equivalent of ~20 % teal on white – avoids stacking artefacts from overlapping shapes) */
export const TX_SECTION_FILL_LIGHT = "#D4E5E7";
/** Base/available section stroke — secondary DEFAULT */
export const TX_SECTION_FILL = "#277E89";
/** Hover/highlighted stroke & text — secondary foreground */
export const TX_HOVER_STROKE = "#F0F0F2";
/** Text shadow on hover */
export const TX_TEXT_SHADOW = "#000000";
/** Slightly brighter teal for hover feedback */
export const TX_HOVER_FILL = "#2F97A3";
/** Stronger teal for selected state */
export const TX_SELECTED_FILL = "#277E89";

/* ------------------------------------------------------------------ */
/*  String helpers                                                     */
/* ------------------------------------------------------------------ */

/** Turn a category/section name into a slug for comparison */
export const slugify = (name: string): string =>
  (name || "").trim().toLowerCase().replace(/\s+/g, "-");

/** Normalise a section name for comparison */
export const normalizeSection = (section: string): string =>
  (section || "").trim().toLowerCase();

/* ------------------------------------------------------------------ */
/*  Ticket classification helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * A ticket is "category-only" when its category and section fields
 * are identical (case-insensitive), meaning the listing has no
 * specific section — just a category.
 */
export const isCategoryOnlyTicket = (ticket: TixStockListing): boolean => {
  const c = ticket.seat_details.category?.trim().toLowerCase();
  const s = ticket.seat_details.section?.trim().toLowerCase();
  return !!c && !!s && c === s;
};

/**
 * Check whether a ticket's *section* matches a `data-section` id on
 * the SVG map.
 *
 * When the ticket also carries a category, we additionally require
 * the `data-section` id to begin with the category slug so that
 * e.g. section "92" in "Longside Upper Tier" only matches
 * `longside-upper-tier_92`, not `longside-upper-tier-central_92`.
 */
export const isTicketMatchingSection = (
  ticket: TixStockListing,
  mapSectionId: string,
  /** Optional: the data-category of the map section's parent group */
  mapCategoryId?: string | null,
): boolean => {
  const section = ticket.seat_details.section;
  if (!section || !mapSectionId) return false;

  const norm = normalizeSection(section);
  const mapNorm = mapSectionId.toLowerCase();

  // Check suffix/infix match on the section id
  const sectionMatches =
    mapNorm === norm ||
    mapNorm.endsWith(`_${norm}`) ||
    mapNorm.endsWith(`-${norm}`) ||
    mapNorm.includes(`_${norm}_`) ||
    mapNorm.includes(`-${norm}-`);

  if (!sectionMatches) return false;

  // If the ticket has a distinct category, also verify the map
  // section belongs to the right category group.
  const ticketCat = ticket.seat_details.category?.trim().toLowerCase();
  if (ticketCat && ticketCat !== norm && mapCategoryId) {
    const catSlug = slugify(ticketCat);
    if (catSlug !== mapCategoryId.toLowerCase()) return false;
  }

  return true;
};

/**
 * Check whether a category-only ticket matches a `data-category` id
 * on the SVG map.
 */
export const isTicketMatchingCategory = (
  ticket: TixStockListing,
  mapCategoryId: string,
): boolean => {
  if (!isCategoryOnlyTicket(ticket)) return false;
  const ticketCategory = slugify(ticket.seat_details.category || "");
  return (
    !!ticketCategory && ticketCategory === (mapCategoryId || "").toLowerCase()
  );
};

/**
 * Walk up the DOM from a `[data-section]` element and return the
 * enclosing `data-category` value (if any).
 */
export const getCategoryIdFromSectionEl = (
  sectionEl: Element,
): string | null => {
  const categoryEl = sectionEl.closest("[data-category]");
  return categoryEl?.getAttribute("data-category") || null;
};

/* ------------------------------------------------------------------ */
/*  SVG sanitisation & preparation                                     */
/* ------------------------------------------------------------------ */

/**
 * Parse raw SVG text, strip scripts / inline event handlers and
 * enlarge tier-label fonts by 2 px.
 */
export const sanitizeAndPrepareSvg = (rawSvg: string): string | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;

  // Remove <script> elements
  svg.querySelectorAll("script").forEach((n) => n.remove());

  // Remove inline event-handler attributes (onclick, onmouseover, …)
  svg.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on"))
        el.removeAttribute(attr.name);
    });
  });

  // Remove tier-label elements (visual clutter on venue maps)
  svg.querySelectorAll(".tier-label").forEach((el) => el.remove());

  // Also remove standalone data-tier label elements that are NOT
  // ancestor groups containing sections (i.e. only remove if the
  // element has no [data-section] descendants).
  svg.querySelectorAll("[data-tier]").forEach((el) => {
    if (!el.querySelector("[data-section]")) el.remove();
  });

  // Make the SVG responsive
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.removeAttribute("style");

  // Override SVG font-families to a system sans-serif (the original
  // SVG typically references fonts like DMSans-Medium / DMSans-Bold
  // which aren't loaded on the page, causing fallback metrics to
  // shift labels.)  Also set text-anchor: middle on section labels so
  // the runtime re-centering in `centerSectionLabels` works correctly.
  const styleEl = svg.querySelector("style");
  if (styleEl) {
    styleEl.textContent =
      (styleEl.textContent || "").replace(
        /font-family:\s*'[^']+'/g,
        "font-family: Arial, Helvetica, sans-serif",
      ) +
      "\n.section-label { text-anchor: middle; dominant-baseline: central; }";
  }

  return svg.outerHTML;
};

/* ------------------------------------------------------------------ */
/*  Section-label centering                                            */
/* ------------------------------------------------------------------ */

/**
 * Re-centre every `.section-label` text element on its parent
 * section's `.block` shape.  Must be called **after** the SVG is
 * mounted in the live DOM so `getBBox()` returns real geometry.
 *
 * Works in tandem with the CSS rule
 *   `.section-label { text-anchor: middle; dominant-baseline: central; }`
 * injected during sanitisation.
 */
export const centerSectionLabels = (container: HTMLElement): void => {
  const sectionEls = container.querySelectorAll("[data-section]");

  for (const sec of Array.from(sectionEls)) {
    const block = sec.querySelector(".block") as SVGGraphicsElement | null;
    const label = sec.querySelector(".section-label") as SVGTextElement | null;
    if (!block || !label) continue;

    try {
      const bbox = block.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      // Position the text at the shape's centre.
      // Remove the matrix transform and set x/y directly.
      label.removeAttribute("transform");
      label.setAttribute("x", String(cx));
      label.setAttribute("y", String(cy));
    } catch {
      // getBBox can throw if the element isn't rendered (e.g. display:none)
    }
  }
};

/* ------------------------------------------------------------------ */
/*  Duplicate section cleanup                                          */
/* ------------------------------------------------------------------ */

/**
 * Remove duplicate `[data-section]` elements that share the same
 * section id **and** identical geometry (tag + d/points/rect attrs +
 * transform).  This avoids visual artefacts in some TixStock SVGs.
 */
export const cleanupDuplicateSections = (container: HTMLElement): void => {
  const sectionEls = Array.from(container.querySelectorAll("[data-section]"));
  const seen = new Set<string>();

  for (const el of sectionEls) {
    const sectionId = el.getAttribute("data-section") || "";
    const d = el.getAttribute("d") || "";
    const points = el.getAttribute("points") || "";
    const x = el.getAttribute("x") || "";
    const y = el.getAttribute("y") || "";
    const w = el.getAttribute("width") || "";
    const h = el.getAttribute("height") || "";
    const transform = el.getAttribute("transform") || "";
    const sig = `${sectionId}|${el.tagName}|${d}|${points}|${x}|${y}|${w}|${h}|${transform}`;

    if (seen.has(sig)) {
      el.remove();
      continue;
    }
    seen.add(sig);
  }
};

/* ------------------------------------------------------------------ */
/*  Section painting                                                   */
/* ------------------------------------------------------------------ */

/**
 * Paint a `[data-section]` group.
 *
 * Fill is applied to `.block` children (or all shapes as fallback).
 * Stroke is applied to **every** shape element inside the section so
 * that border colour is always consistent (fixes sections whose
 * outlines live in non-`.block` paths).
 *
 * mode:
 *  - "base"      → restore original styles
 *  - "available"  → light solid teal fill + secondary stroke
 *  - "hover"      → brighter teal + light stroke
 *  - "selected"   → darker teal + light stroke
 *  - "inactive"   → no fill change, subtle secondary-colour border
 */

const SVG_SHAPE_SEL = "polygon, path, rect, circle, ellipse, polyline, line";

export const paintSection = (
  el: Element,
  mode: "base" | "hover" | "selected" | "available" | "inactive",
): void => {
  const blocks = el.querySelectorAll(".block");
  const allShapes = Array.from(el.querySelectorAll(SVG_SHAPE_SEL));

  // Fill targets: .block elements if present, otherwise all shapes
  const fillTargets =
    blocks.length > 0
      ? Array.from(blocks)
      : allShapes.length > 0
        ? allShapes
        : [el];

  // Stroke targets: ALL shapes so borders are always overridden
  const strokeTargets = allShapes.length > 0 ? allShapes : [el];

  // Deduplicate for persisting originals
  const allTargets = [...new Set<Element>([...fillTargets, ...strokeTargets])];

  // Persist original inline styles the first time we touch an element
  for (const target of allTargets) {
    const node = target as HTMLElement;
    const svgEl = target as unknown as SVGElement;
    if (!node.dataset.origFill) {
      node.dataset.origFill = svgEl.style.fill || "";
    }
    if (!node.dataset.origStroke) {
      node.dataset.origStroke = svgEl.style.stroke || "";
    }
    if (!node.dataset.origStrokeOpacity) {
      node.dataset.origStrokeOpacity = svgEl.style.strokeOpacity || "";
    }
  }

  /* ---- fill ---- */
  for (const target of fillTargets) {
    const node = target as HTMLElement;
    const svgEl = target as unknown as SVGElement;

    switch (mode) {
      case "base":
      case "inactive":
        svgEl.style.fill = node.dataset.origFill || "";
        svgEl.style.opacity = "1";
        svgEl.style.cursor = "";
        break;
      case "available":
        svgEl.style.fill = TX_SECTION_FILL_LIGHT;
        svgEl.style.opacity = "1";
        svgEl.style.cursor = "pointer";
        break;
      case "hover":
        svgEl.style.fill = TX_HOVER_FILL;
        svgEl.style.opacity = "1";
        svgEl.style.cursor = "pointer";
        break;
      case "selected":
        svgEl.style.fill = TX_SELECTED_FILL;
        svgEl.style.opacity = "1";
        svgEl.style.cursor = "pointer";
        break;
    }
  }

  /* ---- stroke ---- */
  for (const target of strokeTargets) {
    const node = target as HTMLElement;
    const svgEl = target as unknown as SVGElement;

    switch (mode) {
      case "base":
        svgEl.style.stroke = node.dataset.origStroke || "";
        svgEl.style.strokeOpacity = node.dataset.origStrokeOpacity || "";
        break;
      case "available":
        svgEl.style.stroke = TX_SECTION_FILL;
        svgEl.style.strokeOpacity = "";
        break;
      case "hover":
        svgEl.style.stroke = TX_HOVER_STROKE;
        svgEl.style.strokeOpacity = "";
        break;
      case "selected":
        svgEl.style.stroke = TX_HOVER_STROKE;
        svgEl.style.strokeOpacity = "";
        break;
      case "inactive":
        svgEl.style.stroke = TX_SECTION_FILL;
        svgEl.style.strokeOpacity = "0.35";
        break;
    }
  }

  // Style the section-label text on hover/selected
  const labels = el.querySelectorAll(".section-label");
  for (const label of Array.from(labels)) {
    const txtEl = label as SVGTextElement;
    if (mode === "hover" || mode === "selected") {
      txtEl.style.fill = TX_HOVER_STROKE;
      txtEl.style.textShadow = `0 1px 2px ${TX_TEXT_SHADOW}`;
    } else {
      txtEl.style.fill = "";
      txtEl.style.textShadow = "";
    }
  }
};

/* ------------------------------------------------------------------ */
/*  EventTicket → TixStockListing adapter                              */
/* ------------------------------------------------------------------ */

/**
 * Convert our internal `EventTicket` shape (category + description)
 * into the `TixStockListing` shape expected by the map utilities.
 *
 * ticket.category  → seat_details.category
 * ticket.description → seat_details.section
 */
export const eventTicketToListing = (ticket: {
  id: string;
  category: string;
  description: string;
  price: number;
}): TixStockListing => ({
  id: ticket.id,
  proceed_price: ticket.price,
  face_value: ticket.price,
  seat_details: {
    category: ticket.category,
    section: ticket.description,
  },
});

/* ------------------------------------------------------------------ */
/*  Map-match validation                                               */
/* ------------------------------------------------------------------ */

/**
 * Check whether a ticket can be matched to *any* section/category on
 * the loaded SVG map.  Used to filter out tickets that have no
 * corresponding visual representation.
 */
export const doesTicketMatchAnyMapSection = (
  ticket: TixStockListing,
  container: HTMLElement,
): boolean => {
  const sectionEls = Array.from(container.querySelectorAll("[data-section]"));

  return sectionEls.some((el) => {
    const secId = el.getAttribute("data-section") || "";
    const catId = getCategoryIdFromSectionEl(el);

    if (isCategoryOnlyTicket(ticket)) {
      return !!catId && isTicketMatchingCategory(ticket, catId);
    }
    return isTicketMatchingSection(ticket, secId, catId);
  });
};
