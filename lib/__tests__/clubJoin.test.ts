import { describe, expect, it } from "vitest";
import {
  joinClub,
  leaveClub,
  lookupClub,
  resendWelcome,
  unsubscribeClub,
  type ClubCtx,
  type ClubDeps,
  type ClubLogInsert,
  type ClubMember,
  type NewClubMember,
} from "@/lib/club/join";
import { CLUB_CONSENT_TEXT, CLUB_CONSENT_VERSION } from "@/lib/club/copy";
import type { ClubSettings } from "@/lib/club/rules";

const ON: ClubSettings = { enabled: true, discount_per_traveler_usd: 50, popup_delay_seconds: 22 };

type Fake = ClubDeps & {
  coupons: { id: number; code: string; amount: number }[];
  deletedCoupons: number[];
  members: ClubMember[];
  logs: ClubLogInsert[];
  welcome: { id: string; result: { ok: boolean } }[];
  unsubscribed: string[];
  left: string[];
  reactivated: string[];
};

function member(over: Partial<ClubMember> = {}): ClubMember {
  return {
    id: "m-1",
    member_no: 1001,
    email: "dana@gmail.com",
    first_name: "דנה",
    coupon_code: "MEGAK7Q2XP",
    status: "active",
    marketing: "subscribed",
    unsubscribe_token: "0123456789abcdef0123456789abcdef",
    discount_value: 50,
    ...over,
  };
}

function fake(opts: {
  settings?: ClubSettings | "throw";
  recent?: number;
  existing?: ClubMember[];
  memberClash?: ClubMember;
  couponClashes?: number;
  /** insertMember throws: "committed" = the row landed anyway (a timeout after the commit), "lost" = it did not. */
  insertThrows?: "committed" | "lost";
  mail?: "ok" | "reject" | "fail";
} = {}): Fake {
  let nextCoupon = 500;
  let clashesLeft = opts.couponClashes ?? 0;
  const f: Fake = {
    coupons: [],
    deletedCoupons: [],
    members: [...(opts.existing ?? [])],
    logs: [],
    welcome: [],
    unsubscribed: [],
    left: [],
    reactivated: [],
    async settings() {
      if (opts.settings === "throw") throw new Error("db down");
      return opts.settings ?? ON;
    },
    async countRecent() {
      return opts.recent ?? 0;
    },
    async memberByEmail(email) {
      return f.members.find((m) => m.email === email) ?? null;
    },
    async memberByToken(token) {
      return f.members.find((m) => m.unsubscribe_token === token) ?? null;
    },
    async memberById(id) {
      return f.members.find((m) => m.id === id) ?? null;
    },
    async insertCoupon(code, amount) {
      if (clashesLeft > 0) {
        clashesLeft--;
        return { clash: true };
      }
      const id = nextCoupon++;
      f.coupons.push({ id, code, amount });
      return { id };
    },
    async deleteCoupon(id) {
      f.deletedCoupons.push(id);
      f.coupons = f.coupons.filter((c) => c.id !== id);
    },
    async insertMember(row: NewClubMember) {
      if (opts.insertThrows) {
        if (opts.insertThrows === "committed")
          f.members.push(member({ id: "m-late", member_no: 1042, email: row.email, coupon_code: row.coupon_code }));
        throw new Error("canceling statement due to user request");
      }
      if (opts.memberClash) {
        f.members.push(opts.memberClash);
        return { clash: true };
      }
      const m = member({
        id: "m-new",
        member_no: 1041,
        email: row.email,
        first_name: row.first_name,
        coupon_code: row.coupon_code,
        unsubscribe_token: "tok-new",
      });
      f.members.push(m);
      (f as unknown as { lastRow: NewClubMember }).lastRow = row;
      return m;
    },
    async markUnsubscribed(id) {
      f.unsubscribed.push(id);
      const m = f.members.find((x) => x.id === id);
      if (m) m.marketing = "unsubscribed";
    },
    async markLeft(id) {
      f.left.push(id);
      const m = f.members.find((x) => x.id === id);
      if (m) {
        m.status = "left";
        m.marketing = "unsubscribed";
      }
    },
    async reactivateMember(id) {
      f.reactivated.push(id);
      const m = f.members.find((x) => x.id === id);
      if (m) m.status = "active";
    },
    async log(row) {
      f.logs.push(row);
    },
    async sendWelcome() {
      if (opts.mail === "reject") throw new Error("smtp down");
      if (opts.mail === "fail") return { ok: false, error: "550 no credits" };
      return { ok: true };
    },
    async markWelcome(id, result) {
      f.welcome.push({ id, result });
    },
    randomInt: () => 3,
  };
  return f;
}

