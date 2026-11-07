import { BRAND, hebrewDate } from "@/lib/seo/orderMeta";

/**
 * Title and description of a /c/ hub. 132 of 134 hubs used to describe
 * themselves as "כרטיסים וחבילות ל<name>" under the brand "MYT", which no
 * customer searches for. The description now says what the page holds.
 */
export function hubTitle(name: string): string {
  return `${name} - כרטיסים, טיסה ומלון | ${BRAND}`;
}

/**
 * One event of the hub: its date, the price its card shows (computePackagePrice;
 * null = none) and whether that price is a ticket alone (isTicketOnlyEvent).
 */
export type HubMetaEvent = { date: string; price: number | null; ticketOnly: boolean };

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const lowest = (events: HubMetaEvent[]) => {
  const prices = events.map((e) => e.price).filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices) : null;
};

export function hubDescription(
  cat: { name: string; subtitle: string | null | undefined },
  events: HubMetaEvent[],
): string {
  if (events.length === 0) {
    return (
      cat.subtitle?.trim() ||
      `${cat.name}: חבילות עם כרטיס, טיסה ומלון לאירועים בחו״ל. ${BRAND} מבית מגה תיירות.`
    );
  }
  const dates = events.map((e) => e.date).sort();
  const first = hebrewDate(dates[0]);
  const last = hebrewDate(dates[dates.length - 1]);
  const count = events.length === 1 ? "אירוע אחד" : `${events.length} אירועים`;
  const when = events.length === 1 || first === last ? `ב-${first}` : `בין ${first} ל-${last}`;

  // A ticket-only price is a ticket alone: it never prices a package.
  const packages = events.filter((e) => !e.ticketOnly);
  let offer: string;
  if (packages.length) {
    const min = lowest(packages);
    const one = packages.length === 1;
    offer = `${one ? "חבילה" : "חבילות"} עם כרטיס, טיסה ומלון`;
    if (min !== null) offer += `, מחיר ממוצע לנוסע ${one ? "" : "מ-"}${usd(min)}`;
  } else {
    const min = lowest(events);
    offer = "כרטיסים";
    if (min !== null) offer += `, מחיר ${events.length === 1 ? "" : "מ-"}${usd(min)} לכרטיס`;
  }
  return `${cat.name}: ${count} ${when}. ${offer}. ${BRAND} מבית מגה תיירות.`;
}
