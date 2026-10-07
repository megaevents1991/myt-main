import { describe, expect, it } from "vitest";
import {
  SUPPLIER_WINDOW_MS,
  SupplierBusyError,
  supplierLimitWaitMs,
  withinSupplierLimit,
} from "@/lib/hotels/supplierLimit";

/** The supplier's answer past its limit, as it arrived on 2026-10-07. */
const limited = (over: { utcnow?: string; reset?: string } = {}) =>
  JSON.stringify({
    data: null,
    status: "error",
    error: "endpoint_exceeded_limit",
    debug: {
      ...(over.utcnow === undefined ? {} : { utcnow: over.utcnow }),
      api_endpoint: {
        endpoint: "api/b2b/v3/search/serp/geo",
        is_active: true,
        is_limited: true,
        remaining: -1,
        requests_number: 10,
        seconds_number: 60,
        ...(over.reset === undefined ? {} : { reset: over.reset }),
      },
    },
  });

const at = (iso: string) => Date.parse(iso);

describe("supplierLimitWaitMs", () => {
  it("waits until the supplier's window reopens, by the supplier's own clock", () => {
    const body = limited({ utcnow: "2026-10-07T12:46:33.142431", reset: "2026-10-07T12:47:00" });
    // Our clock is 5 seconds ahead of the supplier's: its clock is the one that counts.
    expect(supplierLimitWaitMs(429, body, at("2026-10-07T12:46:38.000Z"))).toBe(26_858);
  });

  it("falls back on our clock when the supplier sent none", () => {
    const body = limited({ reset: "2026-10-07T12:48:00" });
    expect(supplierLimitWaitMs(429, body, at("2026-10-07T12:47:55.990Z"))).toBe(4_010);
  });

  it("reads a time that does carry a zone mark", () => {
    const body = limited({ utcnow: "2026-10-07T12:47:50Z", reset: "2026-10-07T12:48:00+00:00" });
    expect(supplierLimitWaitMs(429, body, 0)).toBe(10_000);
  });

  it("does not wait for a window that has already reopened", () => {
    const body = limited({ utcnow: "2026-10-07T12:48:02", reset: "2026-10-07T12:48:00" });
    expect(supplierLimitWaitMs(429, body, 0)).toBe(0);
  });

  it("runs to the next clock minute when the supplier did not say when", () => {
    const now = at("2026-10-07T12:47:45.500Z");
    expect(supplierLimitWaitMs(429, limited(), now)).toBe(14_500);
    expect(supplierLimitWaitMs(429, "Too Many Requests", now)).toBe(14_500);
    expect(supplierLimitWaitMs(429, limited({ reset: "soon" }), now)).toBe(14_500);
    expect(supplierLimitWaitMs(429, "", at("2026-10-07T12:47:00.000Z"))).toBe(SUPPLIER_WINDOW_MS);
  });

  it("knows the limit by its error name, whatever the status", () => {
    const body = limited({ utcnow: "2026-10-07T12:47:50", reset: "2026-10-07T12:48:00" });
    expect(supplierLimitWaitMs(400, body, 0)).toBe(10_000);
  });

  it("is silent about every other failure - it must fail as it always did", () => {
    expect(supplierLimitWaitMs(500, "Internal Server Error", 0)).toBeNull();
    expect(supplierLimitWaitMs(400, JSON.stringify({ status: "error", error: "invalid_params" }), 0)).toBeNull();
    expect(supplierLimitWaitMs(401, JSON.stringify({ error: "incorrect_credentials", debug: null }), 0)).toBeNull();
    expect(supplierLimitWaitMs(502, "[]", 0)).toBeNull();
  });

  it("every failure of the 2026-10-07 burst was seconds from being served", () => {
    // request time -> the reset the supplier named, from the day's logs
    const burst: [string, string][] = [
      ["2026-10-07T12:46:33.142", "2026-10-07T12:47:00"],
      ["2026-10-07T12:46:59.247", "2026-10-07T12:47:00"],
      ["2026-10-07T12:47:43.722", "2026-10-07T12:48:00"],
      ["2026-10-07T12:47:55.990", "2026-10-07T12:48:00"],
    ];
    const waits = burst.map(([utcnow, reset]) => supplierLimitWaitMs(429, limited({ utcnow, reset }), 0));
    expect(waits).toEqual([26_858, 753, 16_278, 4_010]);
    for (const wait of waits) expect(wait).toBeLessThan(SUPPLIER_WINDOW_MS);
  });
});

