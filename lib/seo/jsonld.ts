import type { Event } from "@/lib/app.types";
import { eventCityName, lodgingLocation } from "@/lib/events/lodging";
import { isTicketOnlyEvent } from "@/lib/events/price";
import { orderDescription, type OrderMetaEvent } from "@/lib/seo/orderMeta";

/**
 * Schema.org JSON-LD for the site. Replaces the old homepage block that put a
 * TravelAgency with 10 Event offers on five pages: a package price on an Event,
 * a city with no address, price "0" for a sold-out event and validFrom = render
 * time (audit 2026-11-07, finding 3). Every value here is one the page shows.
 */
const SITE = "https://www.mega-events.co.il";
const ORG_ID = `${SITE}/#organization`;
const IN_STOCK = "https://schema.org/InStock";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": ORG_ID,
    name: "מגה איבנטס",
    alternateName: "Mega Events",
    description:
      "מגה איבנטס מבית מגה תיירות - האתר היחיד בישראל לחבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם",
    url: SITE,
    logo: `${SITE}/apple-touch-icon.png`,
    image: `${SITE}/og-image.png`,
    // The footer's phone and the address in the terms of use (app/terms).
    telephone: "+972-3-768-4800",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ראול ולנברג",
      addressLocality: "תל אביב",
      addressCountry: "IL",
    },
    areaServed: { "@type": "Country", name: "Israel" },
    foundingDate: "1993",
    parentOrganization: { "@type": "Organization", name: "מגה תיירות" },
    sameAs: ["https://www.facebook.com/megatravelil", "https://www.instagram.com/mega_events_il"],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    name: "מגה איבנטס",
    alternateName: "Mega Events",
    url: SITE,
    inLanguage: "he-IL",
    publisher: { "@id": ORG_ID },
  };
}

export type OrderJsonLdEvent = OrderMetaEvent & {
  id: number;
  card_image_url?: Event["card_image_url"] | null;
};

/**
 * One order page: the Event itself (where and when, no package price - Google's
 * Event price is a ticket's) and, for a package, a TouristTrip offering it at
 * the card's price. A ticket-only event's price is a ticket's, so it goes on the
 * Event. `price` = computePackagePrice(event); no price or no stock = no offer.
 */
export function orderJsonLd(
  event: OrderJsonLdEvent,
  { price, available }: { price: number | null; available: boolean },
) {
  const url = `${SITE}/order/${event.id}`;
  const city = eventCityName(event);
  const country = lodgingLocation(event, "event").country_code ?? event.location.country_code;
  const image = event.card_image_url ? { image: [event.card_image_url] } : {};
  const description = orderDescription(event, price);
  const offer =
    price !== null && available
      ? {
          "@type": "Offer",
          price: String(price),
          priceCurrency: "USD",
          availability: IN_STOCK,
          url,
          seller: { "@id": ORG_ID },
        }
      : null;
  const ticketOnly = isTicketOnlyEvent(event);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Event",
      "@id": `${url}#event`,
      name: event.name.trim(),
      ...(event.date ? { startDate: event.date } : {}),
      description,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      url,
      ...image,
      location: {
        "@type": "Place",
        name: city,
        address: {
          "@type": "PostalAddress",
          addressLocality: city,
          ...(country ? { addressCountry: country } : {}),
        },
      },
      ...(ticketOnly && offer ? { offers: offer } : {}),
    },
  ];
  if (!ticketOnly && offer) {
    graph.push({
      "@type": "TouristTrip",
      "@id": `${url}#package`,
      name: `חבילה ל${event.name.trim()}: כרטיס, טיסה ומלון`,
      description,
      url,
      ...image,
      about: { "@id": `${url}#event` },
      provider: { "@id": ORG_ID },
      offers: offer,
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * A /c/ hub: its breadcrumb (as drawn on the page: עמוד הבית, then the tree
 * from the root) and the events it lists. `trail` = root..hub, `path` without "/c/".
 */
export function hubJsonLd(
  trail: { name: string; path: string }[],
  events: { id: number; name: string }[],
) {
  const hub = trail[trail.length - 1];
  const hubUrl = `${SITE}/c/${hub?.path ?? ""}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "עמוד הבית", item: SITE },
        ...trail.map((t, i) => ({
          "@type": "ListItem",
          position: i + 2,
          name: t.name,
          item: `${SITE}/c/${t.path}`,
        })),
      ],
    },
  ];
  if (events.length) {
    graph.push({
      "@type": "CollectionPage",
      "@id": `${hubUrl}#page`,
      name: hub?.name,
      url: hubUrl,
      isPartOf: { "@id": `${SITE}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: events.length,
        itemListElement: events.slice(0, 50).map((e, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}/order/${e.id}`,
          name: e.name.trim(),
        })),
      },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
