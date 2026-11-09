// MEGA CLUB - the club's pure rules (spec §4-§8). No I/O: the routes, the order summary and the tests share them.
import { normalizeCouponCode } from "@/lib/coupon.utils";

export type ClubSettings = {
  enabled: boolean;
  discount_per_traveler_usd: number;
  popup_delay_seconds: number;
};

/** Same ranges as the backoffice's validateClubSettings (lib/club/settings.ts there). */
export const CLUB_AMOUNT_MIN = 1;
export const CLUB_AMOUNT_MAX = 500;
export const CLUB_DELAY_MIN = 5;
export const CLUB_DELAY_MAX = 120;

const CLUB_OFF: ClubSettings = { enabled: false, discount_per_traveler_usd: 50, popup_delay_seconds: 22 };

const intIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Anything unreadable = the club is off, so the site falls back to today's popup (Review Focus 4). */
export function parseClubSettings(json: unknown): ClubSettings {
  if (!json || typeof json !== "object") return { ...CLUB_OFF };
  const s = json as Record<string, unknown>;
  if (
    typeof s.enabled !== "boolean" ||
    !intIn(s.discount_per_traveler_usd, CLUB_AMOUNT_MIN, CLUB_AMOUNT_MAX) ||
    !intIn(s.popup_delay_seconds, CLUB_DELAY_MIN, CLUB_DELAY_MAX)
  ) {
    return { ...CLUB_OFF };
  }
  return {
    enabled: s.enabled,
    discount_per_traveler_usd: s.discount_per_traveler_usd,
    popup_delay_seconds: s.popup_delay_seconds,
  };
}

export type ClubSurface = "club" | "legacy_popup" | "none";

/** Spec §4. The "nothing" rows come first: they were nothing before the club too. */
export function clubSurface(v: {
  enabled: boolean;
  isAgentVisitor: boolean;
  arrivedViaPartner: boolean;
  flightSkipped: boolean;
  isPercentageAffiliateDiscount: boolean;
  isSpecialOfferAllowed: boolean;
}): ClubSurface {
  if (v.isAgentVisitor || v.isPercentageAffiliateDiscount || !v.isSpecialOfferAllowed || v.flightSkipped) return "none";
  if (v.arrivedViaPartner) return "legacy_popup";
  if (!v.enabled) return "legacy_popup";
  return "club";
}

/** No 0/O, 1/I/L: a code is read off a phone screen and typed on another device. */
export const MEMBER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MEMBER_CODE_PREFIX = "MEGA";
const MEMBER_CODE_LENGTH = 6;

export function newMemberCode(randomInt: (maxExclusive: number) => number): string {
  let out = MEMBER_CODE_PREFIX;
  for (let i = 0; i < MEMBER_CODE_LENGTH; i++) {
    const n = randomInt(MEMBER_CODE_ALPHABET.length);
    out += MEMBER_CODE_ALPHABET[Math.min(Math.max(0, Math.floor(n)), MEMBER_CODE_ALPHABET.length - 1)];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export function cleanPhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.trim().replace(/^\+/, "").replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

/** Last 9 digits - the same key the backoffice's WhatsApp opt-out matches members on. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** A member code counts event tickets, so the price shown = the price charged in confirm-order (spec §6). */
export function clubCouponQty(coupon: { source?: string | null }, persons: number, eventTickets: number): number {
  return coupon.source === "club" ? eventTickets : persons;
}

/** A member price is for a package with a flight (D12); every other coupon fits any order. */
export function couponFitsOrder(source: string | null | undefined, hasOutbound: boolean): boolean {
  return source === "club" ? hasOutbound : true;
}

export const CLUB_COOKIE = "myt_club";
export const CLUB_COOKIE_DAYS = 365;
const NAME_MAX = 40;

export type ClubCookie = { v: 1; code: string; no: number; name?: string };

/** No email and no phone in it, ever: the cookie only says which member code to apply on this device. */
export function parseClubCookie(raw: string | null | undefined): ClubCookie | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Record<string, unknown>;
    if (c?.v !== 1 || typeof c.code !== "string" || typeof c.no !== "number" || !Number.isInteger(c.no)) return null;
    const code = normalizeCouponCode(c.code);
    if (!code || !code.startsWith(MEMBER_CODE_PREFIX)) return null;
    const out: ClubCookie = { v: 1, code, no: c.no };
    if (typeof c.name === "string" && c.name.trim() && c.name.trim().length <= NAME_MAX) out.name = c.name.trim();
    return out;
  } catch {
    return null;
  }
}

export function serializeClubCookie(c: ClubCookie): string {
  return JSON.stringify(c.name ? { v: 1, code: c.code, no: c.no, name: c.name } : { v: 1, code: c.code, no: c.no });
}

/** document.cookie or a Cookie header. */
export function readClubCookie(cookieHeader: string | null | undefined): ClubCookie | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== CLUB_COOKIE) continue;
    try {
      return parseClubCookie(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}

/** A remembered member's code goes in only by itself into an empty slot, never on a ticket-only order (spec §5.5). */
export function shouldAutoApply(v: {
  surface: ClubSurface;
  slotEmpty: boolean;
  flightSkipped: boolean;
  cookie: ClubCookie | null;
}): boolean {
  return v.surface === "club" && v.slotEmpty && !v.flightSkipped && v.cookie !== null;
}
