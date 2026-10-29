import { describe, expect, it } from "vitest";
import {
  CURRENCY_API_SOURCES,
  type CurrencyFile,
  fileDate,
  parseCurrencyFile,
  pickNewest,
  rateOf,
  readNewestFile,
} from "../currencyApi";

/**
 * The currency API has two mirrors. On 2026-10-29 one jsDelivr CDN still served
 * 28.10's `@latest` file at noon; jsDelivr was asked first and answered, so the
 * site priced with yesterday's dollar (travel rate 3.14 instead of 3.17) while
 * Cloudflare's copy already held the new day. Both are read now and the newer
 * date wins.
 */

const [JSD, CF] = CURRENCY_API_SOURCES.map((s) => s.base);
const usdFile = (date: string | undefined, ils: number) =>
  date === undefined ? { usd: { ils } } : { date, usd: { ils } };

/** A fetch that answers each mirror from `answers` (a function = its own promise). */
function fakeFetch(
  answers: Record<string, unknown | (() => Promise<unknown>)>,
): (url: string) => Promise<unknown> {
  return async (url) => {
    const mirror = url.startsWith(JSD) ? JSD : url.startsWith(CF) ? CF : "";
    const answer = answers[mirror];
    if (typeof answer === "function") return (answer as () => Promise<unknown>)();
    if (answer instanceof Error) throw answer;
    return answer;
  };
}

const file = (source: string, date: string | null, ils = 3): CurrencyFile => ({
  source,
  date,
  rates: { ils },
});

describe("pickNewest", () => {
  it("takes the later date", () => {
    expect(pickNewest([file("jsdelivr", "2026-10-28"), file("cloudflare", "2026-10-29")])?.source).toBe("cloudflare");
  });
  it("keeps the first source on a tie", () => {
    expect(pickNewest([file("jsdelivr", "2026-10-29"), file("cloudflare", "2026-10-29")])?.source).toBe("jsdelivr");
  });
  it("a file with a date beats one without", () => {
    expect(pickNewest([file("jsdelivr", null), file("cloudflare", "2026-10-01")])?.source).toBe("cloudflare");
    expect(pickNewest([file("jsdelivr", "2026-10-01"), file("cloudflare", null)])?.source).toBe("jsdelivr");
  });
  it("nothing in, nothing out", () => {
    expect(pickNewest([])).toBeNull();
  });
});

describe("reading a file", () => {
  it("reads the date only when it is a calendar day", () => {
    expect(fileDate({ date: "2026-10-29" })).toBe("2026-10-29");
    expect(fileDate({ date: "29.10.2026" })).toBeNull();
    expect(fileDate(null)).toBeNull();
  });
  it("needs the base's table and a finite number", () => {
    expect(parseCurrencyFile("x", "usd", { date: "2026-10-29" })).toBeNull();
    expect(parseCurrencyFile("x", "usd", { usd: [1] })).toBeNull();
    const f = parseCurrencyFile("x", "usd", { date: "2026-10-29", usd: { ils: 3.12, eur: "0.9" } });
    expect(f && rateOf(f, "ils")).toBe(3.12);
    expect(f && rateOf(f, "eur")).toBeNull();
  });
});

describe("readNewestFile", () => {
  it("29.10: a stale jsDelivr file loses to Cloudflare's newer day", async () => {
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: usdFile("2026-10-28", 3.0858), [CF]: usdFile("2026-10-29", 3.1195) }),
    });
    expect(got?.source).toBe("cloudflare");
    expect(got && rateOf(got, "ils")).toBe(3.1195);
  });

  it("the same day on both: jsDelivr, as before", async () => {
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: usdFile("2026-10-29", 3.1), [CF]: usdFile("2026-10-29", 3.2) }),
    });
    expect(got?.source).toBe("jsdelivr");
  });

  it("one mirror down = the other one's file", async () => {
    const errors: string[] = [];
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: new Error("HTTP 503"), [CF]: usdFile("2026-10-29", 3.12) }),
      onError: (source) => errors.push(source),
    });
    expect(got?.source).toBe("cloudflare");
    expect(errors).toEqual(["jsdelivr"]);
  });

  it("both down = null, never a throw", async () => {
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: new Error("a"), [CF]: new Error("b") }),
    });
    expect(got).toBeNull();
  });

  it("a refused rate counts as no answer", async () => {
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: usdFile("2026-10-28", 3.08), [CF]: usdFile("2026-10-29", 99) }),
      accept: (f) => (rateOf(f, "ils") ?? 0) < 5,
    });
    expect(got?.source).toBe("jsdelivr");
  });

  it("a mirror that hangs costs the grace, not its whole timeout", async () => {
    const started = Date.now();
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({ [JSD]: usdFile("2026-10-28", 3.08), [CF]: () => new Promise(() => {}) }),
      graceMs: 30,
    });
    expect(got?.source).toBe("jsdelivr");
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("a newer file that arrives inside the grace still wins", async () => {
    const got = await readNewestFile("usd", {
      fetchJson: fakeFetch({
        [JSD]: usdFile("2026-10-28", 3.08),
        [CF]: () => new Promise((r) => setTimeout(() => r(usdFile("2026-10-29", 3.12)), 20)),
      }),
      graceMs: 200,
    });
    expect(got?.source).toBe("cloudflare");
  });
});