describe("withinSupplierLimit", () => {
  type Answer = { ok: boolean; status: number; text(): Promise<string>; label?: string };
  const served = (label: string): Answer => ({ ok: true, status: 200, text: async () => "", label });
  /** Refused over the limit, `seconds` before the supplier's window reopens. */
  const refused = (seconds: number): Answer => ({
    ok: false,
    status: 429,
    text: async () =>
      limited({
        utcnow: new Date(Date.UTC(2026, 9, 7, 12, 47, 60 - seconds)).toISOString().slice(0, 19),
        reset: "2026-10-07T12:48:00",
      }),
  });
  const broken: Answer = { ok: false, status: 500, text: async () => "Internal Server Error" };

  /** Runs a call that gives `answers` in turn, recording the calls, the sleeps and the notices. */
  const run = (answers: Answer[], waits: number) => {
    const seen = { calls: 0, slept: [] as number[], limits: [] as unknown[], failures: [] as string[] };
    const result = withinSupplierLimit(
      async () => answers[Math.min(seen.calls++, answers.length - 1)],
      {
        waits,
        sleep: async (ms) => void seen.slept.push(ms),
        now: () => 0,
        pad: () => 500,
        onLimit: (event) => seen.limits.push(event),
        onFailure: (body) => seen.failures.push(body),
      },
    );
    return { result, seen };
  };

  it("a search the supplier serves is one call and no wait", async () => {
    const { result, seen } = run([served("first")], 2);
    expect((await result).label).toBe("first");
    expect(seen).toMatchObject({ calls: 1, slept: [], limits: [] });
  });

  it("a refused search waits for the window and is served in it", async () => {
    const { result, seen } = run([refused(12), served("after the wait")], 2);
    expect((await result).label).toBe("after the wait");
    expect(seen.calls).toBe(2);
    expect(seen.slept).toEqual([12_500]); // 12 s to the window + the pad
    expect(seen.limits).toEqual([{ waited: 1, pauseMs: 12_500 }]);
  });

  it("the next window can be full too - it waits once more", async () => {
    const { result, seen } = run([refused(4), refused(60), served("third try")], 2);
    expect((await result).label).toBe("third try");
    expect(seen.calls).toBe(3);
    expect(seen.slept).toEqual([4_500, 60_500]);
  });

  it("gives up as BUSY, not broken, when the limit outlasts the waits", async () => {
    const { result, seen } = run([refused(10)], 2);
    await expect(result).rejects.toBeInstanceOf(SupplierBusyError);
    expect(seen.calls).toBe(3);
    expect(seen.slept).toHaveLength(2);
    expect(seen.limits.at(-1)).toEqual({ waited: 2, pauseMs: null });
    expect(seen.failures).toEqual([]);
  });

  it("with no waits allowed a refusal is busy at once", async () => {
    const { result, seen } = run([refused(10), served("never reached")], 0);
    await expect(result).rejects.toBeInstanceOf(SupplierBusyError);
    expect(seen).toMatchObject({ calls: 1, slept: [] });
  });

  it("does not hold a request for a window further than a minute away", async () => {
    const far: Answer = {
      ok: false,
      status: 429,
      text: async () => limited({ utcnow: "2026-10-07T12:00:00", reset: "2026-10-07T12:10:00" }),
    };
    const { result, seen } = run([far, served("never reached")], 2);
    await expect(result).rejects.toBeInstanceOf(SupplierBusyError);
    expect(seen).toMatchObject({ calls: 1, slept: [] });
  });

  it("any other failure fails at once, as before - no wait, no second call", async () => {
    const { result, seen } = run([broken, served("never reached")], 2);
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SupplierBusyError);
    expect(seen).toMatchObject({ calls: 1, slept: [], failures: ["Internal Server Error"] });
  });

  it("a failure after a wait is still a failure, not busy", async () => {
    const { result, seen } = run([refused(5), broken], 2);
    const error = await result.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(SupplierBusyError);
    expect(seen.calls).toBe(2);
    expect(seen.slept).toEqual([5_500]);
  });
});
