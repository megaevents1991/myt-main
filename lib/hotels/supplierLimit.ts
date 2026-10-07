/**
 * The hotel supplier's search limit, and how long until it lifts.
 *
 * RateHawk allows 10 `serp/geo` searches a minute for the whole account - one window per
 * clock minute. Past it, it answers HTTP 429 with `error: "endpoint_exceeded_limit"` and
 * says when the window reopens:
 *
 *   debug.utcnow              its own clock, "2026-10-07T12:46:33.142431"
 *   debug.api_endpoint.reset  "2026-10-07T12:47:00"
 *
 * Both are UTC with no zone mark. Until 2026-10-07 `/api/hotels` answered 500 on that: 18
 * of 1,224 customer searches in a day (14 of them in 75 seconds, when eleven people landed
 * from an ad together) - and every one of them was between 1 and 27 seconds away from a
 * window in which it would have been served.
 *
 * No network and no clock of its own: the call, the clock and the sleep are handed in.
 */
export const SUPPLIER_LIMIT_ERROR = "endpoint_exceeded_limit";

/** One window of the supplier's limit. */
export const SUPPLIER_WINDOW_MS = 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A supplier timestamp in ms: UTC, usually with no zone mark, sometimes with microseconds. */
function supplierTime(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const trimmed = value.replace(/(\.\d{3})\d+/, "$1");
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const ms = Date.parse(hasZone ? trimmed : `${trimmed}Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * How long until the supplier serves a search again, in ms - or null when its answer is
 * not about the limit at all (any other failure must fail as it always did).
 *
 * Measured on the supplier's own clock when it sent one (`utcnow`), so a drift between its
 * clock and ours does not shorten the wait. When it did not say when the window reopens,
 * the wait runs to the next clock minute, which is where its windows start.
 */
export function supplierLimitWaitMs(
  status: number,
  body: string,
  nowMs: number,
): number | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Not JSON: only the status can say it is the limit.
  }
  const root = isRecord(parsed) ? parsed : {};
  if (status !== 429 && root.error !== SUPPLIER_LIMIT_ERROR) return null;

  const debug = isRecord(root.debug) ? root.debug : {};
  const endpoint = isRecord(debug.api_endpoint) ? debug.api_endpoint : {};
  const reset = supplierTime(endpoint.reset);
  if (reset === null) return SUPPLIER_WINDOW_MS - (nowMs % SUPPLIER_WINDOW_MS);
  return Math.max(0, reset - (supplierTime(debug.utcnow) ?? nowMs));
}

/** The limit did not lift in time: the search is "busy", not "broken". */
export class SupplierBusyError extends Error {}

/** A window is a minute. A longer wait is not this limit - nothing is held for it. */
export const SUPPLIER_WAIT_MAX_MS = SUPPLIER_WINDOW_MS + 5_000;

type SupplierAnswer = { ok: boolean; status: number; text(): Promise<string> };

export type SupplierLimitOptions = {
  /** Windows the call may wait through. 0 = never wait: busy at the first refusal. */
  waits: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /**
   * Added to every wait: a little past the window's start, and not all at the same
   * instant - every search that waited for a window retries in it.
   */
  pad?: () => number;
  /** Told before each wait, and once when the call gives up. */
  onLimit?: (event: { waited: number; pauseMs: number | null }) => void;
  /** Handed the supplier's answer when it failed for any other reason. */
  onFailure?: (body: string) => void;
};

/**
 * Runs a supplier call, waiting for the next window when the supplier refuses it over the
 * limit. Resolves with the first answer that is ok. Throws `SupplierBusyError` when the
 * limit outlasted the allowed waits, and a plain error on any other failure - at once, with
 * no wait and no second call.
 */
export async function withinSupplierLimit<T extends SupplierAnswer>(
  call: () => Promise<T>,
  {
    waits,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    pad = () => 250 + Math.floor(Math.random() * 750),
    onLimit,
    onFailure,
  }: SupplierLimitOptions,
): Promise<T> {
  for (let waited = 0; ; waited++) {
    const answer = await call();
    if (answer.ok) return answer;

    const body = await answer.text();
    const wait = supplierLimitWaitMs(answer.status, body, now());
    if (wait === null) {
      onFailure?.(body);
      throw new Error("API request failed");
    }
    if (waited >= waits || wait > SUPPLIER_WAIT_MAX_MS) {
      onLimit?.({ waited, pauseMs: null });
      throw new SupplierBusyError("hotel supplier limit");
    }
    const pauseMs = wait + pad();
    onLimit?.({ waited: waited + 1, pauseMs });
    await sleep(pauseMs);
  }
}
