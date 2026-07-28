import { describe, it, expect } from "vitest";
import { resolveLockedFlight } from "../lockedFlight";

describe("resolveLockedFlight", () => {
  it("reports unlocked when the event has no locked flight", () => {
    expect(resolveLockedFlight(null, new Map(), 2)).toEqual({ mode: "unlocked" });
    expect(resolveLockedFlight(undefined, new Map(), 2)).toEqual({ mode: "unlocked" });
  });

  it("reports locked when the allocation covers the party", () => {
    const quota = new Map([[7, 4]]);
    expect(resolveLockedFlight(7, quota, 4)).toEqual({ mode: "locked", flightId: 7 });
  });

  it("reports sold out when the allocation cannot cover the party", () => {
    const quota = new Map([[7, 1]]);
    expect(resolveLockedFlight(7, quota, 2)).toEqual({ mode: "sold_out", flightId: 7 });
  });

  it("reports sold out when the allocation is exhausted", () => {
    const quota = new Map([[7, 0]]);
    expect(resolveLockedFlight(7, quota, 1)).toEqual({ mode: "sold_out", flightId: 7 });
  });

  it("stays locked when the flight has no allocation row at all", () => {
    // No allocation means the global pool applies; the flight-level check in
    // the route still decides, so this must not be pre-emptively sold out.
    expect(resolveLockedFlight(7, new Map(), 9)).toEqual({ mode: "locked", flightId: 7 });
  });
});
