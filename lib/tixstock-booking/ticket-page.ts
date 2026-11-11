// The customer's ticket page (`/ticket/[token]`) and what the confirmation page says about a TixStock test order's
// tickets. The page is found by the booking's `customer_token` alone - never by an order id - and lists a file only
// once the booking's tickets were released to the customer. Pure: every read goes through `TicketPageDeps`
// (the real ones: ticket-page-deps.ts). Test: lib/__tests__/tixstockTicketPage.test.ts.
import { readListingSnapshot, safeHttpUrl, type BookingStatus } from "./rules";

/** `randomBytes(32).toString("base64url")`: 43 characters of the base64url alphabet. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isTicketToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN.test(v);
}

export type TicketFileKind = "pdf" | "mobile_link" | "proof" | "additional";

export type TicketPageFile = {
  id: string;
  kind: string;
  row: string | null;
  seat: string | null;
  /** Only a link the customer opens himself (a mobile ticket). A stored file is served by the file route. */
  url?: string;
};

export type TicketPageData = {
  eventName: string;
  eventDate: string;
  category: string;
  section: string | null;
  row: string | null;
  ticketType: string;
  quantity: number;
  deliveryDate: string | null;
  restrictions: string[];
  /** The tickets were released to the customer: only then is a file listed. */
  released: boolean;
  /** The seller transfers the tickets to the customer himself: there is nothing to download here. */
  externalTransfer: boolean;
  files: TicketPageFile[];
};

export type TicketPageBooking = {
  id: string;
  reservation_id: number;
  status: BookingStatus;
  quantity: number;
  /** The listing as booked (`ListingSnapshot`), as stored. */
  listing: unknown;
  released_to_customer_at: string | null;
};

export type TicketPageDeps = {
  loadBookingByToken(token: string): Promise<TicketPageBooking | null>;
  loadEvent(reservationId: number): Promise<{ name: string; date: string }>;
  loadFiles(bookingId: string): Promise<Array<{ id: string; kind: string; row: string | null; seat: string | null; url: string | null }>>;
};

/**
 * The page of one token. Null = no such page: a value that is not a token (no read is made for it), an unknown
 * token, or a booking TixStock cancelled. A seller's proof of transfer is staff's to see, never listed here.
 * The ONLY `url` a file carries out of here is an http(s) one (`safeHttpUrl`), so the page may put it in an `href`.
 */
export async function loadTicketPage(token: string, deps: TicketPageDeps): Promise<TicketPageData | null> {
  if (!isTicketToken(token)) return null;
  const booking = await deps.loadBookingByToken(token);
  if (!booking || booking.status === "cancelled") return null;

  const listing = readListingSnapshot(booking.listing);
  const event = await deps.loadEvent(booking.reservation_id);
  const released = booking.released_to_customer_at !== null;

  const files: TicketPageFile[] = [];
  if (released) {
    for (const f of await deps.loadFiles(booking.id)) {
      if (f.kind === "proof") continue;
      const file: TicketPageFile = { id: f.id, kind: f.kind, row: f.row, seat: f.seat };
      if (f.kind === "mobile_link") {
        // The link is a seller's text: only an http(s) URL is ever handed to the page (never `javascript:` /
        // `data:`), and a mobile ticket with no link to open is not listed.
        const url = safeHttpUrl(f.url);
        if (!url) continue;
        file.url = url;
      }
      files.push(file);
    }
  }

  return {
    eventName: event.name,
    eventDate: event.date,
    category: listing.category,
    section: listing.section,
    row: listing.row,
    ticketType: listing.ticketType,
    quantity: booking.quantity,
    deliveryDate: listing.deliveryDate,
    restrictions: listing.restrictions,
    released,
    externalTransfer: /external/i.test(listing.ticketType),
    files,
  };
}

/**
 * What the confirmation page of a test order says about its tickets: `ordered` only when the order is approved AND
 * the link e-mail really went out (the page never says a link was sent when none was), `problem` when staff will
 * have to step in, `pending` for everything on its way.
 */
export function summaryState(status: BookingStatus, linkEmailSentAt: string | null): "ordered" | "pending" | "problem" {
  if (status === "failed" || status === "uncertain" || status === "released" || status === "cancelled") return "problem";
  if ((status === "approved" || status === "commissionable") && linkEmailSentAt !== null) return "ordered";
  return "pending";
}

/**
 * The name a stored ticket file is served under. Row and seat are a seller's free text and land in a response
 * header: every character outside letters, digits, dash and underscore becomes a dash.
 */
export function fileNameFor(kind: string, row: string | null, seat: string | null): string {
  const safe = (v: string | null): string => (v ?? "").replace(/[^A-Za-z0-9_-]/g, "-");
  return `${[kind, row, seat].map(safe).filter((part) => part !== "").join("-")}.pdf`;
}
