import { describe, expect, it } from "vitest";
import {
  CLUB_HANDOFF_MAX_AGE_MS,
  clubConfirmationView,
  clubHandoffFor,
  memberAfterConfirmationJoin,
  readClubHandoff,
  type ClubHandoff,
} from "@/lib/club/confirm";
import type { ClubCookie } from "@/lib/club/rules";
import { CLUB_COPY } from "@/lib/club/copy";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const cookie: ClubCookie = { v: 1, code: "MEGAABCDEF", no: 1042, name: "דנה" };
const lead = { email: " Dana@Gmail.com ", phone: "050-123-4567", firstName: "דנה", lastName: "כהן" };

const base = {
  orderId: 9001,
  now: NOW,
  onlySave: false,
  surface: "club" as const,
  clubPriceApplied: false,
  savedUsd: 0,
  cookie: null as ClubCookie | null,
  joined: null as { memberNo: number; returning: boolean } | null,
  lead,
  eventId: 812,
  perTicketUsd: 50,
};

describe("clubHandoffFor (D17: what the tab carries over the payment page)", () => {
  it("a visitor who joined in this order carries the card and what it saved", () =>
    expect(
      clubHandoffFor({ ...base, joined: { memberNo: 1042, returning: false }, cookie, clubPriceApplied: true, savedUsd: 100 }),
    ).toEqual({ v: 1, orderId: "9001", at: NOW, kind: "member", no: 1042, name: "דנה", savedUsd: 100, joinedNow: true, returning: false }));

  it("a join whose price lost to a better coupon carries the card with nothing saved", () =>
    expect(clubHandoffFor({ ...base, joined: { memberNo: 1042, returning: true }, cookie, savedUsd: 100 })).toMatchObject({
      kind: "member",
      savedUsd: null,
      joinedNow: true,
      returning: true,
    }));

  it("a remembered member whose price went in carries the card", () =>
    expect(clubHandoffFor({ ...base, cookie, clubPriceApplied: true, savedUsd: 150 })).toMatchObject({
      kind: "member",
      no: 1042,
      savedUsd: 150,
      joinedNow: false,
    }));

  it("a remembered member whose price lost carries nothing", () => expect(clubHandoffFor({ ...base, cookie })).toBeNull());

  it("a member code typed by hand carries nothing (no number to print)", () =>
    expect(clubHandoffFor({ ...base, clubPriceApplied: true, savedUsd: 100 })).toBeNull());

  it("a visitor who did not join carries the offer with the first passenger's details", () =>
    expect(clubHandoffFor(base)).toEqual({
      v: 1,
      orderId: "9001",
      at: NOW,
      kind: "offer",
      email: "dana@gmail.com",
      phone: "0501234567",
      firstName: "דנה",
      lastName: "כהן",
      eventId: 812,
      perTicketUsd: 50,
    }));

  it("no offer without a valid email and phone, or without an amount", () => {
    expect(clubHandoffFor({ ...base, lead: { ...lead, email: "dana@" } })).toBeNull();
    expect(clubHandoffFor({ ...base, lead: { ...lead, phone: "12" } })).toBeNull();
    expect(clubHandoffFor({ ...base, lead: null })).toBeNull();
    expect(clubHandoffFor({ ...base, perTicketUsd: null })).toBeNull();
    expect(clubHandoffFor({ ...base, perTicketUsd: 0 })).toBeNull();
  });

  it("nothing on a 24 h hold or where the summary did not show the club", () => {
    expect(clubHandoffFor({ ...base, onlySave: true })).toBeNull();
    expect(clubHandoffFor({ ...base, surface: "legacy_popup" })).toBeNull();
    expect(clubHandoffFor({ ...base, surface: "none", joined: { memberNo: 1, returning: false }, cookie })).toBeNull();
  });

  it("an over-long or blank name is left out, never cut", () => {
    const h = clubHandoffFor({ ...base, lead: { ...lead, firstName: "   ", lastName: "x".repeat(61) } });
    expect(h).toMatchObject({ kind: "offer" });
    expect(h && "firstName" in h).toBe(false);
    expect(h && "lastName" in h).toBe(false);
  });
});

