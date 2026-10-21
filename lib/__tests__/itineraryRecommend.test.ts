import { describe, expect, it } from "vitest";
import type { Event } from "../app.types";
import { dayDiff, eventDay, eventKind, eventPoint, haversineKm, sameCity } from "../itinerary/geo";
import { isItineraryEligible } from "../itinerary/eligibility";
import { compatibility, sortRoute } from "../itinerary/rules";
import { recommendRoutes, type RecommendedRoute } from "../itinerary/recommend";
import { DEFAULT_ITINERARY_SETTINGS as S, type ItinerarySettings } from "../itinerary/settings";

type City = { latitude: number; longitude: number; name: string; city_iata: string };

const PARIS: City = { latitude: 48.86, longitude: 2.35, name: "פריז", city_iata: "PAR" };
const LONDON: City = { latitude: 51.5, longitude: -0.13, name: "לונדון", city_iata: "LON" };
const AMSTERDAM: City = { latitude: 52.37, longitude: 4.9, name: "אמסטרדם", city_iata: "AMS" };
const MADRID: City = { latitude: 40.42, longitude: -3.7, name: "מדריד", city_iata: "MAD" };
const MILAN: City = { latitude: 45.46, longitude: 9.19, name: "מילאנו", city_iata: "MIL" };
const BERLIN: City = { latitude: 52.52, longitude: 13.4, name: "ברלין", city_iata: "BER" };
const KRAKOW: City = { latitude: 50.06, longitude: 19.94, name: "קרקוב", city_iata: "KRK" };

const TODAY = "2027-01-01";

/** One available ticket: without it the event reads as sold out and is not eligible. */
const TICKET = {
  id: "t1",
  category: "A",
  price: 100,
  available: true,
  description: "",
  colorOnTheMap: "",
};

/** A partial but ELIGIBLE event: only what the rules and the eligibility read. */
const ev = (
  id: number,
  name: string,
  date: string,
  city: City,
  type = "music_event",
  over: Record<string, unknown> = {},
) =>
  ({
    id,
    name,
    date: `${date}T20:00:00`,
    type,
    location: { ...city, country_code: "XX" },
    tickets_and_rates: [TICKET],
    ...over,
  }) as unknown as Event;

const celine = ev(1, "סלין דיון", "2027-05-12", PARIS);
const chelsea = ev(2, "צ'לסי - אברטון", "2027-05-15", LONDON, "sports_event");
const gracie = ev(3, "גרייסי אברמס", "2027-05-10", AMSTERDAM);
const realBarca = ev(4, "ריאל - ברסה", "2027-05-09", MADRID, "sports_event");
const arsenal = ev(5, "ארסנל - ליברפול", "2027-05-15", LONDON, "sports_event");
const interLazio = ev(6, "אינטר - לאציו", "2027-05-23", MILAN, "sports_event");
const berlin = ev(7, "קונצרט בברלין", "2027-05-13", BERLIN);
// The same artist on a second night in Paris (trailing space: names are compared trimmed). Next to
// Gracie (1 day, 430 km) and Céline (same city) it would be the best pairing there is - but never twice.
const gracieParis = ev(8, "גרייסי אברמס ", "2027-05-11", PARIS);

const MAIN = [celine, chelsea, gracie, realBarca, arsenal, interLazio, berlin];

const idsOf = (routes: RecommendedRoute[]) => routes.map((r) => r.ids);
const byId = (events: Event[]) => new Map(events.map((e) => [e.id, e]));

/** The brief's score, written out independently of the implementation. */
function expectedScore(events: Event[], ids: number[]): number {
  const route = sortRoute(ids.map((id) => byId(events).get(id) as Event));
  let gaps = 0;
  let km = 0;
  for (let i = 1; i < route.length; i++) {
    gaps += dayDiff(eventDay(route[i - 1]), eventDay(route[i]));
    km += haversineKm(eventPoint(route[i - 1]), eventPoint(route[i]));
  }
  const kinds = new Set(route.map(eventKind));
  return gaps + km / 200 - (kinds.size === 2 ? 2 : 0) - (route.length === 3 ? 1 : 0);
}

