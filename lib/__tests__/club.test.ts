import { describe, expect, it } from "vitest";
import {
  CLUB_COOKIE,
  MEMBER_CODE_ALPHABET,
  cleanEmail,
  cleanPhone,
  inlineJoinKey,
  clubCouponQty,
  clubSurface,
  couponFitsOrder,
  footerClubShows,
  maskEmail,
  newMemberCode,
  parseClubCookie,
  parseClubSettings,
  phoneKey,
  readClubCookie,
  serializeClubCookie,
  shouldAutoApply,
} from "@/lib/club/rules";
import { CLUB_CONSENT_TEXT, CLUB_CONSENT_VERSION, CLUB_COPY } from "@/lib/club/copy";

const base = {
  enabled: true,
  isAgentVisitor: false,
  arrivedViaPartner: false,
  flightSkipped: false,
  isPercentageAffiliateDiscount: false,
  isSpecialOfferAllowed: true,
};

describe("clubSurface (spec §4)", () => {
  it("everyone else gets the club", () => expect(clubSurface(base)).toBe("club"));
  it("agent mode gets nothing", () => expect(clubSurface({ ...base, isAgentVisitor: true })).toBe("none"));
  it("a percentage partner gets nothing", () =>
    expect(clubSurface({ ...base, isPercentageAffiliateDiscount: true })).toBe("none"));
  it("a blocklisted event gets nothing", () => expect(clubSurface({ ...base, isSpecialOfferAllowed: false })).toBe("none"));
  it("a ticket-only order gets nothing", () => expect(clubSurface({ ...base, flightSkipped: true })).toBe("none"));
  it("a partner-link visit gets today's popup", () =>
    expect(clubSurface({ ...base, arrivedViaPartner: true })).toBe("legacy_popup"));
  it("club off gets today's popup", () => expect(clubSurface({ ...base, enabled: false })).toBe("legacy_popup"));
  it("agent mode wins over a partner link", () =>
    expect(clubSurface({ ...base, isAgentVisitor: true, arrivedViaPartner: true })).toBe("none"));
  it("ticket-only wins over club off", () =>
    expect(clubSurface({ ...base, enabled: false, flightSkipped: true })).toBe("none"));
});

describe("newMemberCode", () => {
  it("is MEGA + 6 from the alphabet", () => expect(newMemberCode(() => 0)).toBe("MEGAAAAAAA"));
  it("never leaves the alphabet", () => {
    for (let i = 0; i < 1000; i++) {
      const code = newMemberCode((max) => Math.floor(Math.random() * max));
      expect(code).toMatch(/^MEGA.{6}$/);
      for (const ch of code.slice(4)) expect(MEMBER_CODE_ALPHABET).toContain(ch);
    }
  });
  it("has no look-alike letters", () => {
    for (const ch of ["0", "O", "1", "I", "L"]) expect(MEMBER_CODE_ALPHABET).not.toContain(ch);
  });
});

describe("email and phone in real-world shapes", () => {
  it("trims and lower-cases an email", () => expect(cleanEmail(" Dana@Gmail.COM ")).toBe("dana@gmail.com"));
  it("refuses a broken email", () => {
    expect(cleanEmail("dana@")).toBeNull();
    expect(cleanEmail("dana gmail.com")).toBeNull();
    expect(cleanEmail(42)).toBeNull();
    expect(cleanEmail(`${"a".repeat(250)}@x.co`)).toBeNull();
  });
  it("keeps the digits of a phone", () => {
    expect(cleanPhone("+972 50-123-4567")).toBe("972501234567");
    expect(cleanPhone("050 1234567")).toBe("0501234567");
  });
  it("refuses a phone that is too short or too long", () => {
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("1".repeat(16))).toBeNull();
    expect(cleanPhone(null)).toBeNull();
  });
  it("keys a phone on its last 9 digits", () => {
    expect(phoneKey("972501234567")).toBe("501234567");
    expect(phoneKey("0501234567")).toBe("501234567");
  });
  it("masks an email", () => {
    expect(maskEmail("dana@gmail.com")).toBe("d***@gmail.com");
    expect(maskEmail("x@y.co")).toBe("x***@y.co");
  });
});

