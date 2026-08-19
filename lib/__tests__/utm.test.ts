import { describe, expect, it } from "vitest";
import {
  applyUtmCapture,
  influencerPrimaryCode,
  parseUtmCookie,
  parseUtmParams,
  readUtmCookieFromHeader,
  sameTouch,
  serializeUtmCookie,
  touchRows,
  utmCookieFits,
  type CookieTouch,
  type UtmCookie,
} from "../utm";

const NOW = "2026-08-16T10:00:00.000Z";

const touch = (over: Partial<CookieTouch> = {}): CookieTouch => ({
  s: "google",
  m: "cpc",
  c: "summer_f1",
  t: null,
  ct: null,
  g: null,
  f: null,
  inf: false,
  at: "2026-08-10T09:00:00.000Z",
  ...over,
});

describe("parseUtmParams", () => {
  it("returns null when none of the 7 params are present", () => {
    expect(parseUtmParams(new URLSearchParams("?foo=1&pkg=abc"))).toBeNull();
  });

  it("captures the 5 utms + click ids", () => {
    const sp = new URLSearchParams(
      "utm_source=google&utm_medium=cpc&utm_campaign=x&utm_term=y&utm_content=z&gclid=g1&fbclid=f1",
    );
    expect(parseUtmParams(sp)).toEqual({
      s: "google",
      m: "cpc",
      c: "x",
      t: "y",
      ct: "z",
      g: "g1",
      f: "f1",
    });
  });

  it("a bare gclid still creates a touch (google auto-tagging)", () => {
    expect(parseUtmParams(new URLSearchParams("gclid=abc"))).toEqual({
      s: null,
      m: null,
      c: null,
      t: null,
      ct: null,
      g: "abc",
      f: null,
    });
  });

  it("trims and caps values at 200 chars", () => {
    const sp = new URLSearchParams(
      `utm_source=${" x".repeat(1) + "a".repeat(300)}`,
    );
    const got = parseUtmParams(sp);
    expect(got?.s?.length).toBeLessThanOrEqual(200);
    expect(got?.s?.startsWith("x")).toBe(true);
  });
});

describe("parseUtmCookie", () => {
  it("round-trips through serializeUtmCookie", () => {
    const cookie: UtmCookie = { v: 1, p: touch(), h: [touch({ s: "old" })] };
    expect(parseUtmCookie(serializeUtmCookie(cookie))).toEqual(cookie);
  });

  it("corrupt json → null", () => {
    expect(parseUtmCookie("{not json")).toBeNull();
  });

  it("wrong shape → null", () => {
    expect(parseUtmCookie(JSON.stringify({ v: 2, foo: 1 }))).toBeNull();
    expect(parseUtmCookie(JSON.stringify({ v: 1 }))).toBeNull();
  });

  it("undefined → null", () => {
    expect(parseUtmCookie(undefined)).toBeNull();
  });
});

describe("readUtmCookieFromHeader", () => {
  it("finds myt_utm among other cookies (url-encoded value)", () => {
    const cookie: UtmCookie = { v: 1, p: touch(), h: [] };
    const header = `session=abc; myt_utm=${encodeURIComponent(serializeUtmCookie(cookie))}; other=1`;
    expect(readUtmCookieFromHeader(header)).toEqual(cookie);
  });

  it("null header → null", () => {
    expect(readUtmCookieFromHeader(null)).toBeNull();
  });
});

describe("applyUtmCapture", () => {
  const incoming = {
    s: "facebook",
    m: "paid",
    c: "c2",
    t: null,
    ct: null,
    g: null,
    f: "fb1",
  };

  it("first capture → becomes primary, empty history", () => {
    const got = applyUtmCapture(null, incoming, false, NOW);
    expect(got.p).toEqual({ ...incoming, inf: false, at: NOW });
    expect(got.h).toEqual([]);
  });

  it("identical set to primary → returns existing unchanged (refresh only)", () => {
    const existing: UtmCookie = { v: 1, p: touch(), h: [] };
    const same = {
      s: "google",
      m: "cpc",
      c: "summer_f1",
      t: null,
      ct: null,
      g: null,
      f: null,
    };
    expect(applyUtmCapture(existing, same, false, NOW)).toBe(existing);
  });

  it("new campaign over campaign → old primary pushed to history", () => {
    const existing: UtmCookie = { v: 1, p: touch(), h: [] };
    const got = applyUtmCapture(existing, incoming, false, NOW);
    expect(got.p.s).toBe("facebook");
    expect(got.h[0].s).toBe("google");
  });

  it("campaign over INFLUENCER → primary protected, touch goes to history", () => {
    const inf = touch({ s: "dani_promo", m: "influencer", inf: true });
    const existing: UtmCookie = { v: 1, p: inf, h: [] };
    const got = applyUtmCapture(existing, incoming, false, NOW);
    expect(got.p).toEqual(inf);
    expect(got.h[0]).toEqual({ ...incoming, inf: false, at: NOW });
  });

  it("influencer over influencer → NEW influencer wins", () => {
    const oldInf = touch({ s: "dani_promo", inf: true });
    const existing: UtmCookie = { v: 1, p: oldInf, h: [] };
    const newInf = {
      s: "roni_promo",
      m: "influencer",
      c: null,
      t: null,
      ct: null,
      g: null,
      f: null,
    };
    const got = applyUtmCapture(existing, newInf, true, NOW);
    expect(got.p.s).toBe("roni_promo");
    expect(got.p.inf).toBe(true);
    expect(got.h[0].s).toBe("dani_promo");
  });

  it("history capped at 5", () => {
    const existing: UtmCookie = {
      v: 1,
      p: touch(),
      h: [1, 2, 3, 4, 5].map((i) => touch({ s: `old${i}` })),
    };
    const got = applyUtmCapture(existing, incoming, false, NOW);
    expect(got.h).toHaveLength(5);
    expect(got.h[0].s).toBe("google");
    expect(got.h[4].s).toBe("old4");
  });
});