/** How many routes of one size each event is in. */
function countsBySize(routes: RecommendedRoute[], size: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of routes.filter((x) => x.ids.length === size)) {
    for (const id of r.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

const FIT = ["best", "same", "ok"];

/** A route that never leaves a city: every consecutive link is the same city (stay points within 30 km). */
const isSingleCity = (route: Event[]): boolean => route.every((e, i) => i === 0 || sameCity(route[i - 1], e));

/**
 * Every route the brief allows, before any cap: a pair is two events with `compatibility([a], b)`
 * best / same / ok; a triple is ANY pair of the three plus the remaining one, best / same / ok
 * against that pair - tried in every combination, not only the way the implementation builds it.
 * Names differ inside a route. Keyed by the ids in trip order.
 */
function validRoutes(events: Event[], s: ItinerarySettings, todayIso: string): Map<string, Event[]> {
  const pool = events.filter((e) => isItineraryEligible(e, todayIso));
  const distinct = (...es: Event[]) => new Set(es.map((e) => e.name.trim())).size === es.length;
  const found = new Map<string, Event[]>();
  const keep = (route: Event[]) => {
    const sorted = sortRoute(route);
    found.set(sorted.map((e) => e.id).join(","), sorted);
  };
  for (const x of pool) {
    for (const y of pool) {
      if (x === y || !distinct(x, y) || !FIT.includes(compatibility([x], y, s).status)) continue;
      keep([x, y]);
      for (const z of pool) {
        if (z === x || z === y || !distinct(x, y, z)) continue;
        if (FIT.includes(compatibility([x, y], z, s).status)) keep([x, y, z]);
      }
    }
  }
  return found;
}

/**
 * The suggested list written out from scratch: all valid routes, the ones that move between cities
 * before the single-city ones, best first inside each tier, then the cap per size and the limit.
 */
function referenceRoutes(
  events: Event[],
  s: ItinerarySettings,
  todayIso: string,
  limit: number,
): RecommendedRoute[] {
  const ranked = [...validRoutes(events, s, todayIso).entries()]
    .map(([key, route]) => ({
      key,
      route,
      single: isSingleCity(route),
      score: expectedScore(events, route.map((e) => e.id)),
    }))
    .sort(
      (a, b) =>
        Number(a.single) - Number(b.single) ||
        a.score - b.score ||
        (eventDay(a.route[0]) < eventDay(b.route[0]) ? -1 : eventDay(a.route[0]) > eventDay(b.route[0]) ? 1 : 0) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
  const taken = new Map<string, number>();
  const out: RecommendedRoute[] = [];
  for (const r of ranked) {
    const slots = r.route.map((e) => `${r.route.length}:${e.id}`);
    if (out.length >= limit || slots.some((slot) => (taken.get(slot) ?? 0) >= 2)) continue;
    for (const slot of slots) taken.set(slot, (taken.get(slot) ?? 0) + 1);
    out.push({ ids: r.route.map((e) => e.id), score: r.score });
  }
  return out;
}

describe("recommendRoutes", () => {
  const all = recommendRoutes(MAIN, S, TODAY, 48);

  it("builds the Gracie -> Céline -> Chelsea triple, in trip order", () => {
    expect(idsOf(all)).toContainEqual([3, 1, 2]);
  });

  it("puts Madrid in no route: nothing else in the list is within 1000 km of it", () => {
    expect(all.filter((r) => r.ids.includes(4))).toEqual([]);
  });

  it("never puts two events with the same name in one route, names compared trimmed", () => {
    const named = [...MAIN, gracieParis];
    const routes = recommendRoutes(named, S, TODAY, 48);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      const names = r.ids.map((id) => (byId(named).get(id) as Event).name.trim());
      expect(new Set(names).size).toBe(names.length);
    }
    // The rule is what refuses it: next to Gracie, her second night (1 day, 430 km) is a perfect pair.
    expect(compatibility([gracie], gracieParis, S).status).toBe("best");
    expect(
      routes.filter((r) => r.ids.includes(3) && r.ids.includes(8)),
      "Gracie + her own second night",
    ).toEqual([]);
    // ...while the second night still travels with the others.
    expect(routes.some((r) => r.ids.includes(8))).toBe(true);
  });

  it("puts an event in at most 2 pairs and at most 2 triples (counted apart)", () => {
    const pairs = countsBySize(all, 2);
    const triples = countsBySize(all, 3);
    expect(Math.max(...pairs.values())).toBe(2); // the cap is what stopped it, not a short list
    expect(Math.max(...triples.values())).toBeLessThanOrEqual(2);
    expect(triples.size).toBeGreaterThan(0);
  });

  it("stops at 2 triples for an event that has more valid ones", () => {
    // Céline (id 1) sits in many valid triples: with Gracie, Berlin, Chelsea, Arsenal around her.
    const valid = [...validRoutes(MAIN, S, TODAY).values()].filter((r) => r.length === 3 && r.some((e) => e.id === 1));
    expect(valid.length).toBeGreaterThanOrEqual(3);
    const taken = all.filter((r) => r.ids.length === 3 && r.ids.includes(1));
    expect(taken).toHaveLength(2);
    // ...and they are the two best of those, not just any two.
    const best = valid
      .map((r) => expectedScore(MAIN, r.map((e) => e.id)))
      .sort((a, b) => a - b)
      .slice(0, 2);
    expect(taken.map((r) => r.score)).toEqual(best);
  });

  it("returns only addable pairs and triples (best / same / ok), never a warn gap", () => {
    for (const r of all) {
      const route = sortRoute(r.ids.map((id) => byId(MAIN).get(id) as Event));
      expect([2, 3]).toContain(route.length);
      expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 1), route[1], S).status);
      if (route.length === 3) {
        expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 2), route[2], S).status);
      }
    }
  });

  it("does not suggest a long gap (warn) - unless the settings make it an ok one", () => {
    // Chelsea -> Inter is 8 days and 960 km: a "warn" with the default 5 ok days.
    expect(compatibility([chelsea], interLazio, S).status).toBe("warn");
    expect(recommendRoutes([chelsea, interLazio], S, TODAY)).toEqual([]);
    expect(idsOf(recommendRoutes([chelsea, interLazio], { ...S, okGapDays: 10 }, TODAY))).toEqual([[2, 6]]);
  });

  it("does not suggest a pair that is too far apart or too many days apart", () => {
    expect(recommendRoutes([celine, realBarca], S, TODAY)).toEqual([]); // Paris - Madrid, 1054 km
    expect(recommendRoutes([celine, interLazio], S, TODAY)).toEqual([]); // 11 days
    expect(recommendRoutes([chelsea, arsenal], S, TODAY)).toEqual([]); // the same day
  });

  it("scores a route as day gaps + km / 200 - 2 (both kinds) - 1 (three events)", () => {
    for (const r of all) expect(r.score).toBeCloseTo(expectedScore(MAIN, r.ids), 2);
  });

  it("lists the best (lowest score) first inside each tier", () => {
    const tierOf = (r: RecommendedRoute) => Number(isSingleCity(r.ids.map((id) => byId(MAIN).get(id) as Event)));
    for (let i = 1; i < all.length; i++) {
      expect([tierOf(all[i - 1]), all[i - 1].score]).toSatisfy(
        ([tier, score]: number[]) => tierOf(all[i]) > tier || (tierOf(all[i]) === tier && all[i].score >= score),
      );
    }
  });

  it("with only Gracie, Céline and Chelsea, returns their three pairs and the triple", () => {
    const three = [gracie, celine, chelsea];
    const routes = recommendRoutes(three, S, TODAY);
    // A pair's events each sit in 2 pairs, and in the 1 triple: the cap counts them apart.
    expect(idsOf(routes)).toEqual(expect.arrayContaining([[3, 1], [1, 2], [3, 2], [3, 1, 2]]));
    expect(routes).toHaveLength(4);
    const triple = routes.find((r) => r.ids.length === 3) as RecommendedRoute;
    // Amsterdam -> Paris -> London, 2 + 3 days, both kinds present, three events.
    const km = haversineKm(eventPoint(gracie), eventPoint(celine)) + haversineKm(eventPoint(celine), eventPoint(chelsea));
    expect(triple.score).toBeCloseTo(5 + km / 200 - 2 - 1, 2);
  });

  it("keeps a triple reachable from two different pairs once", () => {
    const routes = recommendRoutes([gracie, celine, chelsea], S, TODAY);
    expect(routes.filter((r) => r.ids.length === 3)).toHaveLength(1);
  });

  it("returns at most `limit` routes, defaulting to maxAutoRoutes", () => {
    expect(recommendRoutes(MAIN, S, TODAY, 3)).toHaveLength(3);
    expect(recommendRoutes(MAIN, S, TODAY, 3)).toEqual(all.slice(0, 3));
    expect(recommendRoutes(MAIN, { ...S, maxAutoRoutes: 2 }, TODAY)).toHaveLength(2);
    expect(recommendRoutes(MAIN, S, TODAY, 0)).toEqual([]);
    expect(recommendRoutes(MAIN, S, TODAY).length).toBeLessThanOrEqual(S.maxAutoRoutes);
  });

  it("is deterministic: the same input gives the same list, whatever order it arrives in", () => {
    expect(recommendRoutes(MAIN, S, TODAY, 48)).toEqual(all);
    expect(recommendRoutes([...MAIN].reverse(), S, TODAY, 48)).toEqual(all);
    expect(recommendRoutes([...MAIN].sort((a, b) => a.name.localeCompare(b.name)), S, TODAY, 48)).toEqual(all);
  });

  it("breaks a tie on score and first day by the ids, compared as text", () => {
    // Two London matches on one day: Céline pairs with each at exactly the same score.
    const nine = ev(9, "משחק א בלונדון", "2027-05-15", LONDON, "sports_event");
    const ten = ev(10, "משחק ב בלונדון", "2027-05-15", LONDON, "sports_event");
    const routes = recommendRoutes([celine, nine, ten], S, TODAY);
    expect(routes.map((r) => r.score)[0]).toBe(routes[1].score);
    expect(idsOf(routes)).toEqual([
      [1, 10],
      [1, 9],
    ]);
  });

  it("leaves out events that are not eligible", () => {
    const soldOut = ev(20, "סולד אאוט בפריז", "2027-05-11", PARIS, "music_event", {
      tickets_and_rates: [{ ...TICKET, available: false }],
    });
    const ticketOnly = ev(21, "כרטיס בלבד בפריז", "2027-05-11", PARIS, "music_event", { package_mode: "ticket_only" });
    const us = ev(22, "קונצרט בניו יורק", "2027-05-11", PARIS, "music_event", {
      location: { ...PARIS, country_code: "US" },
    });
    const routes = recommendRoutes([...MAIN, soldOut, ticketOnly, us], S, TODAY, 48);
    expect(routes).toEqual(all);
    for (const id of [20, 21, 22]) expect(routes.some((r) => r.ids.includes(id))).toBe(false);
  });

  it("leaves out events closer than the 3-day sell window to `todayIso`", () => {
    // Today 2027-05-09: Madrid (05-09) and Gracie (05-10) are too soon; Céline (05-12) is exactly 3 days off.
    const routes = recommendRoutes(MAIN, S, "2027-05-09", 48);
    for (const id of [3, 4]) expect(routes.some((r) => r.ids.includes(id))).toBe(false);
    expect(idsOf(routes)).toContainEqual([1, 2]);
  });

  it("builds no triples when the trip holds two events", () => {
    const routes = recommendRoutes(MAIN, { ...S, maxEvents: 2 }, TODAY, 48);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.ids.length === 2)).toBe(true);
  });

  it("returns nothing for fewer than two eligible events", () => {
    expect(recommendRoutes([], S, TODAY)).toEqual([]);
    expect(recommendRoutes([celine], S, TODAY)).toEqual([]);
  });

  it("does not modify its input", () => {
    const input = [...MAIN].reverse();
    const before = input.map((e) => e.id);
    recommendRoutes(input, S, TODAY, 48);
    expect(input.map((e) => e.id)).toEqual(before);
  });
});

