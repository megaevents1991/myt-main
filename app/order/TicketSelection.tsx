"use client";

import { Spoiler, ScrollArea, Text } from "@mantine/core";
import { useContext, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { OrderContext } from "../app.context";
import { EventTicketCard } from "@/components/ui/EventTicketCard";
import Image from "next/image";
import { ChevronDownCircle, ChevronUpCircle, Loader2 } from "lucide-react";
import { EventDataHeader } from "@/components/ui/EventDataHeader";
import { useMediaQuery } from "@mantine/hooks";
import type { EventTicket } from "@/lib/app.types";
import { getAvailableTickets } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// TixStock types — TEMP: kept here until tickets are fully integrated
// ─────────────────────────────────────────────────────────────────

export interface TixStockVenue {
  id: string;
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postcode: string;
  country_code: string;
  latitude: number;
  longitude: number;
}

export interface TixStockPerformer {
  id: string;
  name: string;
}

export interface TixStockCategory {
  id: string;
  name: string;
  upcoming_events: number;
  parent: any[];
  children?: TixStockCategory[];
}

export interface TixStockTicketInfo {
  general_admission: string;
  type: string;
  allow_last_minute_sales: string;
  split_type: string;
  etickets: any[];
  upload_later: string;
  instant_download: string;
}

export interface TixStockQuantityInfo {
  quantity_available: number;
  quantity_sold: number;
  display_quantity: number;
  split_quantity: number;
  quantity_on_hold: number;
}

export interface TixStockSeatDetails {
  category: string;
  section: string;
  row: string;
  first_seat: string;
}

export interface TixStockPrice {
  currency: string;
  amount: string;
}

export interface TixStockDeliveryOption {
  name: string;
  value: string;
}

export interface TixStockDelivery {
  type: string;
  hand_delivered: string;
  shipped_date_or_date_in_hand: string;
  options: TixStockDeliveryOption[];
}

export interface TixStockListing {
  id: string;
  seller_id: number;
  seller_name: string;
  ticket: TixStockTicketInfo;
  number_of_tickets_for_sale: TixStockQuantityInfo;
  seat_details: TixStockSeatDetails;
  face_value: TixStockPrice;
  display_price?: TixStockPrice;
  proceed_price: TixStockPrice;
  restrictions_benefits: { options: any[]; other: string };
  delivery: TixStockDelivery;
  face_value_percentage?: string;
}

export interface TixStockEvent {
  id: string;
  name: string;
  currency: string;
  datetime: string;
  status: string;
  map_url: string;
  venue: TixStockVenue;
  performers: TixStockPerformer[];
  category: TixStockCategory;
  listings?: TixStockListing[];
}

export interface TixStockEventDB {
  event_id: string;
  event_name: string;
  show_date: string;
  event_status: string;
  venue_name: string;
  city_name: string;
  country_code: string;
  venue_data: TixStockVenue;
  category_name: string;
  sub_categories: TixStockCategory;
  performers: TixStockPerformer[];
  venue_map_url?: string;
  last_synced: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TixStockFeedResponse {
  data: TixStockEvent[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  links: { first: string; last: string | null; prev: string | null; next: string | null };
}

export interface TixStockTicketsResponse {
  data: TixStockListing[];
  meta: { min_price: string; max_price: string; total_tickets: number };
}

// ─────────────────────────────────────────────────────────────────
// SVG Dynamic Map – helper utilities
// ─────────────────────────────────────────────────────────────────

/** Slugify a name to match SVG data-attribute format, e.g. "Longside Lower Tier" → "longside-lower-tier" */
const slugify = (name: string) =>
  name.replace(/block|section/gi, '').trim().toLowerCase().replace(/\s+/g, '-');

/** Extract the section portion from an EventTicket description (strip "Row X" suffix) */
const getTicketSection = (ticket: EventTicket): string => {
  const section = ticket.description?.replace(/\s*Row\s+\S+$/i, '').trim();
  return section || ticket.category;
};

/** Category-only ticket: section info is identical to category (not yet assigned to a specific block) */
const isCategoryOnlyTicket = (ticket: EventTicket): boolean => {
  const section = getTicketSection(ticket);
  return !section || slugify(section) === slugify(ticket.category);
};

/** Check if a ticket's section matches a specific SVG data-section ID */
const isTicketMatchingSection = (ticket: EventTicket, mapSectionId: string): boolean => {
  const section = getTicketSection(ticket);
  const norm = slugify(section);
  const mapId = mapSectionId.toLowerCase();
  return mapId === norm || mapId.endsWith(`_${norm}`) || mapId.endsWith(`-${norm}`);
};

/** Check if a category-only ticket matches an SVG data-category ID */
const isTicketMatchingCategory = (ticket: EventTicket, mapCategoryId: string): boolean => {
  if (!isCategoryOnlyTicket(ticket)) return false;
  return slugify(ticket.category) === mapCategoryId.toLowerCase();
};

/** Combined matcher: checks section match OR category match for category-only tickets */
const isTicketMatchingSectionOrCategory = (ticket: EventTicket, sectionEl: Element): boolean => {
  const sectionId = sectionEl.getAttribute('data-section');
  if (!sectionId) return false;

  if (!isCategoryOnlyTicket(ticket)) {
    return isTicketMatchingSection(ticket, sectionId);
  }

  const categoryEl = sectionEl.closest('[data-category]');
  const categoryId = categoryEl?.getAttribute('data-category');
  return categoryId ? isTicketMatchingCategory(ticket, categoryId) : false;
};

export const TicketSelection = () => {
  const { setEventTicket, event } = useContext(OrderContext);
  const [errorMessage, setErrorMessage] = useState("");
  const [cheapestTicket, setCheapestTicket] = useState<EventTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | undefined>(
    undefined
  );

  const MAX_TICKETS = 9;

  const { numberOfEventTickets, setNumberOfEventTickets } =
    useContext(OrderContext);

  const matches = useMediaQuery("(min-width: 1024px)");

  // ── SVG Dynamic Map state ──
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [hoveredTicket, setHoveredTicket] = useState<EventTicket | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  /** Determine if the event uses an SVG dynamic map */
  const isSvgMap = useMemo(() => {
    if (!event) return false;
    return (
      event.map_image_url?.endsWith('.svg') ||
      event.type === 'sports_event_dynamic' ||
      event.type === 'music_live_event_dynamic'
    );
  }, [event]);

  // Consider only tickets that are available (t.available !== false). If "available" is undefined, treat as available.
  const availableTickets: EventTicket[] = useMemo(
    () => {
      const tickets = getAvailableTickets(event);
      const filteredOut = (event?.tickets_and_rates || []).length - tickets.length;
      
      if (filteredOut > 0) {
        console.log(`[TicketSelection] Filtered out ${filteredOut} unavailable ticket(s) for event ${event?.id}`);
      }
      
      return tickets;
    },
    [event]
  );

  useEffect(() => {
    if (!availableTickets || availableTickets.length === 0) {
      // No tickets available; clear selection, cheapest ticket, AND the event ticket in context
      console.log('No available tickets found - clearing all ticket state');
      setCheapestTicket(null);
      setSelectedTicket(undefined);
      // CRITICAL FIX: Clear the eventTicket in context to prevent stale data
      setEventTicket({
        id: "",
        vendor: "",
        category: "",
        price: 0,
        description: "",
        quantity: 0,
      });
      return;
    }

    console.log(`Found ${availableTickets.length} available tickets:`, 
      availableTickets.map(t => ({ id: t.id, category: t.category, available: t.available }))
    );

    const cheapt = availableTickets.reduce<EventTicket>((min, ticket) =>
      ticket.price < min.price ? ticket : min,
      availableTickets[0]
    );
    
    console.log(`Auto-selecting cheapest ticket: ${cheapt.category} (ID: ${cheapt.id}, available: ${cheapt.available})`);
    
    setCheapestTicket(cheapt);
    setSelectedTicket(cheapt?.id);
    setEventTicket({
      id: cheapt?.id || "",
      vendor: cheapt?.vendor || "",
      category: cheapt?.category || "",
      price: cheapt?.price || 0,
      description: cheapt?.description || "",
      quantity: 2,
    });
  }, [availableTickets, setEventTicket]);

  useEffect(() => {
    if (matches) return; // Don't scroll on desktop (1024px+)
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 90,
        behavior: "smooth",
      });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, [matches]); // Add matches as dependency

  // ── Fetch & parse SVG map ──
  useEffect(() => {
    if (!isSvgMap || !event?.map_image_url) {
      setSvgContent(null);
      return;
    }

    // Reset map selection when event changes
    setSelectedSection(null);
    setSelectedCategory(null);

    let cancelled = false;
    const fetchSvg = async () => {
      setIsLoadingMap(true);
      try {
        const response = await fetch(event.map_image_url);
        const text = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');

        // Deduplicate overlapping sections (some SVGs contain duplicate groups)
        const sections = Array.from(doc.querySelectorAll('[data-section]'));
        const geometryMap = new Map<string, Element>();
        sections.forEach((section) => {
          const block = section.querySelector('.block');
          if (!block) return;
          let signature = '';
          if (block.tagName === 'path') signature = `path:${block.getAttribute('d')}`;
          else if (block.tagName === 'rect')
            signature = `rect:${block.getAttribute('x')},${block.getAttribute('y')},${block.getAttribute('width')},${block.getAttribute('height')}`;
          else if (block.tagName === 'polygon') signature = `poly:${block.getAttribute('points')}`;
          if (signature) {
            if (geometryMap.has(signature)) section.remove();
            else geometryMap.set(signature, section);
          }
        });

        // Remove venue-specific tier label texts
        doc.querySelectorAll('.tier-label').forEach((el) => el.remove());

        if (!cancelled) setSvgContent(doc.documentElement.outerHTML);
      } catch (error) {
        console.error('Failed to load SVG map:', error);
        if (!cancelled) setSvgContent(null);
      } finally {
        if (!cancelled) setIsLoadingMap(false);
      }
    };

    fetchSvg();
    return () => { cancelled = true; };
  }, [isSvgMap, event?.map_image_url]);

  // ── SVG section highlighting ──
  // useLayoutEffect runs synchronously after DOM updates, preventing flicker
  useLayoutEffect(() => {
    if (!svgContent || !mapContainerRef.current) return;

    const applyHighlights = () => {
      const allSections = mapContainerRef.current?.querySelectorAll('[data-section]');
      if (!allSections) return;

      allSections.forEach((el) => {
        const sectionId = el.getAttribute('data-section');
        const parentCategory = el.closest('[data-category]')?.getAttribute('data-category');
        let shouldHighlight = false;

        // Selected section
        if (selectedSection && sectionId === selectedSection) shouldHighlight = true;
        // Selected category
        if (!shouldHighlight && selectedCategory && parentCategory === selectedCategory)
          shouldHighlight = true;
        // Hovered ticket
        if (!shouldHighlight && hoveredTicket) {
          shouldHighlight = isTicketMatchingSectionOrCategory(hoveredTicket, el);
        }

        if (shouldHighlight) el.classList.add('svg-highlighted');
        else el.classList.remove('svg-highlighted');
      });
    };

    applyHighlights();

    // Re-apply on DOM mutations (e.g. React re-renders)
    const observer = new MutationObserver(applyHighlights);
    observer.observe(mapContainerRef.current, { childList: true, subtree: true, attributes: false });
    return () => observer.disconnect();
  }); // Runs on every render

  const handleTicketSelect = (ticket: {
    id: string;
    category: string;
    price: number;
    vendor?: string;
    description?: string;
  }) => {
    // Defensive: ensure the selected ticket is still available
    const ticketInAvailableList = availableTickets.find((t) => t.id === ticket.id);
    if (!ticketInAvailableList) {
      console.warn(`Attempted to select unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }
    
    // Additional check: verify the ticket is not explicitly marked as unavailable
    if (ticketInAvailableList.available === false) {
      console.warn(`Ticket is marked as unavailable: ${ticket.category} (ID: ${ticket.id})`);
      return;
    }
    
    setEventTicket({
      ...ticket,
      description: ticket.description || "",
      quantity: numberOfEventTickets,
    });
    setSelectedTicket(ticket.id);
  };

  const handleQuantityChange = (value: number | string) => {
    if (+value > MAX_TICKETS) {
      setErrorMessage("ניתן לרכוש עד 9 כרטיס בשלב זה");
      return;
    }
    setErrorMessage("");
    setNumberOfEventTickets(+value);
  };

  // ── SVG map click handler ──
  const handleSvgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const elements = document.elementsFromPoint(e.clientX, e.clientY);

    let bestMatch: {
      section: string;
      category: string | null;
      hasTickets: boolean;
      isCategoryMatch: boolean;
    } | null = null;
    let firstSectionFound: string | null = null;

    for (const el of elements) {
      if (!mapContainerRef.current?.contains(el)) continue;
      const sectionEl = el.closest('[data-section]');
      const dataSection = sectionEl?.getAttribute('data-section');

      if (dataSection && sectionEl) {
        if (!firstSectionFound) firstSectionFound = dataSection;

        // Exact section match
        const sectionMatch = availableTickets.some(
          (t) => !isCategoryOnlyTicket(t) && isTicketMatchingSection(t, dataSection)
        );
        if (sectionMatch) {
          bestMatch = { section: dataSection, category: null, hasTickets: true, isCategoryMatch: false };
          break;
        }

        // Category-only ticket match
        const parentCategory = sectionEl.closest('[data-category]')?.getAttribute('data-category');
        if (parentCategory) {
          const categoryMatch = availableTickets.some((t) =>
            isTicketMatchingCategory(t, parentCategory)
          );
          if (categoryMatch && !bestMatch) {
            bestMatch = {
              section: dataSection,
              category: parentCategory,
              hasTickets: true,
              isCategoryMatch: true,
            };
          }
        }
      }
    }

    const finalSection = bestMatch ? bestMatch.section : firstSectionFound;

    if (finalSection && bestMatch) {
      if (bestMatch.isCategoryMatch && bestMatch.category) {
        const newCategory = selectedCategory === bestMatch.category ? null : bestMatch.category;
        setSelectedCategory(newCategory);
        setSelectedSection(null);
      } else {
        const newSelection = selectedSection === finalSection ? null : finalSection;
        setSelectedSection(newSelection);
        setSelectedCategory(null);
      }
    } else {
      setSelectedSection(null);
      setSelectedCategory(null);
    }
  };

  /** Tickets filtered by current SVG map selection */
  const displayedTickets = useMemo(() => {
    if (!isSvgMap) return availableTickets;
    if (selectedSection)
      return availableTickets.filter((t) => isTicketMatchingSection(t, selectedSection));
    if (selectedCategory)
      return availableTickets.filter((t) => isTicketMatchingCategory(t, selectedCategory));
    return availableTickets;
  }, [availableTickets, isSvgMap, selectedSection, selectedCategory]);

  return (
    <div>
      <div className="sr-only">
        <h1>בחירת כרטיסים לאירוע {event?.name}</h1>
        <p>בחר כמות וקטגוריית כרטיסים עבור האירוע ב{event?.location?.name}</p>
      </div>
      <div className="flex flex-col items-center ">
        <div dir="rtl" className="w-screen px-4 py-2 lg:p-4 bg-gray-200 ">
          <div className="flex justify-between w-full max-w-7xl mx-auto gap-2 px-2 lg:px-6 flex-col lg:flex-row lg:gap-2">
            <EventDataHeader event={event} />
          </div>
        </div>
      </div>
      <main className="flex flex-col" dir="rtl" role="main">
        <div className="mt-4 text-lg">
          בחרו כמות כרטיסים וקטגוריה מועדפת,
          <span className="font-bold"> ישיבה בזוגות מובטחת.</span>
        </div>
        <div className="flex gap-4 flex-col lg:flex-row-reverse mt-4">
          {isSvgMap ? (
            /* ── SVG Dynamic Map ── */
            <div className="w-full lg:w-[45%]">
              <div className="venue-map-container flex items-center justify-center min-h-[250px] lg:min-h-[400px] p-4 rounded-lg border bg-[#0f172a]">
                <style>{`
                  .venue-map-container,
                  .venue-map-container svg {
                    direction: ltr !important;
                    font-family: initial !important;
                    font-size: initial !important;
                    line-height: normal !important;
                  }
                  .venue-map-container text,
                  .venue-map-container tspan {
                    direction: ltr !important;
                    unicode-bidi: normal !important;
                    pointer-events: none !important;
                    user-select: none !important;
                    fill: #F0F0F2 !important;
                    font-weight: 600 !important;
                    line-height: normal !important;
                    text-shadow: 0px 0px 3px #000000;
                    font-family: Arial, Helvetica, sans-serif !important;
                  }
                  .venue-map-container .section-label { font-size: 10px !important; }
                  .venue-map-container path,
                  .venue-map-container rect,
                  .venue-map-container polygon,
                  .venue-map-container circle,
                  .venue-map-container [data-section] {
                    pointer-events: all !important;
                    cursor: pointer !important;
                  }
                  .venue-map-container [data-section] .block,
                  .venue-map-container [data-section].block {
                    fill: #277E89 !important;
                    fill-opacity: 0.35 !important;
                    stroke: #277E89 !important;
                    stroke-opacity: 0.9 !important;
                    stroke-width: 1px !important;
                    vector-effect: non-scaling-stroke;
                    transition: fill-opacity 0.2s ease, stroke-width 0.2s ease, stroke 0.2s ease;
                  }
                  .venue-map-container [data-section]:hover .block,
                  .venue-map-container [data-section].block:hover {
                    fill-opacity: 0.6 !important;
                    stroke: #F0F0F2 !important;
                    stroke-opacity: 1 !important;
                    stroke-width: 1.5px !important;
                  }
                  .venue-map-container [data-section].svg-highlighted path,
                  .venue-map-container [data-section].svg-highlighted rect,
                  .venue-map-container [data-section].svg-highlighted polygon,
                  .venue-map-container [data-section].svg-highlighted circle,
                  .venue-map-container [data-section].svg-highlighted .block,
                  .venue-map-container [data-section].svg-highlighted.block {
                    fill: #277E89 !important;
                    fill-opacity: 1 !important;
                    stroke: #F0F0F2 !important;
                    stroke-opacity: 1 !important;
                    stroke-width: 2px !important;
                    opacity: 1 !important;
                  }
                `}</style>
                {isLoadingMap ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                ) : svgContent ? (
                  <div
                    ref={mapContainerRef}
                    className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-[600px] [&>svg]:w-auto [&>svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                    onClick={handleSvgClick}
                  />
                ) : (
                  <p className="text-gray-400">לא ניתן לטעון את המפה</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <Spoiler
                className="w-full lg:hidden flex justify-center"
                style={{ margin: 0 }}
                maxHeight={90}
                showLabel={<ChevronDownCircle fill="black" width={"100%"} aria-label="הרחב מפת האירוע" />}
                controlRef={(ref) => {
                  ref?.setAttribute(
                    "style",
                    "left: 50%; transform: translate(-50%, -120%); color: white;"
                  );
                  ref?.setAttribute("aria-label", "הרחב מפת האירוע");
                }}
                hideLabel={<ChevronUpCircle fill="black" width={"100%"} aria-label="כווץ מפת האירוע" />}
              >
                <Image
                  className="rounded-lg"
                  width={600}
                  height={600}
                  priority={true}
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה`}
                />
              </Spoiler>
              <div className="lg:w-[45%] hidden lg:block">
                <Image
                  className="rounded-lg w-auto h-auto w-full"
                  width={600}
                  height={600}
                  priority={true}
                  src={event?.map_image_url || ""}
                  alt={`מפת אירוע ${event?.name || "לא ידוע"} - מיקומי הישיבה ובלוקים`}
                />
              </div>
            </>
          )}
          <div className="w-full lg:w-[55%]" dir="ltr">
            <ScrollArea h={"60vh"}>
              {errorMessage && (
                <Text c="red" ta="right" mb="xs" role="alert" aria-live="polite">
                  {errorMessage}
                </Text>
              )}
              <div
                className="flex flex-col gap-2"
                role="group"
                aria-labelledby="ticket-selection-heading"
              >
                <div id="ticket-selection-heading" className="sr-only">
                  קטגוריות כרטיסים זמינות
                </div>
                {isSvgMap && (selectedSection || selectedCategory) && (
                  <div className="flex items-center justify-between mb-2 px-1" dir="rtl">
                    <Text size="sm" c="dimmed">מסנן לפי בחירה במפה</Text>
                    <button
                      onClick={() => { setSelectedSection(null); setSelectedCategory(null); }}
                      className="text-sm text-blue-600 underline hover:text-blue-800"
                    >
                      הצג הכל
                    </button>
                  </div>
                )}
                {availableTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                    <Text size="xl" fw={700} c="red" aria-live="polite">
                      אין כרטיסים זמינים כרגע
                    </Text>
                    <Text size="md" c="dimmed">
                      כל הכרטיסים לאירוע זה אזלו או אינם זמינים למכירה.
                    </Text>
                    <Text size="sm" c="dimmed">
                      אנא נסו אירוע אחר או צרו קשר עם שירות הלקוחות לקבלת עזרה.
                    </Text>
                  </div>
                ) : displayedTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                    <Text size="md" c="dimmed" aria-live="polite">
                      אין כרטיסים זמינים באזור זה במפה
                    </Text>
                    <button
                      onClick={() => { setSelectedSection(null); setSelectedCategory(null); }}
                      className="text-sm text-blue-600 underline hover:text-blue-800"
                    >
                      הצג את כל הכרטיסים
                    </button>
                  </div>
                ) : (
                  [...displayedTickets]
                    .sort((a: EventTicket, b: EventTicket) => a.price - b.price)
                    .filter((ticket: EventTicket) => {
                      // Double-check: ensure ticket is still available before rendering
                      if (ticket.available === false) {
                        console.warn(`Attempted to render unavailable ticket: ${ticket.category} (ID: ${ticket.id})`);
                        return false;
                      }
                      return true;
                    })
                    .map((ticket: EventTicket, index: number) => (
                      <div
                        key={ticket.id}
                        onMouseEnter={() => isSvgMap && setHoveredTicket(ticket)}
                        onMouseLeave={() => isSvgMap && setHoveredTicket(null)}
                      >
                        <EventTicketCard
                          index={index}
                          onClick={() =>
                              handleTicketSelect({
                                id: ticket.id,
                                price: ticket.price,
                                category: ticket.category,
                                vendor: ticket.vendor,
                                description: ticket.description,
                              })
                          }
                          numberOfTickets={numberOfEventTickets}
                          onChangeNumberOfTickets={handleQuantityChange}
                          category={ticket.category}
                          categoryDescription={ticket.description}
                          colorOnTheMap={ticket.colorOnTheMap || ""}
                          isSelected={selectedTicket === ticket.id}
                          price={ticket.price}
                          basePrice={cheapestTicket?.price ?? 0}
                          vip={ticket.vip}
                        />
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};
