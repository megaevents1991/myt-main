import { describe, expect, it } from "vitest";
import {
  COST_KEYS,
  SETTLEMENT_KEYS,
  insertReservation,
  type InsertResult,
} from "@/lib/reservation-insert";

// The money path of confirm-order: the reservation insert and its retries when a
// migration has not landed yet. A fake table decides which column groups "exist";
// every attempt's keys are recorded.

const COST = { ticket_cost_usd: 203, ticket_cost_source: "live" } as const;
const payload = {
  main_contact_email: "a@b.co",
  user_shown_price: 1500,
  partner_settlement_method: "agent_card",
  agent_card_discount_ils: 100,
  source_share_token: "tok",
  quote_id: 5,
  ...COST,
};

const BASE_KEYS = ["main_contact_email", "user_shown_price"];
const SETTLEMENT = [...SETTLEMENT_KEYS].sort();
const COSTS = [...COST_KEYS].sort();
const ALL = [...BASE_KEYS, ...SETTLEMENT, ...COSTS].sort();
const withoutCost = [...BASE_KEYS, ...SETTLEMENT].sort();
const bare = [...BASE_KEYS].sort();

const fakeTable = (columns: { cost: boolean; settlement: boolean }, reports: "cost-first" | "settlement-first" = "cost-first") => {
  const attempts: Record<string, unknown>[] = [];
  const insertFn = async (row: Record<string, unknown>): Promise<InsertResult> => {
    attempts.push(row);
    const hasCost = COST_KEYS.some((k) => k in row);
    const hasSettlement = SETTLEMENT_KEYS.some((k) => k in row);
    const costError = { code: "PGRST204", message: "Could not find the 'ticket_cost_source' column of 'reservations' in the schema cache" };
    const settlementError = { code: "42703", message: 'column "agent_card_discount_ils" of relation "reservations" does not exist' };
    const errors = [
      !columns.cost && hasCost ? costError : null,
      !columns.settlement && hasSettlement ? settlementError : null,
    ];
    const error = (reports === "cost-first" ? errors : [...errors].reverse()).find(Boolean) ?? null;
    return error ? { data: null, error } : { data: { id: 7 }, error: null };
  };
  return { attempts, insertFn };
};

const keysOf = (row: Record<string, unknown>) => Object.keys(row).sort();

describe("insertReservation", () => {
  it("both column groups present: one insert, everything in it", async () => {
    const db = fakeTable({ cost: true, settlement: true });
    const res = await insertReservation(payload, COST, db.insertFn);
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ id: 7 });
    expect(db.attempts.map(keysOf)).toEqual([ALL]);
    expect(db.attempts[0].agent_card_discount_ils).toBe(100);
  });

  it("cost columns missing (PGRST204): retried without ONLY the cost keys - the agent discount survives", async () => {
    const db = fakeTable({ cost: false, settlement: true });
    const res = await insertReservation(payload, COST, db.insertFn);
    expect(res.error).toBeNull();
    expect(db.attempts.map(keysOf)).toEqual([ALL, withoutCost]);
    expect(db.attempts[1].agent_card_discount_ils).toBe(100);
    expect(db.attempts[1].partner_settlement_method).toBe("agent_card");
  });

  it("cost columns missing (42703 flavour of the same error): same single cost-only retry", async () => {
    const attempts: Record<string, unknown>[] = [];
    const res = await insertReservation(payload, COST, async (row) => {
      attempts.push(row);
      return COST_KEYS.some((k) => k in row)
        ? { data: null, error: { code: "42703" } }
        : { data: { id: 1 }, error: null };
    });
    expect(res.error).toBeNull();
    expect(attempts.map(keysOf)).toEqual([ALL, withoutCost]);
  });

  it("settlement columns missing (42703): the existing ladder strips the four settlement keys (and the cost keys)", async () => {
    const db = fakeTable({ cost: true, settlement: false });
    const res = await insertReservation(payload, COST, db.insertFn);
    expect(res.error).toBeNull();
    // full -> cost-only strip (settlement still named, fails the same way) -> all six gone
    expect(db.attempts.map(keysOf)).toEqual([ALL, withoutCost, bare]);
  });

  it("settlement columns missing and no cost found: the old single retry", async () => {
    const db = fakeTable({ cost: true, settlement: false });
    const { ticket_cost_usd: _a, ticket_cost_source: _b, ...noCostPayload } = payload;
    const res = await insertReservation(noCostPayload, null, db.insertFn);
    expect(res.error).toBeNull();
    expect(db.attempts.map(keysOf)).toEqual([withoutCost, bare]);
  });

  it("both missing: ends with the bare order, nothing lost but the optional columns", async () => {
    for (const reports of ["cost-first", "settlement-first"] as const) {
      const db = fakeTable({ cost: false, settlement: false }, reports);
      const res = await insertReservation(payload, COST, db.insertFn);
      expect(res.error).toBeNull();
      expect(keysOf(db.attempts[db.attempts.length - 1])).toEqual(bare);
      expect(db.attempts.length).toBeLessThanOrEqual(3);
    }
  });

  it("agent_card_discount_ils is stripped only when ITS column is missing", async () => {
    const present = fakeTable({ cost: false, settlement: true });
    await insertReservation(payload, COST, present.insertFn);
    expect(present.attempts.at(-1)?.agent_card_discount_ils).toBe(100);

    const missing = fakeTable({ cost: true, settlement: false });
    await insertReservation(payload, COST, missing.insertFn);
    expect(missing.attempts.at(-1)).not.toHaveProperty("agent_card_discount_ils");
  });

  it("no cost attached: a PGRST204 is not the cost step's business (one attempt, error returned)", async () => {
    const attempts: Record<string, unknown>[] = [];
    const res = await insertReservation(payload, null, async (row) => {
      attempts.push(row);
      return { data: null, error: { code: "PGRST204" } };
    });
    expect(attempts).toHaveLength(1);
    expect(res.error).toEqual({ code: "PGRST204" });
  });

  it("any other error is returned untouched, never retried", async () => {
    const attempts: Record<string, unknown>[] = [];
    const res = await insertReservation(payload, COST, async (row) => {
      attempts.push(row);
      return { data: null, error: { code: "23505" } };
    });
    expect(attempts).toHaveLength(1);
    expect(res.error).toEqual({ code: "23505" });
  });
});