describe("the coupon quantity and the flight rule", () => {
  it("a club code counts event tickets", () => expect(clubCouponQty({ source: "club" }, 3, 2)).toBe(2));
  it("any other code counts persons", () => {
    expect(clubCouponQty({ source: null }, 3, 2)).toBe(3);
    expect(clubCouponQty({}, 3, 2)).toBe(3);
  });
  it("a club code needs an outbound flight", () => {
    expect(couponFitsOrder("club", false)).toBe(false);
    expect(couponFitsOrder("club", true)).toBe(true);
  });
  it("any other code fits any order", () => {
    expect(couponFitsOrder(null, false)).toBe(true);
    expect(couponFitsOrder(undefined, false)).toBe(true);
  });
});

describe("parseClubSettings", () => {
  it("unreadable settings mean the club is off", () => {
    expect(parseClubSettings(null)).toEqual({ enabled: false, discount_per_traveler_usd: 50, popup_delay_seconds: 22 });
    expect(parseClubSettings("nope").enabled).toBe(false);
    expect(parseClubSettings({ enabled: true, discount_per_traveler_usd: 0, popup_delay_seconds: 22 }).enabled).toBe(false);
    expect(parseClubSettings({ enabled: true, discount_per_traveler_usd: 50, popup_delay_seconds: 2 }).enabled).toBe(false);
    expect(parseClubSettings({ enabled: "yes", discount_per_traveler_usd: 50, popup_delay_seconds: 22 }).enabled).toBe(false);
  });
  it("reads good settings", () => {
    expect(parseClubSettings({ enabled: true, discount_per_traveler_usd: 50, popup_delay_seconds: 22 })).toEqual({
      enabled: true,
      discount_per_traveler_usd: 50,
      popup_delay_seconds: 22,
    });
    expect(parseClubSettings({ enabled: false, discount_per_traveler_usd: 80, popup_delay_seconds: 30 })).toEqual({
      enabled: false,
      discount_per_traveler_usd: 80,
      popup_delay_seconds: 30,
    });
  });
});

describe("the remembered member", () => {
  const cookie = { v: 1 as const, code: "MEGAK7Q2XP", no: 1041, name: "דנה" };
  it("round-trips", () => expect(parseClubCookie(serializeClubCookie(cookie))).toEqual(cookie));
  it("refuses a code that is not a member code", () => {
    expect(parseClubCookie('{"v":1,"code":"ABC","no":1}')).toBeNull();
    expect(parseClubCookie('{"v":1,"code":"MEGA%%","no":1}')).toBeNull();
    expect(parseClubCookie("garbage")).toBeNull();
    expect(parseClubCookie(null)).toBeNull();
  });
  it("drops a name that is not a short string", () => {
    const parsed = parseClubCookie(JSON.stringify({ v: 1, code: "MEGAK7Q2XP", no: 1041, name: "x".repeat(80) }));
    expect(parsed).toEqual({ v: 1, code: "MEGAK7Q2XP", no: 1041 });
  });
  it("is read out of a cookie header", () => {
    const header = `a=1; ${CLUB_COOKIE}=${serializeClubCookie(cookie)}; b=2`;
    expect(readClubCookie(header)).toEqual(cookie);
    expect(readClubCookie("a=1")).toBeNull();
  });
});

