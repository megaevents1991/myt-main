import { describe, expect, it } from "vitest";
import {
  BROWSER_SORTS,
  fitBrowserView,
  intBetween,
  oneOf,
  parseBrowserView,
  parseStoredView,
  viewStateKey,
  type BrowserView,
} from "../viewState";

const ALL = "__all__";

const view = (over: Partial<BrowserView> = {}): BrowserView => ({
  query: "",
  city: ALL,
  months: [],
  dateFrom: "",
  dateTo: "",
  maxPrice: ALL,
  sort: "date",
  hideSoldOut: false,
  tags: [],
  visible: 24,
  advancedOpen: false,
  ...over,
});

const page = {
  all: ALL,
  cities: new Set([ALL, "לונדון", "מדריד"]),
  months: new Set(["2026-10", "2026-11"]),
  tags: new Set(["ליגה אנגלית", "ליגה ספרדית"]),
  priceBounds: { min: 900, max: 3200 },
};

describe("viewStateKey", () => {
  it("is per page and per list", () => {
    expect(viewStateKey("/c/football", "events")).toBe("myt:view:/c/football:events");
    expect(viewStateKey("", "moreEvents")).toBe("myt:view:/:moreEvents");
  });
});

describe("parseStoredView - a stored value is only a hint", () => {
  const sort = oneOf(BROWSER_SORTS);
  const count = intBetween(1, 2000);

  it("reads a value its parser accepts", () => {
    expect(parseStoredView('"price_asc"', sort)).toBe("price_asc");
    expect(parseStoredView("60", count)).toBe(60);
  });

  it("ignores nothing, junk and values outside the list or the range", () => {
    expect(parseStoredView(null, sort)).toBeNull();
    expect(parseStoredView("{broken", sort)).toBeNull();
    expect(parseStoredView('"cheapest"', sort)).toBeNull();
    expect(parseStoredView("0", count)).toBeNull();
    expect(parseStoredView("24.5", count)).toBeNull();
    expect(parseStoredView('"60"', count)).toBeNull();
  });
});

describe("parseBrowserView - all of it or none of it", () => {
  it("round-trips a real view", () => {
    const stored = view({
      query: "ברצלונה",
      city: "מדריד",
      months: ["2026-10"],
      dateFrom: "2026-10-10",
      maxPrice: "2000",
      sort: "price_asc",
      hideSoldOut: true,
      tags: ["ליגה ספרדית"],
      visible: 72,
      advancedOpen: true,
    });
    expect(parseBrowserView(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });

  it("refuses a view with any field of the wrong shape", () => {
    const bad: Record<string, unknown>[] = [
      { sort: "newest" },
      { months: ["October"] },
      { dateFrom: "10/10/2026" },
      { visible: 0 },
      { visible: "72" },
      { hideSoldOut: "yes" },
      { tags: "ליגה אנגלית" },
      { query: "x".repeat(101) },
    ];
    for (const over of bad) {
      expect(parseBrowserView({ ...view(), ...over })).toBeNull();
    }
    expect(parseBrowserView(null)).toBeNull();
    expect(parseBrowserView([view()])).toBeNull();
    const missing: Record<string, unknown> = { ...view() };
    delete missing.city;
    expect(parseBrowserView(missing)).toBeNull();
  });
});

describe("fitBrowserView - against what the page offers today", () => {
  it("keeps what is still on the page", () => {
    const stored = view({ city: "לונדון", months: ["2026-11"], tags: ["ליגה אנגלית"], maxPrice: "2000" });
    expect(fitBrowserView(stored, page)).toEqual(stored);
  });

  it("drops a city, month or tag that left the page - it would only empty the grid", () => {
    const fitted = fitBrowserView(
      view({ city: "מילאנו", months: ["2026-09", "2026-10"], tags: ["ליגה איטלקית", "ליגה אנגלית"] }),
      page,
    );
    expect(fitted.city).toBe(ALL);
    expect(fitted.months).toEqual(["2026-10"]);
    expect(fitted.tags).toEqual(["ליגה אנגלית"]);
  });

  it("a price cap outside the slider goes back to any price", () => {
    expect(fitBrowserView(view({ maxPrice: "5000" }), page).maxPrice).toBe(ALL);
    expect(fitBrowserView(view({ maxPrice: "abc" }), page).maxPrice).toBe(ALL);
    expect(fitBrowserView(view({ maxPrice: "2000" }), { ...page, priceBounds: null }).maxPrice).toBe(ALL);
  });

  it("leaves the rest alone", () => {
    const fitted = fitBrowserView(view({ query: "אואזיס", sort: "price_desc", visible: 96 }), page);
    expect(fitted.query).toBe("אואזיס");
    expect(fitted.sort).toBe("price_desc");
    expect(fitted.visible).toBe(96);
  });
});