describe("recommendRoutes on a larger catalog", () => {
  // A deterministic spread: 60 events over the cities, two months, a few repeated names.
  const CITIES = [PARIS, LONDON, AMSTERDAM, MADRID, MILAN, BERLIN, KRAKOW];
  const events: Event[] = Array.from({ length: 60 }, (_, i) => {
    const day = 1 + ((i * 3) % 50); // 1..50 -> May 1 .. Jun 19, three days apart in a run
    const date = new Date(Date.UTC(2027, 4, day)).toISOString().slice(0, 10);
    return ev(
      100 + i,
      `אירוע ${i % 45}`, // ids 145.. repeat the names of 100..
      date,
      CITIES[(i * 3) % CITIES.length],
      i % 2 ? "sports_event" : "music_event",
    );
  });
  const routes = recommendRoutes(events, S, TODAY, 48);

  it("keeps every promise at once", () => {
    expect(routes.length).toBeGreaterThan(12);
    expect(routes.length).toBeLessThanOrEqual(48);

    for (const size of [2, 3]) {
      for (const n of countsBySize(routes, size).values()) expect(n).toBeLessThanOrEqual(2);
    }

    const sets = routes.map((r) => [...r.ids].sort((a, b) => a - b).join(","));
    expect(new Set(sets).size).toBe(sets.length);

    const lookup = byId(events);
    for (const r of routes) {
      const route = sortRoute(r.ids.map((id) => lookup.get(id) as Event));
      expect(r.ids).toEqual(route.map((e) => e.id));
      const names = route.map((e) => e.name.trim());
      expect(new Set(names).size).toBe(names.length);
      expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 1), route[1], S).status);
      if (route.length === 3) {
        expect(["best", "same", "ok"]).toContain(compatibility(route.slice(0, 2), route[2], S).status);
      }
      expect(r.score).toBeCloseTo(expectedScore(events, r.ids), 2);
    }
  });

  it("is deterministic", () => {
    expect(recommendRoutes([...events].reverse(), S, TODAY, 48)).toEqual(routes);
  });
});

