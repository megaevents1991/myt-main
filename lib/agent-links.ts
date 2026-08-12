/**
 * Partner tracking links for the agent/influencer portal.
 *
 * Ported from myt-backoffice's `lib/site.ts` (`partnerLink()`) - but unlike
 * the backoffice, this app IS www.mega-events.co.il, not a separate app
 * linking out to it. So there's no overridable "main site" origin to point
 * at a different deployment; the origin is just this app's own, same literal
 * as `lib/feed/metaCatalog.ts`'s `FEED_SITE_ORIGIN`.
 *
 * `utm_source` is what this app's own affiliate tracking reads
 * (`app/hooks/Affiliate.tsx`'s `orderStage`, which checks `utm_source` first
 * and falls back to a legacy `aff` param). The code is stored in
 * localStorage on arrival, so it keeps counting after the visitor navigates
 * away from this URL.
 */
const SITE_ORIGIN = "https://www.mega-events.co.il";

export function partnerLink(
  trackingCode: string,
  eventId?: number | null,
  shareToken?: string | null,
): string {
  const path = eventId == null ? "/" : `/order/${eventId}`;
  const params = new URLSearchParams({ utm_source: trackingCode });
  // A prepared-package link always carries utm_source too - the existing
  // affiliate/orderStage mechanism already attributes off that param alone,
  // so this piggybacks on it rather than needing a second attribution path.
  // The opaque share_token (not the row's sequential id) keeps packages from
  // being walked/enumerated.
  if (shareToken) params.set("pkg", shareToken);
  return `${SITE_ORIGIN}${path}?${params.toString()}`;
}