describe("shouldAutoApply", () => {
  const cookie = { v: 1 as const, code: "MEGAK7Q2XP", no: 1041 };
  const ok = { surface: "club" as const, slotEmpty: true, flightSkipped: false, cookie };
  it("applies a remembered member into an empty slot", () => expect(shouldAutoApply(ok)).toBe(true));
  it("never on a ticket-only order", () => expect(shouldAutoApply({ ...ok, flightSkipped: true })).toBe(false));
  it("never over another coupon", () => expect(shouldAutoApply({ ...ok, slotEmpty: false })).toBe(false));
  it("never where the club does not show", () => {
    expect(shouldAutoApply({ ...ok, surface: "legacy_popup" })).toBe(false);
    expect(shouldAutoApply({ ...ok, surface: "none" })).toBe(false);
  });
  it("never without a cookie", () => expect(shouldAutoApply({ ...ok, cookie: null })).toBe(false));
});

describe("copy", () => {
  it("holds the consent text verbatim", () => {
    expect(CLUB_CONSENT_TEXT).toBe("אני רוצה לקבל ממגה איבנטס עדכונים ומבצעים במייל, ב-SMS ובוואטסאפ. אפשר להסיר בכל רגע.");
    expect(CLUB_CONSENT_VERSION).toBe("club-2026-11-09-v1");
  });
  it("names the club MEGA CLUB", () => {
    expect(CLUB_COPY.title).toBe("הצטרפו ל-MEGA CLUB");
    expect(CLUB_COPY.ticketOnly).toBe("מחיר חבר תקף בהזמנת חבילה עם טיסה");
  });
});


describe("inlineJoinKey (D16: the tick joins with the first passenger's details)", () => {
  const ok = { wants: true, email: " Dana@Gmail.com ", phone: "050-123-4567", triedKey: null as string | null };
  it("joins once the box is ticked and the details are valid", () =>
    expect(inlineJoinKey(ok)).toBe("dana@gmail.com|0501234567"));
  it("waits while the box is not ticked", () => expect(inlineJoinKey({ ...ok, wants: false })).toBeNull());
  it("waits for a valid email and phone", () => {
    expect(inlineJoinKey({ ...ok, email: "dana@" })).toBeNull();
    expect(inlineJoinKey({ ...ok, phone: "123" })).toBeNull();
    expect(inlineJoinKey({ ...ok, email: "" })).toBeNull();
  });
  it("never tries the same details twice", () => {
    expect(inlineJoinKey({ ...ok, triedKey: "dana@gmail.com|0501234567" })).toBeNull();
    expect(inlineJoinKey({ ...ok, phone: "0501234568", triedKey: "dana@gmail.com|0501234567" })).toBe("dana@gmail.com|0501234568");
  });
});

describe("footerClubShows (D19: the footer form)", () => {
  const ok = { enabled: true, member: null, partnerCode: null, path: "/" };
  it("shows on an ordinary page for a visitor who is not a member", () => {
    expect(footerClubShows(ok)).toBe(true);
    expect(footerClubShows({ ...ok, path: "/c/music/artists/oasis" })).toBe(true);
    expect(footerClubShows({ ...ok, path: "/orders-help" })).toBe(true);
  });
  it("not while the club is off", () => expect(footerClubShows({ ...ok, enabled: false })).toBe(false));
  it("not for a member this device knows", () =>
    expect(footerClubShows({ ...ok, member: { v: 1, code: "MEGAABCDEF", no: 1042 } })).toBe(false));
  it("not for a visitor who came through a partner's link", () =>
    expect(footerClubShows({ ...ok, partnerCode: "AVIRAN" })).toBe(false));
  it("the form's answers name the member number", () => {
    expect(CLUB_COPY.footerJoined(1042)).toBe("ברוכים הבאים ל-MEGA CLUB! מס׳ חבר 1042. קוד החבר מחכה לכם במייל.");
    expect(CLUB_COPY.footerWelcomeBack(1042)).toContain("מס׳ חבר 1042");
  });
  it("not where the club already has its own place", () => {
    for (const path of ["/order/812", "/order", "/club", "/club/unsubscribe", "/confirmation/9001", "/agent", "/agent/credit", "/partner/x"]) {
      expect(footerClubShows({ ...ok, path })).toBe(false);
    }
  });
});
