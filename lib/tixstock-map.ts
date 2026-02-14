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
/** Base/available section fill — secondary DEFAULT */
export const TX_SECTION_FILL = "#277E89";
/** Hover/highlighted stroke & text — secondary foreground */
export const TX_HOVER_STROKE = "#F0F0F2";
/** Text shadow on hover */
export const TX_TEXT_SHADOW = "#000000";
/** Slightly brighter teal for hover feedback */
export const TX_HOVER_FILL = "#2F97A3";
/** Darker teal for selected state */
export const TX_SELECTED_FILL = "#1F6670";

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

  // Enlarge tier-label font-size by 2 px
  svg.querySelectorAll(".tier-label").forEach((label) => {
    const svgLabel = label as SVGElement;
    // Try inline style first
    const inlineSize = parseFloat(svgLabel.style.fontSize || "");
    if (!isNaN(inlineSize)) {
      svgLabel.style.fontSize = `${inlineSize + 2}px`;
      return;
    }
    // Try font-size attribute
    const attrSize = parseFloat(label.getAttribute("font-size") || "");
    if (!isNaN(attrSize)) {
      label.setAttribute("font-size", `${attrSize + 2}`);
      return;
    }
    // Font-size is likely set via CSS class (e.g. .st5 { font-size: 15px }).
    // Use getComputedStyle when available, otherwise parse class rules from
    // the embedded <style>.  Since we're in DOMParser (no computed styles),
    // look for the class-based size in the <style> block.
    const classes = Array.from(label.classList);
    const styleEl = svg.querySelector("style");
    if (styleEl && classes.length) {
      const cssText = styleEl.textContent || "";
      for (const cls of classes) {
        const re = new RegExp(
          `\\.${cls}\\s*\\{[^}]*font-size\\s*:\\s*([\\d.]+)px`,
          "i",
        );
        const m = cssText.match(re);
        if (m) {
          const size = parseFloat(m[1]);
          svgLabel.style.fontSize = `${size + 2}px`;
          return;
        }
      }
    }
  });

  // Make the SVG responsive
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.removeAttribute("style");

  return svg.outerHTML;
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
 * Paint a `[data-section]` group's `.block` children.
 *
 * TixStock SVGs structure each section as:
 *   <g data-section="...">
 *     <polygon class="st6 block" />   ← the shape to colour
 *     <text class="section-label" />
 *   </g>
 *
 * The CSS class `.st6` sets `fill: none`, so we must use **inline
 * style** (`style.fill`) to override it.
 *
 * mode:
 *  - "base"     → restore original fill (transparent)
 *  - "hover"    → brighter teal + light stroke (#F0F0F2)
 *  - "selected" → darker teal + light stroke
 *  - "available" → secondary teal (#277E89) at 70 % opacity
 */
export const paintSection = (
  el: Element,
  mode: "base" | "hover" | "selected" | "available",
): void => {
  // Find the actual shape elements inside the section group
  const blocks = el.querySelectorAll(".block");
  const targets = blocks.length > 0 ? Array.from(blocks) : [el];

  for (const target of targets) {
    const node = target as HTMLElement;
    const svgEl = target as unknown as SVGElement;

    // Persist the original inline fill the first time we touch the element
    if (!node.dataset.origFill) {
      node.dataset.origFill = svgEl.style.fill || "";
    }
    if (!node.dataset.origStroke) {
      node.dataset.origStroke = svgEl.style.stroke || "";
    }

    if (mode === "base") {
      const orig = node.dataset.origFill || "";
      svgEl.style.fill = orig;
      svgEl.style.stroke = node.dataset.origStroke || "";
      svgEl.style.opacity = "1";
      svgEl.style.cursor = "";
      continue;
    }

    if (mode === "available") {
      svgEl.style.fill = TX_SECTION_FILL;
      svgEl.style.stroke = TX_SECTION_FILL;
      svgEl.style.opacity = "0.7";
      svgEl.style.cursor = "pointer";
      continue;
    }

    if (mode === "hover") {
      svgEl.style.fill = TX_HOVER_FILL;
      svgEl.style.stroke = TX_HOVER_STROKE;
      svgEl.style.opacity = "1";
      svgEl.style.cursor = "pointer";
      continue;
    }

    // selected
    svgEl.style.fill = TX_SELECTED_FILL;
    svgEl.style.stroke = TX_HOVER_STROKE;
    svgEl.style.opacity = "1";
    svgEl.style.cursor = "pointer";
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
