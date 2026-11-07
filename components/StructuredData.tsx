import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

/**
 * The homepage's JSON-LD: who we are and the site. Events are marked up on
 * their own order pages (orderJsonLd), hubs on theirs (hubJsonLd).
 */
export function StructuredData() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
    </>
  );
}
