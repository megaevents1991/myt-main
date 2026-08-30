/**
 * Signed session for the partner area.
 *
 * Ported from the backoffice (`lib/auth/session.ts`) deliberately unchanged in
 * shape: both apps sign `base64url(payload).hmacSHA256` over the same
 * `user_profiles` identity, so a partner is the same person on both sides and
 * neither app can be tricked into trusting a cookie the other would reject.
 *
 * This REPLACES the old partner login, which compared `partners.password` in
 * plain text and kept "logged in" as a React boolean - a refresh logged you out,
 * and nothing server-side ever checked who you were.
 *
 * Signing key: `NEXT_SECRET_SESSION_SECRET`. Set it to the same value as the
 * backoffice only if you want one cookie to work on both hosts; otherwise any
 * strong secret is fine, since the domains differ. Uses Web Crypto so it runs in
 * both the Node runtime (routes) and Edge (middleware). Never import from a
 * client component - it reads a server-only secret.
 */

export const PARTNER_SESSION_COOKIE = "partner_session";
/**
 * 4 hours (was a week until 2026-08-30).
 *
 * A week-long agent session on the CUSTOMER site is what produced "אני מחובר
 * על איציק בבק אופיס אבל באתר מראה שאני אלון": nothing here could see the
 * backoffice logout, so the old identity simply outlived it. The cookie is now
 * a working-session length, is written WITHOUT maxAge (dies when the browser
 * closes - see the handoff route), and carries the portal login id that
 * `requirePartner` re-checks against the profile on every request.
 */
const MAX_AGE_SECONDS = 60 * 60 * 4;
export const PARTNER_SESSION_MAX_AGE = MAX_AGE_SECONDS;

/** Mirrors `user_profiles.role` in the shared database. */
export type PartnerRole = "agent" | "affiliate";
const PARTNER_ROLES: PartnerRole[] = ["agent", "affiliate"];

export type PartnerSession = {
  /** auth.users uuid */
  sub: string;
  email: string;
  role: PartnerRole;
  /** partners.partner_tracking_code - never null for a partner session. */
  partner_code: string;
  display_name: string | null;
  /**
   * The backoffice portal login id this session was handed off from
   * (`user_profiles.portal_session_id`). `requirePartner` re-reads that column
   * and refuses the session once they differ, which is how a portal logout -
   * or a login as a DIFFERENT agent - ends agent mode here. A session without
   * one is a pre-2026-08-30 cookie and is no longer honored.
   */
  sid?: string;
  /** ms epoch */
  exp: number;
};

function signingKey(): string {
  const key = process.env.NEXT_SECRET_SESSION_SECRET;
  if (!key) {
    throw new Error(
      "Missing NEXT_SECRET_SESSION_SECRET - the partner area cannot sign sessions",
    );
  }
  return key;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return toBase64Url(new Uint8Array(sig));
}

/** Constant-time comparison - a fast-exit compare leaks the signature by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createPartnerSession(user: {
  sub: string;
  email: string;
  role: PartnerRole;
  partner_code: string;
  display_name?: string | null;
  /** Portal login id from the handoff token - see PartnerSession.sid. */
  sid?: string | null;
}): Promise<string> {
  const payload: PartnerSession = {
    sub: user.sub,
    email: user.email,
    role: user.role,
    partner_code: user.partner_code,
    display_name: user.display_name ?? null,
    ...(user.sid ? { sid: user.sid } : {}),
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

/** The payload of a well-formed, correctly-signed, unexpired session; else null. */
export async function verifyPartnerSession(
  value?: string | null,
): Promise<PartnerSession | null> {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = await hmac(body);
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as PartnerSession;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    // Staff roles must never mint a partner session: every query in this area is
    // scoped by partner_code, and a session without one would widen them.
    if (!PARTNER_ROLES.includes(payload.role)) return null;
    if (typeof payload.partner_code !== "string" || !payload.partner_code)
      return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp)
      return null;
    return payload;
  } catch {
    return null;
  }
}