describe("recommendRoutes ranks trips between cities before single-city ones", () => {
  // Two nights in Paris, then a match in London three days after the first.
  const paris1 = ev(41, "קונצרט בפריז א", "2027-05-12", PARIS);
  const paris2 = ev(42, "קונצרט בפריז ב", "2027-05-13", PARIS);
  const london = ev(43, "משחק בלונדון", "2027-05-15", LONDON, "sports_event");

  it("puts Paris -> London before a Paris + Paris pair that scores lower", () => {
    const routes = recommendRoutes([paris1, paris2, london], S, TODAY);
    const sameCityPair = routes.find((r) => r.ids.join() === "41,42") as RecommendedRoute;
    const parisLondon = routes.find((r) => r.ids.join() === "41,43") as RecommendedRoute;
    expect(sameCityPair.score).toBeLessThan(parisLondon.score); // 1 against 2.715: the premise
    expect(routes.indexOf(parisLondon)).toBeLessThan(routes.indexOf(sameCityPair));
    // The whole order: the multi-city routes by score (a tie goes to the earlier first day), then Paris + Paris.
    expect(idsOf(routes)).toEqual([
      [41, 42, 43],
      [42, 43],
      [41, 43],
      [41, 42],
    ]);
    // The score itself is untouched by the tiers.
    for (const r of routes) expect(r.score).toBeCloseTo(expectedScore([paris1, paris2, london], r.ids), 2);
  });

  it("still lists single-city routes when there are no others", () => {
    const london1 = ev(51, "משחק בלונדון א", "2027-05-10", LONDON, "sports_event");
    const london2 = ev(52, "משחק בלונדון ב", "2027-05-12", LONDON, "sports_event");
    const london3 = ev(53, "משחק בלונדון ג", "2027-05-14", LONDON, "sports_event");
    const routes = recommendRoutes([london1, london2, london3], S, TODAY);
    expect(idsOf(routes)).toEqual(
      expect.arrayContaining([[51, 52], [52, 53], [51, 53], [51, 52, 53]]),
    );
    expect(routes).toHaveLength(4);
  });

  it("lets a single-city route take only the slots the others leave", () => {
    // A second night in Paris next to Céline (same city, 1 day): the best score there is...
    const named = [...MAIN, gracieParis];
    expect(compatibility([gracieParis], celine, S).status).toBe("same");
    const routes = recommendRoutes(named, S, TODAY, 48);
    // ...but Céline's two pair slots go to Chelsea and Arsenal (Paris -> London), so Paris + Paris is out.
    expect(idsOf(routes)).not.toContainEqual([8, 1]);
    expect(idsOf(routes)).toContainEqual([1, 2]);
    expect(idsOf(routes)).toContainEqual([1, 5]);
    expect(routes).toEqual(referenceRoutes(named, S, TODAY, 48));
    // With a slot to spare, it is listed - after the multi-city routes.
    const small = recommendRoutes([gracieParis, celine, chelsea], S, TODAY);
    expect(idsOf(small)).toEqual([[8, 1, 2], [1, 2], [8, 2], [8, 1]]);
  });
});

