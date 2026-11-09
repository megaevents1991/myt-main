// MEGA CLUB - join, lookup, unsubscribe and resend over injected deps (spec §8). No I/O of its own: lib/club/db.ts
// holds the real deps, the routes only build the context. Every path answers; nothing here throws to a route.
import type { UtmCookie } from "@/lib/utm";
import { CLUB_CONSENT_TEXT, CLUB_CONSENT_VERSION } from "@/lib/club/copy";
import { cleanEmail, cleanPhone, newMemberCode, phoneKey, type ClubSettings } from "@/lib/club/rules";

export type ClubFail = "off" | "invalid" | "rate_limited" | "removed" | "not_found" | "error";

export type ClubAnswer =
  | {
      ok: true;
      code: string;
      memberNo: number;
      firstName: string | null;
      discountType: "fixed";
      discountValue: number;
      perPerson: true;
      returning: boolean;
    }
  | { ok: false; kind: ClubFail };

export type ClubCtx = {
  ip: string | null;
  userAgent: string | null;
  sourcePath: string | null;
  utm: UtmCookie | null;
  now: Date;
};

export type ClubMember = {
  id: string;
  member_no: number;
  email: string;
  first_name: string | null;
  coupon_code: string;
  status: string;
  marketing: string;
  unsubscribe_token: string;
  /** The member's own code's amount (coupons.discount_value); null = the coupon row is gone, the code is dead. */
  discount_value: number | null;
};

export type NewClubMember = {
  email: string;
  phone: string;
  phone_key: string;
  first_name: string | null;
  last_name: string | null;
  coupon_id: number;
  coupon_code: string;
  source: "checkout_popup" | "checkout_row" | "site_page";
  source_path: string | null;
  event_id: number | null;
  utm: UtmCookie | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  consent_text: string;
  consent_version: string;
};

export type ClubLogInsert = {
  member_id: string | null;
  action: "join" | "rejoin" | "lookup" | "lookup_miss" | "unsubscribe" | "left";
  consent_text?: string;
  consent_version?: string;
  ip: string | null;
  user_agent: string | null;
  source: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

export type ClubDeps = {
  settings(): Promise<ClubSettings>;
  countRecent(ip: string, actions: string[], sinceIso: string): Promise<number>;
  memberByEmail(emailKey: string): Promise<ClubMember | null>;
  memberByToken(token: string): Promise<ClubMember | null>;
  memberById(id: string): Promise<ClubMember | null>;
  insertCoupon(code: string, amount: number): Promise<{ id: number } | { clash: true }>;
  deleteCoupon(id: number): Promise<void>;
  insertMember(row: NewClubMember): Promise<ClubMember | { clash: true }>;
  markUnsubscribed(id: string, at: Date): Promise<void>;
  /** D13: the member leaves - status left, updates off, the member code switched off. */
  markLeft(id: string, at: Date): Promise<void>;
  /** D13: a member who left joins again - status active, the code back on; the mail status is never touched. */
  reactivateMember(id: string): Promise<void>;
  log(row: ClubLogInsert): Promise<void>;
  sendWelcome(m: ClubMember): Promise<MailResult>;
  markWelcome(id: string, result: MailResult): Promise<void>;
  randomInt(max: number): number;
};

export const RATE_LIMIT_PER_HOUR = 5;
const CODE_TRIES = 3;
const MAIL_DEADLINE_MS = 4000;
const NAME_MAX = 60;
const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

const JOIN_ACTIONS = ["join", "rejoin"];
const LOOKUP_ACTIONS = ["lookup", "lookup_miss"];

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s && s.length <= NAME_MAX ? s : null;
}

function honeypotEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/** The member's own code's amount is what validate and confirm-order will charge - never a cached setting. */
function answer(m: ClubMember, amount: number, returning: boolean, firstName: string | null): ClubAnswer {
  return {
    ok: true,
    code: m.coupon_code,
    memberNo: m.member_no,
    firstName,
    discountType: "fixed",
    discountValue: m.discount_value ?? amount,
    perPerson: true,
    returning,
  };
}

/** The club's own switch; an unreadable setting is "off", never an error to the page (Review Focus 4). */
async function enabledSettings(deps: ClubDeps): Promise<ClubSettings | null> {
  try {
    const s = await deps.settings();
    return s.enabled ? s : null;
  } catch (e) {
    console.error("club: settings unreadable, answering off:", e);
    return null;
  }
}