describe("serializeUtmCookie size guard", () => {
  it("drops oldest history entries until the ENCODED value is under budget", () => {
    const big = (i: number) => touch({ c: `campaign_${"x".repeat(700)}_${i}` });
    const cookie: UtmCookie = { v: 1, p: big(0), h: [1, 2, 3, 4, 5].map(big) };
    const raw = serializeUtmCookie(cookie);
    expect(encodeURIComponent(raw).length).toBeLessThanOrEqual(3800);
    const parsed = parseUtmCookie(raw)!;
    expect(parsed.p.c).toBe(cookie.p.c); // primary never dropped
    expect(parsed.h.length).toBeLessThan(5);
  });

  it("budget measured on the ENCODED value (Hebrew utms would otherwise pass raw and die on the wire)", () => {
    const heb = (i: number) =>
      touch({ c: `קמפיין_חורף_${"א".repeat(120)}_${i}`, s: "פייסבוק_ישראל" });
    const cookie: UtmCookie = { v: 1, p: heb(0), h: [1, 2, 3, 4, 5].map(heb) };
    const raw = serializeUtmCookie(cookie);
    expect(encodeURIComponent(raw).length).toBeLessThanOrEqual(3800);
    expect(parseUtmCookie(raw)!.p.c).toBe(cookie.p.c);
  });
});

describe("utmCookieFits", () => {
  it("fits: a small serialized cookie is under the encoded budget", () => {
    const cookie: UtmCookie = { v: 1, p: touch(), h: [] };
    expect(utmCookieFits(serializeUtmCookie(cookie))).toBe(true);
  });

  it("does not fit: a 5000-char string exceeds the encoded budget", () => {
    expect(utmCookieFits("x".repeat(5000))).toBe(false);
  });
});

describe("checkout helpers", () => {
  it("influencerPrimaryCode: influencer primary → its source", () => {
    const c: UtmCookie = {
      v: 1,
      p: touch({ s: "dani_promo", inf: true }),
      h: [],
    };
    expect(influencerPrimaryCode(c)).toBe("dani_promo");
  });

  it("influencerPrimaryCode: campaign primary → null", () => {
    expect(influencerPrimaryCode({ v: 1, p: touch(), h: [] })).toBeNull();
  });

  it("influencerPrimaryCode: null cookie → null", () => {
    expect(influencerPrimaryCode(null)).toBeNull();
  });

  it("touchRows maps primary to position 0, history to 1..n", () => {
    const c: UtmCookie = {
      v: 1,
      p: touch({ s: "dani", inf: true }),
      h: [touch({ s: "google" })],
    };
    const rows = touchRows(c, 42);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      reservation_id: 42,
      position: 0,
      utm_source: "dani",
      utm_medium: "cpc",
      utm_campaign: "summer_f1",
      utm_term: null,
      utm_content: null,
      gclid: null,
      fbclid: null,
      is_influencer: true,
      visited_at: touch().at,
    });
    expect(rows[1].position).toBe(1);
    expect(rows[1].utm_source).toBe("google");
  });

  it("touchRows: null cookie → empty array", () => {
    expect(touchRows(null, 42)).toEqual([]);
  });
});

describe("sameTouch", () => {
  it("ignores inf/at, compares the 7 params", () => {
    expect(
      sameTouch(touch({ inf: true, at: "other" }), {
        s: "google",
        m: "cpc",
        c: "summer_f1",
        t: null,
        ct: null,
        g: null,
        f: null,
      }),
    ).toBe(true);
    expect(
      sameTouch(touch(), {
        s: "google",
        m: "cpc",
        c: "DIFF",
        t: null,
        ct: null,
        g: null,
        f: null,
      }),
    ).toBe(false);
  });
});