describe("readClubHandoff", () => {
  const offer = clubHandoffFor(base) as ClubHandoff;
  const member = clubHandoffFor({ ...base, cookie, clubPriceApplied: true, savedUsd: 150 }) as ClubHandoff;
  const raw = (h: unknown) => JSON.stringify(h);

  it("reads back what was written for this order", () => {
    expect(readClubHandoff(raw(offer), "9001", NOW + 60_000)).toEqual(offer);
    expect(readClubHandoff(raw(member), "9001", NOW)).toEqual(member);
  });
  it("another order's handoff is not this page's", () => expect(readClubHandoff(raw(offer), "9002", NOW)).toBeNull());
  it("an old handoff is dropped", () => expect(readClubHandoff(raw(offer), "9001", NOW + CLUB_HANDOFF_MAX_AGE_MS + 1)).toBeNull());
  it("anything broken reads as nothing", () => {
    expect(readClubHandoff(null, "9001", NOW)).toBeNull();
    expect(readClubHandoff("{", "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...offer, v: 2 }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...offer, kind: "other" }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...offer, email: "x@" }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...offer, perTicketUsd: -5 }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...member, no: 1.5 }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...member, savedUsd: "100" }), "9001", NOW)).toBeNull();
    expect(readClubHandoff(raw({ ...member, joinedNow: "yes" }), "9001", NOW)).toBeNull();
  });
});

describe("clubConfirmationView", () => {
  const welcome = clubHandoffFor({ ...base, joined: { memberNo: 1042, returning: false }, cookie, clubPriceApplied: true, savedUsd: 100 });
  const saved = clubHandoffFor({ ...base, cookie, clubPriceApplied: true, savedUsd: 150 });
  const offer = clubHandoffFor(base);
  const v = { isHold: false, paymentFailed: false, cookie: null as ClubCookie | null };

  it("a join in this order is a welcome", () => expect(clubConfirmationView({ ...v, handoff: welcome, cookie })).toBe("welcome"));
  it("a remembered member's price is the member card", () => expect(clubConfirmationView({ ...v, handoff: saved, cookie })).toBe("member"));
  it("a visitor who did not join gets the offer", () => expect(clubConfirmationView({ ...v, handoff: offer })).toBe("offer"));
  it("no offer once this device holds a member code", () => expect(clubConfirmationView({ ...v, handoff: offer, cookie })).toBeNull());
  it("nothing on a hold, a failed payment or with no handoff", () => {
    expect(clubConfirmationView({ ...v, handoff: welcome, isHold: true })).toBeNull();
    expect(clubConfirmationView({ ...v, handoff: offer, paymentFailed: true })).toBeNull();
    expect(clubConfirmationView({ ...v, handoff: null })).toBeNull();
  });
});

describe("the confirmation page's words", () => {
  it("prints the saving and the offer in whole dollars", () => {
    expect(CLUB_COPY.confirmSaved(1234.4)).toBe("מחיר החבר חסך לכם $1,234 בהזמנה הזאת, ויופעל לבד בהזמנה הבאה.");
    expect(CLUB_COPY.confirmMemberSaved(150)).toBe("מחיר החבר חסך לכם $150 בהזמנה הזאת.");
    expect(CLUB_COPY.offerText(50)).toBe("הצטרפו בחינם ל-MEGA CLUB וקבלו $50 פחות לכל נוסע בחבילה הבאה.");
    expect(CLUB_COPY.offerTitle).toBe("בהזמנה הבאה: מחיר חבר");
    expect(CLUB_COPY.offerCta).toBe("הצטרפות בחינם");
    expect(CLUB_COPY.confirmMail).toBe("קוד החבר מחכה לכם במייל.");
  });
});

describe("memberAfterConfirmationJoin", () => {
  const offer = clubHandoffFor(base);
  if (!offer || offer.kind !== "offer") throw new Error("expected an offer");

  it("keeps the card and drops the email and phone", () => {
    const m = memberAfterConfirmationJoin(offer, { memberNo: 1050, firstName: "דנה", returning: false }, NOW + 5);
    expect(m).toEqual({ v: 1, orderId: "9001", at: NOW + 5, kind: "member", no: 1050, name: "דנה", savedUsd: null, joinedNow: true, returning: false });
    expect(JSON.stringify(m)).not.toContain("gmail");
    expect(JSON.stringify(m)).not.toContain("0501234567");
  });

  it("a returning email gets no name from this form (the summary's rule)", () => {
    const m = memberAfterConfirmationJoin(offer, { memberNo: 1050, firstName: null, returning: true }, NOW);
    expect(m).toMatchObject({ no: 1050, returning: true });
    expect("name" in m).toBe(false);
  });
});
