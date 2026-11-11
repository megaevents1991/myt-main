// MEGA CLUB - the real deps of lib/club/join.ts over the service client. Server only. Every call carries a 3 s
// deadline (a slow DB answers the page an error, never holds it); explicit columns; the tables are the backoffice's
// (migration 20261109104145_members_club.sql).
import { randomInt } from "crypto";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import type { ClubDeps, ClubLogInsert, ClubMember, MailResult, NewClubMember } from "@/lib/club/join";
import { CLUB_MAIL_FROM, welcomeMail } from "@/lib/club/mail";
import { CLUB_DB_DEADLINE_MS, getClubSettings } from "@/lib/club/settings-server";

const MEMBER_COLUMNS =
  "id, member_no, email, first_name, coupon_code, status, marketing, unsubscribe_token, coupon:coupons!club_members_coupon_id_fkey(discount_value)";

type MemberRow = Omit<ClubMember, "discount_value"> & { coupon: { discount_value: number } | null };

/** The embedded coupon row gives the member's own amount; no row = the code is dead (null). */
function toMember(row: MemberRow | null): ClubMember | null {
  if (!row) return null;
  const { coupon, ...rest } = row;
  return { ...rest, discount_value: coupon ? Number(coupon.discount_value) : null };
}
const PROD_SITE = "https://www.mega-events.co.il";

const deadline = () => AbortSignal.timeout(CLUB_DB_DEADLINE_MS);

type PgError = { code?: string; message: string } | null;

function fail(error: PgError, what: string): never {
  console.error(`club-db: ${what} failed`, JSON.stringify(error));
  throw new Error(`${what} failed: ${error?.message ?? "unknown"}`);
}

/**
 * Where the mail's links point. Production always names www.mega-events.co.il; a preview or a local run points at
 * itself, so the unsubscribe link of a test mail works on the build that sent it.
 */
export function clubSiteUrl(requestOrigin: string | null): string {
  if (process.env.VERCEL_ENV === "production" || !requestOrigin) return PROD_SITE;
  try {
    const u = new URL(requestOrigin);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : PROD_SITE;
  } catch {
    return PROD_SITE;
  }
}