/** A missing address is never refused, and a failed count lets the request through (fail open). */
async function overLimit(deps: ClubDeps, ctx: ClubCtx, actions: string[]): Promise<boolean> {
  if (!ctx.ip) return false;
  try {
    const since = new Date(ctx.now.getTime() - 3600_000).toISOString();
    return (await deps.countRecent(ctx.ip, actions, since)) >= RATE_LIMIT_PER_HOUR;
  } catch (e) {
    console.error("club: rate-limit count failed, letting through:", e);
    return false;
  }
}

async function safeLog(deps: ClubDeps, row: ClubLogInsert): Promise<void> {
  try {
    await deps.log(row);
  } catch (e) {
    console.error(`club: log ${row.action} failed:`, e);
  }
}

function withDeadline<T>(p: Promise<T>, ms: number, timeout: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(timeout), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Sends and records; never throws, never changes the join's answer. */
async function mailAndRecord(deps: ClubDeps, m: ClubMember): Promise<MailResult> {
  let result: MailResult;
  try {
    result = await withDeadline(deps.sendWelcome(m), MAIL_DEADLINE_MS, {
      ok: false,
      error: `no answer from the mail server in ${MAIL_DEADLINE_MS / 1000}s`,
    });
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await deps.markWelcome(m.id, result);
  } catch (e) {
    console.error("club: recording the welcome mail failed:", e);
  }
  return result;
}

function isClash(x: unknown): x is { clash: true } {
  return typeof x === "object" && x !== null && (x as { clash?: unknown }).clash === true;
}

export async function joinClub(input: unknown, ctx: ClubCtx, deps: ClubDeps): Promise<ClubAnswer> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const email = cleanEmail(body.email);
  const phone = cleanPhone(body.phone);
  if (!email || !phone || body.consent !== true || !honeypotEmpty(body.hp)) return { ok: false, kind: "invalid" };
  const source = body.method === "row" ? "checkout_row" : body.method === "page" ? "site_page" : "checkout_popup";
  const eventId = typeof body.eventId === "number" && Number.isInteger(body.eventId) && body.eventId > 0 ? body.eventId : null;

  const settings = await enabledSettings(deps);
  if (!settings) return { ok: false, kind: "off" };
  if (await overLimit(deps, ctx, JOIN_ACTIONS)) return { ok: false, kind: "rate_limited" };

  try {
    const amount = settings.discount_per_traveler_usd;
    const rejoin = async (m: ClubMember): Promise<ClubAnswer> => {
      // A member who left chose to; joining again is choosing back (D13). Staff "Remove" stays refused.
      if (m.status === "left") await deps.reactivateMember(m.id);
      else if (m.status !== "active") return { ok: false, kind: "removed" };
      if (m.discount_value == null) {
        console.error("club: member", m.member_no, "has no code row - not handing out a dead code");
        return { ok: false, kind: "error" };
      }
      // Never touch names, phone or the mail status here: anyone who knows the email can send this (spec §8.3).
      await safeLog(deps, { member_id: m.id, action: "rejoin", ip: ctx.ip, user_agent: ctx.userAgent, source });
      return answer(m, amount, true, null);
    };

    const existing = await deps.memberByEmail(email);
    if (existing) return await rejoin(existing);

    let coupon: { id: number; code: string } | null = null;
    for (let i = 0; i < CODE_TRIES && !coupon; i++) {
      const code = newMemberCode((max) => deps.randomInt(max));
      const made = await deps.insertCoupon(code, amount);
      if (!isClash(made)) coupon = { id: made.id, code };
    }
    if (!coupon) {
      console.error("club: no free member code after", CODE_TRIES, "tries");
      return { ok: false, kind: "error" };
    }

    const firstName = cleanName(body.firstName);
    const p = ctx.utm?.p;
    let made: ClubMember | { clash: true };
    try {
      made = await deps.insertMember({
        email,
        phone,
        phone_key: phoneKey(phone),
        first_name: firstName,
        last_name: cleanName(body.lastName),
        coupon_id: coupon.id,
        coupon_code: coupon.code,
        source,
        source_path: typeof ctx.sourcePath === "string" ? ctx.sourcePath.slice(0, 300) : null,
        event_id: eventId,
        utm: ctx.utm,
        utm_source: p?.s ?? null,
        utm_medium: p?.m ?? null,
        utm_campaign: p?.c ?? null,
        consent_text: CLUB_CONSENT_TEXT,
        consent_version: CLUB_CONSENT_VERSION,
      });
    } catch (e) {
      // A deadline cancels the request, not the insert: the row may have landed. Never delete a code a member holds
      // (Review: a member whose code was deleted under them is handed a dead code on every later visit).
      const holder = await deps.memberByEmail(email).catch(() => null);
      if (holder && holder.coupon_code === coupon.code) {
        made = holder;
      } else {
        await deps.deleteCoupon(coupon.id).catch((err) => console.error("club: orphan coupon left:", coupon?.id, err));
        if (holder) return await rejoin(holder);
        throw e;
      }
    }

    if (isClash(made)) {
      // The same email joined a moment ago (double click, two tabs): drop ours, answer theirs (Review Focus 1).
      await deps.deleteCoupon(coupon.id).catch((err) => console.error("club: orphan coupon left:", coupon?.id, err));
      const winner = await deps.memberByEmail(email);
      return winner ? await rejoin(winner) : { ok: false, kind: "error" };
    }

    await safeLog(deps, {
      member_id: made.id,
      action: "join",
      consent_text: CLUB_CONSENT_TEXT,
      consent_version: CLUB_CONSENT_VERSION,
      ip: ctx.ip,
      user_agent: ctx.userAgent,
      source,
    });
    await mailAndRecord(deps, made);
    return answer(made, amount, false, firstName);
  } catch (e) {
    console.error("club: join failed:", e);
    return { ok: false, kind: "error" };
  }
}