const ctx: ClubCtx = {
  ip: "1.2.3.4",
  userAgent: "test-agent",
  sourcePath: "/order/812",
  utm: null,
  now: new Date("2026-11-09T10:00:00Z"),
};

const join = {
  email: " Dana@Gmail.COM ",
  phone: "050-123-4567",
  consent: true,
  firstName: "דנה",
  lastName: "כהן",
  eventId: 812,
  method: "popup",
  hp: "",
};

describe("joinClub", () => {
  it("a new email becomes a member with one coupon and a recorded consent", async () => {
    const f = fake();
    const a = await joinClub(join, ctx, f);
    expect(a).toEqual({
      ok: true,
      code: "MEGADDDDDD",
      memberNo: 1041,
      firstName: "דנה",
      discountType: "fixed",
      discountValue: 50,
      perPerson: true,
      returning: false,
    });
    expect(f.coupons).toEqual([{ id: 500, code: "MEGADDDDDD", amount: 50 }]);
    const row = (f as unknown as { lastRow: NewClubMember }).lastRow;
    expect(row).toMatchObject({
      email: "dana@gmail.com",
      phone: "0501234567",
      phone_key: "501234567",
      coupon_id: 500,
      coupon_code: "MEGADDDDDD",
      source: "checkout_popup",
      source_path: "/order/812",
      event_id: 812,
      consent_text: CLUB_CONSENT_TEXT,
      consent_version: CLUB_CONSENT_VERSION,
    });
    expect(f.logs).toEqual([
      {
        member_id: "m-new",
        action: "join",
        consent_text: CLUB_CONSENT_TEXT,
        consent_version: CLUB_CONSENT_VERSION,
        ip: "1.2.3.4",
        user_agent: "test-agent",
        source: "checkout_popup",
      },
    ]);
    expect(f.welcome).toEqual([{ id: "m-new", result: { ok: true } }]);
  });

  it("a row join is recorded as the row", async () => {
    const f = fake();
    await joinClub({ ...join, method: "row" }, ctx, f);
    expect(f.logs[0].source).toBe("checkout_row");
  });

  it("refuses a join without consent and writes nothing", async () => {
    const f = fake();
    expect(await joinClub({ ...join, consent: false }, ctx, f)).toEqual({ ok: false, kind: "invalid" });
    expect(await joinClub({ ...join, consent: "true" }, ctx, f)).toEqual({ ok: false, kind: "invalid" });
    expect(f.coupons).toEqual([]);
    expect(f.logs).toEqual([]);
  });

  it("refuses a filled honeypot", async () => {
    const f = fake();
    expect(await joinClub({ ...join, hp: "http://spam" }, ctx, f)).toEqual({ ok: false, kind: "invalid" });
    expect(f.coupons).toEqual([]);
  });

  it("refuses a bad email or phone", async () => {
    const f = fake();
    expect(await joinClub({ ...join, email: "dana@" }, ctx, f)).toEqual({ ok: false, kind: "invalid" });
    expect(await joinClub({ ...join, phone: "123" }, ctx, f)).toEqual({ ok: false, kind: "invalid" });
    expect(await joinClub(null, ctx, f)).toEqual({ ok: false, kind: "invalid" });
  });

  it("answers off when the club is switched off", async () => {
    const f = fake({ settings: { ...ON, enabled: false } });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "off" });
    expect(f.coupons).toEqual([]);
  });

  it("answers off, never error, when the settings cannot be read", async () => {
    expect(await joinClub(join, ctx, fake({ settings: "throw" }))).toEqual({ ok: false, kind: "off" });
  });

  it("stops the sixth join from one address in an hour", async () => {
    const f = fake({ recent: 5 });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "rate_limited" });
    expect(f.coupons).toEqual([]);
  });

  it("never refuses a request with no address", async () => {
    const f = fake({ recent: 99 });
    expect((await joinClub(join, { ...ctx, ip: null }, f)).ok).toBe(true);
  });

  it("an existing member gets their own code back, no name, nothing changed", async () => {
    const existing = member({ marketing: "unsubscribed" });
    const f = fake({ existing: [existing] });
    const a = await joinClub(join, ctx, f);
    expect(a).toEqual({
      ok: true,
      code: "MEGAK7Q2XP",
      memberNo: 1001,
      firstName: null,
      discountType: "fixed",
      discountValue: 50,
      perPerson: true,
      returning: true,
    });
    expect(f.coupons).toEqual([]);
    expect(f.members[0].marketing).toBe("unsubscribed");
    expect(f.logs.map((l) => [l.action, l.member_id])).toEqual([["rejoin", "m-1"]]);
    expect(f.welcome).toEqual([]);
  });

  it("a removed member is refused", async () => {
    const f = fake({ existing: [member({ status: "removed" })] });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "removed" });
  });

  it("two joins at once: the loser deletes its coupon and answers the winner's code", async () => {
    const winner = member({ id: "m-win", member_no: 1050, coupon_code: "MEGAWINNER" });
    const f = fake({ memberClash: winner });
    const a = await joinClub(join, ctx, f);
    expect(a).toMatchObject({ ok: true, code: "MEGAWINNER", memberNo: 1050, returning: true, firstName: null });
    expect(f.deletedCoupons).toEqual([500]);
    expect(f.coupons).toEqual([]);
    expect(f.logs.map((l) => l.action)).toEqual(["rejoin"]);
  });

  it("draws another code when one is taken", async () => {
    const f = fake({ couponClashes: 2 });
    expect((await joinClub(join, ctx, f)).ok).toBe(true);
    expect(f.coupons).toHaveLength(1);
  });

  it("gives up after three taken codes", async () => {
    const f = fake({ couponClashes: 3 });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "error" });
    expect(f.members).toEqual([]);
  });

  it("a member insert that timed out after committing is the join: its code is kept", async () => {
    const f = fake({ insertThrows: "committed" });
    const a = await joinClub(join, ctx, f);
    expect(a).toMatchObject({ ok: true, code: "MEGADDDDDD", memberNo: 1042, returning: false });
    expect(f.deletedCoupons).toEqual([]);
    expect(f.logs.map((l) => l.action)).toEqual(["join"]);
  });

  it("a member insert that failed outright deletes its code", async () => {
    const f = fake({ insertThrows: "lost" });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "error" });
    expect(f.deletedCoupons).toEqual([500]);
  });

  it("a member whose code is gone is never handed a dead code", async () => {
    const f = fake({ existing: [member({ discount_value: null })] });
    expect(await joinClub(join, ctx, f)).toEqual({ ok: false, kind: "error" });
    expect(await lookupClub({ email: "dana@gmail.com", hp: "" }, ctx, f)).toEqual({ ok: false, kind: "error" });
  });

  it("a returning member is answered with their own code's amount", async () => {
    const f = fake({ existing: [member({ discount_value: 80 })] });
    expect(await joinClub(join, ctx, f)).toMatchObject({ ok: true, discountValue: 80, returning: true });
    expect(await lookupClub({ email: "dana@gmail.com", hp: "" }, ctx, f)).toMatchObject({ ok: true, discountValue: 80 });
  });

  it("a refused mail never fails the join", async () => {
    const f = fake({ mail: "reject" });
    const a = await joinClub(join, ctx, f);
    expect(a).toMatchObject({ ok: true, returning: false });
    expect(f.welcome).toHaveLength(1);
    expect(f.welcome[0].result.ok).toBe(false);
  });

  it("a mail server's no is recorded", async () => {
    const f = fake({ mail: "fail" });
    expect((await joinClub(join, ctx, f)).ok).toBe(true);
    expect(f.welcome[0].result).toEqual({ ok: false, error: "550 no credits" });
  });
});

