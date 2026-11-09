// MEGA CLUB on the confirmation page (D17) - what the order's tab carries over the payment page, and what the page
// shows from it. Pure: the order summary writes the handoff to sessionStorage, the confirmation page reads it back.
// The order read (/api/confirm-order/[id]) is keyed by a sequential id and returns no contact details, so the offer's
// email and phone come only from this tab - never from the server, never from another device.
import { cleanEmail, cleanPhone, type ClubCookie, type ClubSurface } from "@/lib/club/rules";

export const CLUB_HANDOFF_KEY = "myt:club:handoff";
/** A payment page left open for a while still comes back to its card; a stale tab does not. */
export const CLUB_HANDOFF_MAX_AGE_MS = 6 * 3600_000;
const NAME_MAX = 60;

type HandoffBase = { v: 1; orderId: string; at: number };

export type ClubMemberHandoff = HandoffBase & {
  kind: "member";
  no: number;
  name?: string;
  /** What the member price took off this order; null = it did not go in (a better coupon stayed). */
  savedUsd: number | null;
  /** Joined in this order (the summary's tick, or the confirmation page's offer). */
  joinedNow: boolean;
  /** The email was a member already - no welcome mail went out. */
  returning: boolean;
};

export type ClubOfferHandoff = HandoffBase & {
  kind: "offer";
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  eventId: number | null;
  perTicketUsd: number;
};

export type ClubHandoff = ClubMemberHandoff | ClubOfferHandoff;

export type ClubConfirmationView = "welcome" | "member" | "offer";

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s && s.length <= NAME_MAX ? s : null;
}

const isPosInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const isPosNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Written when the order is created, before the payment page. Only for a visitor the summary showed the club to:
 * a member with a number to print (joined now, or remembered on this device), or a visitor who could join.
 */
export function clubHandoffFor(v: {
  orderId: string | number;
  now: number;
  onlySave: boolean;
  surface: ClubSurface;
  /** The member price is on the order and is the coupon that counts. */
  clubPriceApplied: boolean;
  savedUsd: number;
  cookie: ClubCookie | null;
  joined: { memberNo: number; returning: boolean } | null;
  lead: { email?: unknown; phone?: unknown; firstName?: unknown; lastName?: unknown } | null;
  eventId: number | null;
  perTicketUsd: number | null;
}): ClubHandoff | null {
  if (v.onlySave || v.surface !== "club") return null;
  const head: HandoffBase = { v: 1, orderId: String(v.orderId), at: v.now };
  const saved = v.clubPriceApplied && v.savedUsd > 0 ? v.savedUsd : null;
  const withName = (h: ClubMemberHandoff): ClubMemberHandoff => (v.cookie?.name ? { ...h, name: v.cookie.name } : h);

  if (v.joined) {
    return withName({
      ...head,
      kind: "member",
      no: v.joined.memberNo,
      savedUsd: saved,
      joinedNow: true,
      returning: v.joined.returning,
    });
  }
  if (v.cookie) {
    return saved == null
      ? null
      : withName({ ...head, kind: "member", no: v.cookie.no, savedUsd: saved, joinedNow: false, returning: false });
  }
  // A member code typed by hand: a member, but no number to print and nothing to offer.
  if (v.clubPriceApplied) return null;

  const email = cleanEmail(v.lead?.email);
  const phone = cleanPhone(v.lead?.phone);
  if (!email || !phone || !isPosNum(v.perTicketUsd)) return null;
  const offer: ClubOfferHandoff = {
    ...head,
    kind: "offer",
    email,
    phone,
    eventId: isPosInt(v.eventId) ? v.eventId : null,
    perTicketUsd: v.perTicketUsd,
  };
  const first = cleanName(v.lead?.firstName);
  const last = cleanName(v.lead?.lastName);
  if (first) offer.firstName = first;
  if (last) offer.lastName = last;
  return offer;
}

/** sessionStorage text -> the handoff of THIS order, or null for anything else (another order, too old, broken). */
export function readClubHandoff(raw: string | null | undefined, orderId: string, now: number): ClubHandoff | null {
  if (!raw) return null;
  let h: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    h = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (h.v !== 1 || h.orderId !== orderId || typeof h.at !== "number" || !Number.isFinite(h.at)) return null;
  if (now - h.at > CLUB_HANDOFF_MAX_AGE_MS || h.at - now > 60_000) return null;
  const head: HandoffBase = { v: 1, orderId, at: h.at };

  if (h.kind === "member") {
    if (!isPosInt(h.no) || typeof h.joinedNow !== "boolean" || typeof h.returning !== "boolean") return null;
    if (h.savedUsd !== null && !isPosNum(h.savedUsd)) return null;
    const m: ClubMemberHandoff = {
      ...head,
      kind: "member",
      no: h.no,
      savedUsd: h.savedUsd as number | null,
      joinedNow: h.joinedNow,
      returning: h.returning,
    };
    const name = cleanName(h.name);
    if (name) m.name = name;
    return m;
  }
  if (h.kind === "offer") {
    const email = cleanEmail(h.email);
    const phone = cleanPhone(h.phone);
    if (!email || !phone || !isPosNum(h.perTicketUsd)) return null;
    if (h.eventId !== null && !isPosInt(h.eventId)) return null;
    const o: ClubOfferHandoff = {
      ...head,
      kind: "offer",
      email,
      phone,
      eventId: h.eventId as number | null,
      perTicketUsd: h.perTicketUsd,
    };
    const first = cleanName(h.firstName);
    const last = cleanName(h.lastName);
    if (first) o.firstName = first;
    if (last) o.lastName = last;
    return o;
  }
  return null;
}

/** Never on a 24 h hold or a failed payment; no offer once this device already holds a member code. */
export function clubConfirmationView(v: {
  handoff: ClubHandoff | null;
  isHold: boolean;
  paymentFailed: boolean;
  cookie: ClubCookie | null;
}): ClubConfirmationView | null {
  if (!v.handoff || v.isHold || v.paymentFailed) return null;
  if (v.handoff.kind === "member") {
    if (v.handoff.joinedNow) return "welcome";
    return v.handoff.savedUsd != null ? "member" : null;
  }
  return v.cookie ? null : "offer";
}

/** After the offer's join: the card stays, the email and phone leave the tab. */
export function memberAfterConfirmationJoin(
  offer: ClubOfferHandoff,
  a: { memberNo: number; firstName: string | null; returning: boolean },
  now: number,
): ClubMemberHandoff {
  const m: ClubMemberHandoff = {
    v: 1,
    orderId: offer.orderId,
    at: now,
    kind: "member",
    no: a.memberNo,
    savedUsd: null,
    joinedNow: true,
    returning: a.returning,
  };
  // A returning email: whoever typed it may not be that member, so the card gets no name from this form.
  const name = a.returning ? null : (cleanName(a.firstName) ?? offer.firstName ?? null);
  if (name) m.name = name;
  return m;
}