export async function lookupClub(input: unknown, ctx: ClubCtx, deps: ClubDeps): Promise<ClubAnswer> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const email = cleanEmail(body.email);
  if (!email || !honeypotEmpty(body.hp)) return { ok: false, kind: "invalid" };
  const source = "checkout_lookup";

  const settings = await enabledSettings(deps);
  if (!settings) return { ok: false, kind: "off" };
  if (await overLimit(deps, ctx, LOOKUP_ACTIONS)) return { ok: false, kind: "rate_limited" };

  try {
    const m = await deps.memberByEmail(email);
    if (m && m.status === "active" && m.discount_value == null) {
      console.error("club: member", m.member_no, "has no code row - not handing out a dead code");
      return { ok: false, kind: "error" };
    }
    if (!m || m.status !== "active") {
      await safeLog(deps, { member_id: null, action: "lookup_miss", ip: ctx.ip, user_agent: ctx.userAgent, source });
      return { ok: false, kind: "not_found" };
    }
    await safeLog(deps, { member_id: m.id, action: "lookup", ip: ctx.ip, user_agent: ctx.userAgent, source });
    // Whoever types an email must not learn whose it is: no name (spec §8).
    return answer(m, settings.discount_per_traveler_usd, true, null);
  } catch (e) {
    console.error("club: lookup failed:", e);
    return { ok: false, kind: "error" };
  }
}

/** Stops every channel's marketing; the member and the member price stay (D9). */
export async function unsubscribeClub(
  token: unknown,
  ctx: ClubCtx,
  deps: ClubDeps,
): Promise<{ ok: true } | { ok: false; kind: "not_found" | "error" }> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, kind: "not_found" };
  try {
    const m = await deps.memberByToken(token);
    if (!m) return { ok: false, kind: "not_found" };
    if (m.marketing === "unsubscribed") return { ok: true };
    await deps.markUnsubscribed(m.id, ctx.now);
    await safeLog(deps, { member_id: m.id, action: "unsubscribe", ip: ctx.ip, user_agent: ctx.userAgent, source: "link" });
    return { ok: true };
  } catch (e) {
    console.error("club: unsubscribe failed:", e);
    return { ok: false, kind: "error" };
  }
}

/** D13: leaving the club from the unsubscribe page - the updates stop and the member code goes off. */
export async function leaveClub(
  token: unknown,
  ctx: ClubCtx,
  deps: ClubDeps,
): Promise<{ ok: true } | { ok: false; kind: "not_found" | "error" }> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false, kind: "not_found" };
  try {
    const m = await deps.memberByToken(token);
    if (!m) return { ok: false, kind: "not_found" };
    if (m.status !== "active") return { ok: true }; // already left, or removed by staff: nothing to do
    await deps.markLeft(m.id, ctx.now);
    await safeLog(deps, { member_id: m.id, action: "left", ip: ctx.ip, user_agent: ctx.userAgent, source: "link" });
    return { ok: true };
  } catch (e) {
    console.error("club: leave failed:", e);
    return { ok: false, kind: "error" };
  }
}

/** The backoffice's "Resend welcome mail" (Members tab). Answer shape = what lib/actions/club-actions.ts reads. */
export async function resendWelcome(memberId: string, deps: ClubDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const m = await deps.memberById(memberId);
    if (!m) return { ok: false, error: "member not found" };
    const r = await mailAndRecord(deps, m);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    console.error("club: resend failed:", e);
    return { ok: false, error: "the site could not read the member" };
  }
}
