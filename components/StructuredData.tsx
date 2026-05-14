import { Event } from "@/lib/app.types";
import { computePackagePrice } from "@/lib/events/price";

interface StructuredDataProps {
  events: Event[];
}

export function StructuredData({ events }: StructuredDataProps) {
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "מגה איבנטס",
    alternateName: "Mega Events",
    description:
      "מגה איבנטס מבית מגה תיירות - האתר היחיד בישראל לחבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם",
    url: "https://www.mega-events.co.il",
    logo: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
    foundingDate: "1993",
    founder: {
      "@type": "Organization",
      name: "מגה תיירות",
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "IL",
      addressRegion: "Israel",
    },
    serviceArea: {
      "@type": "Country",
      name: "Israel",
    },
    service: [
      {
        "@type": "Service",
        name: "חבילות נופש לאירועי מוזיקה",
        description: "חבילות מותאמות אישית להופעות ופסטיבלים בעולם",
      },
      {
        "@type": "Service",
        name: "חבילות נופש לאירועי ספורט",
        description: "חבילות למשחקי כדורגל, טניס ואירועי ספורט בינלאומיים",
      },
      {
        "@type": "Service",
        name: "כרטיסים רשמיים לאירועים",
        description: "רק כרטיסים מקוריים מההפקות הרשמיות",
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "אירועים זמינים",
      itemListElement: events.slice(0, 10).map((event, index) => {
        const hasAvailableTickets = (event.tickets_and_rates || []).some(
          (t) => t?.available !== false
        );
        const availabilityUrl = hasAvailableTickets
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock";
        const packagePrice = computePackagePrice(event);
        return ({
        "@type": "Offer",
        position: index + 1,
        name: event.name,
        description: `חבילה מלאה לאירוע ${event.name} ב${event.location.name}`,
        priceCurrency: "USD",
        price: (packagePrice ?? 0).toString(),
        validFrom: new Date().toISOString(),
        validThrough: event.date,
  availability: availabilityUrl,
        itemOffered: {
          "@type": "Event",
          name: event.name,
          startDate: event.date,
          location: {
            "@type": "Place",
            name: event.location.name,
            geo: {
              "@type": "GeoCoordinates",
              latitude: event.location.latitude,
              longitude: event.location.longitude,
            },
          },
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (packagePrice ?? 0).toString(),
            availability: availabilityUrl,
          },
        },
      })}),
    },
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "בית",
        item: "https://www.mega-events.co.il",
      },
    ],
  };

  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "מגה איבנטס",
    url: "https://www.mega-events.co.il",
    description:
      "האתר היחיד בישראל לחבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם",
    inLanguage: "he-IL",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.mega-events.co.il/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationData, null, 2),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbData, null, 2),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteData, null, 2),
        }}
      />
    </>
  );
}
