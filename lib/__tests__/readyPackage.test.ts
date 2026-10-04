import { describe, expect, it } from "vitest";
import {
  neighbourPax,
  pickPax,
  readyMode,
  readyPackageCardPrice,
  readyPackageEntry,
  variantSizes,
} from "../events/readyPackage";

const TOKEN = "69729631-8be5-418b-ab09-dea86e55de02";
const event = (mode: string | null, token: string | null = TOKEN) => ({
  ready_package_token: token,
  ready_package_mode: mode as "off" | "preview" | "live" | null,
});

describe("readyMode", () => {
  it("reads the three modes and treats anything else as off", () => {
    expect(readyMode("live")).toBe("live");
    expect(readyMode("preview")).toBe("preview");
    expect(readyMode("off")).toBe("off");
    expect(readyMode(null)).toBe("off");
    expect(readyMode(undefined)).toBe("off");
    expect(readyMode("paused")).toBe("off");
  });
});

describe("readyPackageEntry", () => {
  it("is the regular flow for an event without a package", () => {
    expect(readyPackageEntry(event("live", null), "")).toBeNull();
    expect(readyPackageEntry(undefined, "")).toBeNull();
    expect(readyPackageEntry({}, `?ready=${TOKEN}`)).toBeNull();
  });

  it("is the regular flow while the mode is off, even with the token", () => {
    expect(readyPackageEntry(event("off"), `?ready=${TOKEN}`)).toBeNull();
    expect(readyPackageEntry(event(null), `?ready=${TOKEN}`)).toBeNull();
  });

  it("opens a preview only for the link that carries the event's own token", () => {
    expect(readyPackageEntry(event("preview"), "")).toBeNull();
    expect(readyPackageEntry(event("preview"), "?utm_source=meta")).toBeNull();
    expect(readyPackageEntry(event("preview"), "?ready=someone-elses")).toBeNull();
    expect(readyPackageEntry(event("preview"), `?ready=${TOKEN}`)).toBe(TOKEN);
    expect(readyPackageEntry(event("preview"), `?utm_source=x&ready=${TOKEN}`)).toBe(TOKEN);
  });

  it("opens a live package on a plain visit", () => {
    expect(readyPackageEntry(event("live"), "")).toBe(TOKEN);
    expect(readyPackageEntry(event("live"), "?utm_source=meta&utm_medium=paid")).toBe(TOKEN);
    expect(readyPackageEntry(event("live"), "?ready=stale-token")).toBe(TOKEN);
  });

  it("never opens over a held order or a partner's package", () => {
    expect(readyPackageEntry(event("live"), "?orderId=123")).toBeNull();
    expect(readyPackageEntry(event("live"), "?pkg=abc")).toBeNull();
    expect(readyPackageEntry(event("preview"), `?pkg=abc&ready=${TOKEN}`)).toBeNull();
  });

  it("gives the regular flow on request", () => {
    expect(readyPackageEntry(event("live"), "?build=1")).toBeNull();
    expect(readyPackageEntry(event("preview"), `?ready=${TOKEN}&build=1`)).toBeNull();
  });
});

describe("readyPackageCardPrice", () => {
  const priced = (mode: string | null, price: number | null) => ({
    ...event(mode),
    ready_package_price_usd: price,
  });

  it("is the package price only while the package is live", () => {
    expect(readyPackageCardPrice(priced("live", 1269))).toBe(1269);
    expect(readyPackageCardPrice(priced("live", 1268.2))).toBe(1269);
    expect(readyPackageCardPrice(priced("preview", 1269))).toBeNull();
    expect(readyPackageCardPrice(priced("off", 1269))).toBeNull();
  });

  it("falls back to the regular price without a usable number", () => {
    expect(readyPackageCardPrice(priced("live", null))).toBeNull();
    expect(readyPackageCardPrice(priced("live", 0))).toBeNull();
    expect(readyPackageCardPrice({ ...priced("live", 900), ready_package_token: null })).toBeNull();
  });
});

describe("party sizes", () => {
  const v = { event_order_info: {} };

  it("lists the priced sizes within the max, ascending", () => {
    expect(variantSizes({ "4": v, "1": v, "2": v }, 4)).toEqual([1, 2, 4]);
    expect(variantSizes({ "1": v, "2": v, "5": v }, 4)).toEqual([1, 2]);
    expect(variantSizes({ "2": v, x: v, "3": null }, 4)).toEqual([2]);
    expect(variantSizes({ "2": v, "9": v }, 99)).toEqual([2]);
    expect(variantSizes(null, 4)).toEqual([]);
    expect(variantSizes([v], 4)).toEqual([]);
  });

  it("serves the asked size when priced, else the built one", () => {
    expect(pickPax([1, 2, 4], 4, 2)).toBe(4);
    expect(pickPax([1, 2, 4], 3, 2)).toBe(2);
    expect(pickPax([1, 2, 4], null, 2)).toBe(2);
    expect(pickPax([1, 4], 3, 2)).toBeNull();
    expect(pickPax([], null, 2)).toBeNull();
  });

  it("steps over a size that is not priced", () => {
    expect(neighbourPax([1, 2, 4], 2, 1)).toBe(4);
    expect(neighbourPax([1, 2, 4], 4, -1)).toBe(2);
    expect(neighbourPax([1, 2, 4], 4, 1)).toBeNull();
    expect(neighbourPax([1, 2, 4], 1, -1)).toBeNull();
  });
});