describe("lookupClub", () => {
  it("an unknown email is not found, logged with no member", async () => {
    const f = fake();
    expect(await lookupClub({ email: "nobody@x.com", hp: "" }, ctx, f)).toEqual({ ok: false, kind: "not_found" });
    expect(f.logs.map((l) => [l.action, l.member_id])).toEqual([["lookup_miss", null]]);
  });

  it("a known email gets the code and number, never the name", async () => {
    const f = fake({ existing: [member()] });
    const a = await lookupClub({ email: "DANA@gmail.com", hp: "" }, ctx, f);
    expect(a).toMatchObject({ ok: true, code: "MEGAK7Q2XP", memberNo: 1001, firstName: null, returning: true });
    expect(f.logs.map((l) => [l.action, l.member_id])).toEqual([["lookup", "m-1"]]);
  });

  it("a removed member is not found", async () => {
    const f = fake({ existing: [member({ status: "removed" })] });
    expect(await lookupClub({ email: "dana@gmail.com", hp: "" }, ctx, f)).toEqual({ ok: false, kind: "not_found" });
  });

  it("is rate limited and honeypotted like the join", async () => {
    expect(await lookupClub({ email: "dana@gmail.com", hp: "" }, ctx, fake({ recent: 5 }))).toEqual({
      ok: false,
      kind: "rate_limited",
    });
    expect(await lookupClub({ email: "dana@gmail.com", hp: "x" }, ctx, fake())).toEqual({ ok: false, kind: "invalid" });
  });
});