describe("recommendRoutes against a from-scratch reference", () => {
  const LOOSE_OK_GAP = { ...S, okGapDays: 12, maxGapDays: 8 }; // an "ok" gap longer than the blocked one
  const SETTINGS: [string, ItinerarySettings][] = [
    ["default", S],
    ["tight", { ...S, maxGapDays: 6, okGapDays: 3, maxKm: 800, bestKm: 400, maxSpanDays: 9 }],
    ["okGapDays above maxGapDays", LOOSE_OK_GAP],
    ["two events", { ...S, maxEvents: 2 }],
    ["a trip shorter than two legs", { ...S, maxSpanDays: 5 }],
  ];

  it("a triple whose outer two events are not a clean pair is still suggested", () => {
    // Amsterdam 05-10 -> Paris 05-15 -> London 05-20: 5 days a leg (ok), but 10 days end to end.
    const x = ev(31, "קונצרט באמסטרדם", "2027-05-10", AMSTERDAM);
    const y = ev(32, "משחק בפריז", "2027-05-15", PARIS, "sports_event");
    const z = ev(33, "קונצרט בלונדון", "2027-05-20", LONDON);
    expect(compatibility([x], z, S).status).toBe("warn");

    const routes = recommendRoutes([x, y, z], S, TODAY);
    expect(idsOf(routes)).toContainEqual([31, 32, 33]);
    expect(idsOf(routes)).not.toContainEqual([31, 33]); // the long way round is not a pair
    expect(idsOf(routes)).toHaveLength(3); // the two legs and the whole trip
    expect(routes).toEqual(referenceRoutes([x, y, z], S, TODAY, 48));
  });

  it("A3's fixtures give the reference's list, whatever the settings and the limit", () => {
    for (const events of [MAIN, [...MAIN, gracieParis]]) {
      for (const [name, s] of SETTINGS) {
        const want = referenceRoutes(events, s, TODAY, 1000);
        expect(recommendRoutes(events, s, TODAY, 1000), name).toEqual(want);
        expect(recommendRoutes(events, s, TODAY, 3), name).toEqual(want.slice(0, 3));
      }
    }
  });

  it("small dense calendars give the reference's list", () => {
    const CITIES = [PARIS, LONDON, AMSTERDAM, MADRID, MILAN, BERLIN, KRAKOW];
    for (let seed = 1; seed <= 4; seed++) {
      // 12 events in 9 days, a few repeated names, both kinds: nearly every combination is in play.
      let state = seed * 7919;
      const next = () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const events = Array.from({ length: 12 }, (_, i) =>
        ev(
          200 + i,
          `אירוע ${i % 10}`,
          `2027-05-${String(1 + Math.floor(next() * 9)).padStart(2, "0")}`,
          CITIES[Math.floor(next() * CITIES.length)],
          next() < 0.5 ? "sports_event" : "music_event",
        ),
      );
      for (const [name, s] of SETTINGS) {
        const want = referenceRoutes(events, s, TODAY, 1000);
        expect(want.length, `seed ${seed} ${name}`).toBeGreaterThan(0);
        expect(recommendRoutes(events, s, TODAY, 1000), `seed ${seed} ${name}`).toEqual(want);
      }
    }
  });
});
