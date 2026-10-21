import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { eventsParamValue, parseEventsParam, reconcileRoute } from "../itinerary/url";

const ev = (id: number, name: string, date: string) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type: "music_event",
    location: { latitude: 48.86, longitude: 2.35, name: "פריז, צרפת", city_iata: "PAR", country_code: "FR" },
  }) as unknown as Event;

const celine = ev(618, "סלין דיון", "2027-05-12");
const chelsea = ev(702, "צ'לסי - אברטון", "2027-05-15");

describe("parseEventsParam", () => {
  it("keeps positive ints in order, drops duplicates and junk, caps at 3", () => {
    expect(parseEventsParam("618,702,618,abc,-1,5,9")).toEqual([618, 702, 5]);
  });

  it("is empty for a missing or empty param", () => {
    expect(parseEventsParam(null)).toEqual([]);
    expect(parseEventsParam("")).toEqual([]);
    expect(parseEventsParam(" , ,")).toEqual([]);
  });

  it("trims spaces around ids", () => {
    expect(parseEventsParam(" 618 , 702 ")).toEqual([618, 702]);
  });

  it("refuses zero, decimals, exponents and unsafe integers", () => {
    expect(parseEventsParam("0,1.5,1e3,0x10,99999999999999999999,7")).toEqual([7]);
  });

  it("takes its cap from the caller", () => {
    expect(parseEventsParam("1,2,3", 2)).toEqual([1, 2]);
    expect(parseEventsParam("1,2,3", 0)).toEqual([]);
  });
});

describe("reconcileRoute", () => {
  it("keeps the ids the catalog has and names the rest as dropped", () => {
    expect(reconcileRoute([618, 999], new Map([[618, celine]]))).toEqual({ route: [celine], dropped: [999] });
  });

  it("keeps the order of the ids", () => {
    const catalog = new Map([
      [618, celine],
      [702, chelsea],
    ]);
    expect(reconcileRoute([702, 618], catalog).route).toEqual([chelsea, celine]);
  });

  it("is empty for no ids", () => {
    expect(reconcileRoute([], new Map())).toEqual({ route: [], dropped: [] });
  });
});

describe("eventsParamValue", () => {
  it("joins the route's ids for ?events=", () => {
    expect(eventsParamValue([celine, chelsea])).toBe("618,702");
  });

  it("is null for an empty route (the param leaves the URL)", () => {
    expect(eventsParamValue([])).toBeNull();
  });
});