async function sendWelcomeMail(m: ClubMember, siteUrl: string): Promise<MailResult> {
  const user = process.env.EMAIL_SERVER_USER || "";
  const pass = process.env.EMAIL_SERVER_PASSWORD || "";
  if (!user || !pass) return { ok: false, error: "mail is not configured on this build (EMAIL_SERVER_*)" };
  const unsubscribePage = `${siteUrl}/club/unsubscribe?t=${encodeURIComponent(m.unsubscribe_token)}`;
  const oneClick = `${siteUrl}/api/club/unsubscribe?t=${encodeURIComponent(m.unsubscribe_token)}`;
  const mail = welcomeMail({
    memberNo: m.member_no,
    code: m.coupon_code,
    firstName: m.first_name,
    email: m.email,
    unsubscribeUrl: unsubscribePage,
    siteUrl,
  });
  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: { user, pass },
    connectionTimeout: 3500,
    greetingTimeout: 3500,
    socketTimeout: 4000,
  });
  try {
    await transporter.sendMail({
      from: CLUB_MAIL_FROM,
      replyTo: process.env.SALES_REP_EMAIL,
      to: m.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        "List-Unsubscribe": `<${oneClick}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("club: welcome mail refused:", msg);
    return { ok: false, error: msg.slice(0, 500) };
  }
}

export function clubDeps(opts: { siteUrl: string }): ClubDeps {
  return {
    // A join writes the amount into the new code: read it fresh, never from the page's 60 s cache.
    settings: () => getClubSettings(Date.now(), { fresh: true }),

    async countRecent(ip, actions, sinceIso) {
      const { count, error } = await supabase
        .from("club_log")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .in("action", actions)
        .gte("at", sinceIso)
        .abortSignal(deadline());
      if (error) fail(error, "club rate-limit count");
      return count ?? 0;
    },

    async memberByEmail(emailKey) {
      const { data, error } = await supabase
        .from("club_members")
        .select(MEMBER_COLUMNS)
        .eq("email", emailKey)
        .abortSignal(deadline())
        .maybeSingle();
      if (error) fail(error, "club member by email");
      return toMember(data as MemberRow | null);
    },

    async memberByToken(token) {
      const { data, error } = await supabase
        .from("club_members")
        .select(MEMBER_COLUMNS)
        .eq("unsubscribe_token", token)
        .abortSignal(deadline())
        .maybeSingle();
      if (error) fail(error, "club member by token");
      return toMember(data as MemberRow | null);
    },

    async memberById(id) {
      const { data, error } = await supabase
        .from("club_members")
        .select(MEMBER_COLUMNS)
        .eq("id", id)
        .abortSignal(deadline())
        .maybeSingle();
      if (error) fail(error, "club member by id");
      return toMember(data as MemberRow | null);
    },

    async insertCoupon(code, amount) {
      const { data, error } = await supabase
        .from("coupons")
        .insert({
          code,
          discount_type: "fixed",
          discount_value: amount,
          per_person: true,
          is_active: true,
          source: "club",
          event_id: null,
          max_uses: null,
          valid_until: null,
        })
        .select("id")
        .abortSignal(deadline())
        .single();
      if (error?.code === "23505") return { clash: true };
      if (error || !data) fail(error, "member code insert");
      return { id: Number(data.id) };
    },

    async deleteCoupon(id) {
      // Only the orphan of a join that lost its race - a code no member holds and no order used yet. A member row that
      // landed after a timed-out insert keeps its code: look before deleting.
      const held = await supabase.from("club_members").select("id").eq("coupon_id", id).abortSignal(deadline()).maybeSingle();
      if (held.error) fail(held.error, "orphan member code check");
      if (held.data) return;
      const { error } = await supabase.from("coupons").delete().eq("id", id).eq("source", "club").abortSignal(deadline());
      if (error) fail(error, "orphan member code delete");
    },

    async insertMember(row: NewClubMember) {
      const { data, error } = await supabase
        .from("club_members")
        .insert(row)
        .select(MEMBER_COLUMNS)
        .abortSignal(deadline())
        .single();
      if (error?.code === "23505") return { clash: true };
      if (error || !data) fail(error, "club member insert");
      return toMember(data as unknown as MemberRow) as ClubMember;
    },

    async markUnsubscribed(id, at) {
      const iso = at.toISOString();
      const { error } = await supabase
        .from("club_members")
        .update({ marketing: "unsubscribed", unsubscribed_at: iso, unsubscribe_source: "link", updated_at: iso })
        .eq("id", id)
        .abortSignal(deadline());
      if (error) fail(error, "club unsubscribe");
    },

    async markLeft(id, at) {
      const iso = at.toISOString();
      const read = await supabase.from("club_members").select("coupon_id, unsubscribed_at").eq("id", id).abortSignal(deadline()).maybeSingle();
      if (read.error) fail(read.error, "club member read before leaving");
      const patch: Record<string, string> = { status: "left", removed_at: iso, marketing: "unsubscribed", updated_at: iso };
      if (!read.data?.unsubscribed_at) Object.assign(patch, { unsubscribed_at: iso, unsubscribe_source: "link" });
      const { error } = await supabase.from("club_members").update(patch).eq("id", id).abortSignal(deadline());
      if (error) fail(error, "club leave");
      if (read.data?.coupon_id != null) {
        const c = await supabase.from("coupons").update({ is_active: false }).eq("id", read.data.coupon_id).eq("source", "club").abortSignal(deadline());
        if (c.error) fail(c.error, "member code switch off");
      }
    },

    async reactivateMember(id) {
      const now = new Date().toISOString();
      const read = await supabase.from("club_members").select("coupon_id").eq("id", id).abortSignal(deadline()).maybeSingle();
      if (read.error) fail(read.error, "club member read before rejoining");
      const { error } = await supabase
        .from("club_members")
        .update({ status: "active", removed_at: null, updated_at: now })
        .eq("id", id)
        .eq("status", "left")
        .abortSignal(deadline());
      if (error) fail(error, "club rejoin");
      if (read.data?.coupon_id != null) {
        const c = await supabase.from("coupons").update({ is_active: true }).eq("id", read.data.coupon_id).eq("source", "club").abortSignal(deadline());
        if (c.error) fail(c.error, "member code switch on");
      }
    },

    async log(row: ClubLogInsert) {
      const { error } = await supabase.from("club_log").insert(row).abortSignal(deadline());
      if (error) fail(error, `club log ${row.action}`);
    },

    sendWelcome: (m) => sendWelcomeMail(m, opts.siteUrl),

    async markWelcome(id, result) {
      const now = new Date().toISOString();
      const patch = result.ok
        ? { welcome_sent_at: now, welcome_error: null, updated_at: now }
        : { welcome_error: result.error.slice(0, 500), updated_at: now };
      const { error } = await supabase.from("club_members").update(patch).eq("id", id).abortSignal(deadline());
      if (error) fail(error, "welcome mail record");
    },

    randomInt: (max) => randomInt(max),
  };
}
