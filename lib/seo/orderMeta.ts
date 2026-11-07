import type { Event } from "@/lib/app.types";
import { eventCityName, type LodgingEvent } from "@/lib/events/lodging";
import { isTicketOnlyEvent } from "@/lib/events/price";

/**
 * Title and description of an order page (/order/<id>) - the event's search
 * result. Hebrew, with the city and the date, so the 29 Oasis shows are 29
 * different results, and the price worded exactly like the event cards
 * ("מחיר ממוצע $X לנוסע", "מחיר $X לכרטיס" for a ticket-only event).
 */
export type OrderMetaEvent = LodgingEvent & {
  name: string;
  package_mode?: Event["package_mode"];
};

const BRAND = "מגה איבנטס";

/** "2027-07-20" (or with a time) → "20.7.2027"; "" when it cannot be read. */
function hebrewDate(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : "";
}

/** "בריאן אדמס בלונדון" - the city left out when there is none or the name already has it. */
function nameInCity(event: OrderMetaEvent): string {
  const name = event.name.trim();
  const city = eventCityName(event);
  return city && !name.includes(city) ? `${name} ב${city}` : name;
}

export function orderTitle(event: OrderMetaEvent): string {
  const date = hebrewDate(event.date);
  const what = isTicketOnlyEvent(event) ? "כרטיסים" : "כרטיס, טיסה ומלון";
  return `${nameInCity(event)}${date ? ` · ${date}` : ""} | ${what} - ${BRAND}`;
}

/** `price` = computePackagePrice(event) - the number the event's card shows; null = none. */
export function orderDescription(event: OrderMetaEvent, price: number | null): string {
  const date = hebrewDate(event.date);
  const ticketOnly = isTicketOnlyEvent(event);
  const what = ticketOnly ? "כרטיסים לאירוע" : "חבילה עם כרטיס, טיסה ומלון";
  const amount = price === null ? "" : `$${price.toLocaleString("en-US")}`;
  const priceSentence = amount
    ? ticketOnly
      ? ` מחיר ${amount} לכרטיס.`
      : ` מחיר ממוצע ${amount} לנוסע.`
    : "";
  return `${nameInCity(event)}${date ? `, ${date}` : ""}: ${what}.${priceSentence} ${BRAND} מבית מגה תיירות.`;
}
