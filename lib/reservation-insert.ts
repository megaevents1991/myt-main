/**
 * The reservation insert of confirm-order and its retries when a backoffice
 * migration has not landed yet (the schema and the app deploy separately, and a
 * checkout must never fail on an OPTIONAL column).
 *
 * Two optional column groups, stripped in this order:
 *  1. the ticket-cost snapshot (`ticket_cost_*`, migration 20261008120000) -
 *     dropped ALONE first, because the settlement columns below usually exist and
 *     losing `agent_card_discount_ils` would charge an agent_card order in full;
 *  2. the settlement / attribution columns - the long-standing retry, together
 *     with the cost columns.
 *
 * PostgREST answers an INSERT naming a column it has no schema-cache entry for
 * with `PGRST204` (checked against a local Supabase: "Could not find the 'x'
 * column of 'reservations' in the schema cache"); Postgres itself says `42703`.
 * The cost step treats both as "a column is missing". The settlement step keeps
 * its original `42703`-only condition (lib/quote-actions.ts handles PGRST204 the
 * same way for its own optional column).
 */

/** Written only when the supplier cost was found (lib/ticket-cost.ts). */
export const COST_KEYS = ["ticket_cost_usd", "ticket_cost_source"] as const;

/** Settlement / attribution columns added by earlier backoffice migrations. */
export const SETTLEMENT_KEYS = [
  "partner_settlement_method",
  "agent_card_discount_ils",
  "source_share_token",
  "quote_id",
] as const;

export type InsertResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { code?: string; message?: string } | null;
};

/** One insert attempt: `(row) => supabase.from("reservations").insert(row).select().single()`. */
export type InsertFn = (row: Record<string, unknown>) => PromiseLike<InsertResult>;

const without = (
  row: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

const isMissingColumn = (error: InsertResult["error"]): boolean =>
  error?.code === "42703" || error?.code === "PGRST204";

/**
 * @param ticketCost the snapshot attached to `payload` (null = none attached, so
 *   there is nothing for the cost step to strip).
 */
export async function insertReservation(
  payload: Record<string, unknown>,
  ticketCost: unknown,
  insertFn: InsertFn,
): Promise<InsertResult> {
  let result = await insertFn(payload);

  if (ticketCost && isMissingColumn(result.error)) {
    result = await insertFn(without(payload, COST_KEYS));
  }

  if (result.error?.code === "42703") {
    result = await insertFn(without(payload, [...SETTLEMENT_KEYS, ...COST_KEYS]));
  }

  return result;
}