describe("unsubscribeClub", () => {
  it("stops the updates and keeps the member", async () => {
    const f = fake({ existing: [member()] });
    expect(await unsubscribeClub("0123456789abcdef0123456789abcdef", ctx, f)).toEqual({ ok: true });
    expect(f.unsubscribed).toEqual(["m-1"]);
    expect(f.members[0].status).toBe("active");
    expect(f.logs.map((l) => [l.action, l.source])).toEqual([["unsubscribe", "link"]]);
  });

  it("a second click changes nothing", async () => {
    const f = fake({ existing: [member({ marketing: "unsubscribed" })] });
    expect(await unsubscribeClub("0123456789abcdef0123456789abcdef", ctx, f)).toEqual({ ok: true });
    expect(f.unsubscribed).toEqual([]);
    expect(f.logs).toEqual([]);
  });

  it("an unknown or malformed token is not found", async () => {
    expect(await unsubscribeClub("nope", ctx, fake())).toEqual({ ok: false, kind: "not_found" });
    expect(await unsubscribeClub("../../etc", ctx, fake())).toEqual({ ok: false, kind: "not_found" });
  });
});

describe("leaveClub (D13)", () => {
  const T = "0123456789abcdef0123456789abcdef";
  it("leaves: the code goes off, the updates stop, logged as left", async () => {
    const f = fake({ existing: [member()] });
    expect(await leaveClub(T, ctx, f)).toEqual({ ok: true });
    expect(f.left).toEqual(["m-1"]);
    expect(f.logs.map((l) => [l.action, l.source])).toEqual([["left", "link"]]);
  });
  it("leaving twice changes nothing", async () => {
    const f = fake({ existing: [member({ status: "left", marketing: "unsubscribed" })] });
    expect(await leaveClub(T, ctx, f)).toEqual({ ok: true });
    expect(f.left).toEqual([]);
    expect(f.logs).toEqual([]);
  });
  it("a member staff removed is left as staff left them", async () => {
    const f = fake({ existing: [member({ status: "removed" })] });
    expect(await leaveClub(T, ctx, f)).toEqual({ ok: true });
    expect(f.left).toEqual([]);
  });
  it("an unknown or malformed token is not found", async () => {
    expect(await leaveClub("nope", ctx, fake())).toEqual({ ok: false, kind: "not_found" });
    expect(await leaveClub(T, ctx, fake())).toEqual({ ok: false, kind: "not_found" });
  });
  it("a member who left and joins again is a member again, updates still off", async () => {
    const f = fake({ existing: [member({ status: "left", marketing: "unsubscribed" })] });
    const a = await joinClub(join, ctx, f);
    expect(a).toMatchObject({ ok: true, code: "MEGAK7Q2XP", returning: true, firstName: null });
    expect(f.reactivated).toEqual(["m-1"]);
    expect(f.members[0].marketing).toBe("unsubscribed");
    expect(f.coupons).toEqual([]);
  });
  it("a member who left is not found by the lookup", async () => {
    const f = fake({ existing: [member({ status: "left" })] });
    expect(await lookupClub({ email: "dana@gmail.com", hp: "" }, ctx, f)).toEqual({ ok: false, kind: "not_found" });
  });
});

describe("joinClub from the summary's card (D16)", () => {
  it("is recorded as the inline card", async () => {
    const f = fake();
    expect((await joinClub({ ...join, method: "inline" }, ctx, f)).ok).toBe(true);
    expect(f.logs[0].source).toBe("checkout_inline");
    expect((f as unknown as { lastRow: NewClubMember }).lastRow.source).toBe("checkout_inline");
  });
});

describe("joinClub from the /club page (D15)", () => {
  it("is recorded as the site page, with no event", async () => {
    const f = fake();
    const a = await joinClub({ ...join, method: "page", eventId: undefined }, ctx, f);
    expect(a.ok).toBe(true);
    expect(f.logs[0].source).toBe("site_page");
    expect((f as unknown as { lastRow: NewClubMember }).lastRow).toMatchObject({ source: "site_page", event_id: null });
  });
});

describe("resendWelcome", () => {
  it("sends and records the result", async () => {
    const f = fake({ existing: [member()] });
    expect(await resendWelcome("m-1", f)).toEqual({ ok: true });
    expect(f.welcome).toEqual([{ id: "m-1", result: { ok: true } }]);
  });
  it("says why it failed", async () => {
    const f = fake({ existing: [member()], mail: "fail" });
    expect(await resendWelcome("m-1", f)).toEqual({ ok: false, error: "550 no credits" });
  });
  it("an unknown member is an error", async () => {
    expect(await resendWelcome("m-x", fake())).toEqual({ ok: false, error: "member not found" });
  });
});
