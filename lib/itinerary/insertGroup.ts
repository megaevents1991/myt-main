/**
 * "Build Your Euro Trip" - writing a trip's reservation rows, and reading them back by group.
 *
 * The database calls are handed in (`GroupDb` - the route wires them to the shared Supabase
 * client), so this module never loads the client and its rules are unit-tested.
 *
 * - ONE insert of every row (`insert(rows).select(...)`): a single statement, so the group is
 *   written whole or not at all. No column stripping: unlike `insertReservation`
 *   (lib/reservation-insert.ts) a missing column fails the hold - a row without its group could
 *   never be found, paid or cancelled as part of its trip.
 * - The unique index on (itinerary_group, itinerary_seq) turns a concurrent second copy of the
 *   same request into `23505`: the group the first one wrote is read back and answered.
 */

export type DbError = { code?: string; message?: string; details?: string; hint?: string } | null;

/** What is read back of a row. */
export type GroupRow = { id: number; itinerary_seq: number | null; booking_reference?: string | null };

type DbAnswer = { data: GroupRow[] | null; error: DbError };

export type GroupDb = {
  /** `supabase.from("reservations").insert(rows).select("id, itinerary_seq, ...")`. */
  insert: (rows: Record<string, unknown>[]) => PromiseLike<DbAnswer>;
  /** `supabase.from("reservations").select("id, itinerary_seq, ...").eq("itinerary_group", group)`. */
  find: (group: string) => PromiseLike<DbAnswer>;
};

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

const bySeq = (rows: GroupRow[]): GroupRow[] => [...rows].sort((a, b) => (a.itinerary_seq ?? 0) - (b.itinerary_seq ?? 0));

const describe = (e: DbError): string => `${e?.code ?? "?"}: ${e?.message ?? "unknown error"}`;

const thrown = (e: unknown): DbError => ({ message: e instanceof Error ? e.message : String(e) });

/**
 * The rows of a group, in seq order (none = never written) - or `unavailable` when the read
 * failed (e.g. the columns are not there yet): the caller cannot tell, and goes on to the insert,
 * which fails closed for the same reason.
 */
export async function findGroup(group: string, db: GroupDb): Promise<{ rows: GroupRow[] } | { unavailable: DbError }> {
  try {
    const { data, error } = await db.find(group);
    if (error) return { unavailable: error };
    return { rows: bySeq(data ?? []) };
  } catch (e) {
    return { unavailable: thrown(e) };
  }
}

/**
 * Inserts the rows in one statement. Answers the new ids in seq order; `duplicate` = the same
 * group was already written (by a concurrent copy of the request) and these are its ids. An error
 * is `{ error }` - the one statement failed, nothing was written. `group` defaults to the rows' own.
 *
 * An insert that answers WITHOUT an error but with fewer rows than it was sent still wrote the
 * group (one statement: all or nothing): it is logged loudly and the group is read back for its
 * ids - never reported as "nothing written" (a retry would only find the same rows).
 */
export async function insertGroup(
  rows: Record<string, unknown>[],
  db: GroupDb,
  group?: string,
): Promise<{ ids: number[]; duplicate: boolean } | { error: string; dbError?: DbError }> {
  const key = group ?? (typeof rows[0]?.itinerary_group === "string" ? rows[0].itinerary_group : undefined);
  try {
    const { data, error } = await db.insert(rows);
    if (error) {
      if (error.code === UNIQUE_VIOLATION && key) {
        const again = await findGroup(key, db);
        if ("rows" in again && again.rows.length) return { ids: again.rows.map((r) => r.id), duplicate: true };
      }
      return { error: describe(error), dbError: error };
    }
    const written = bySeq(data ?? []);
    if (written.length !== rows.length) {
      console.error(
        `[itinerary/confirm] !!! group ${key ?? "?"}: the insert succeeded but answered ${written.length} rows for ${rows.length} - the group IS written; reading it back`,
      );
      const again = key ? await findGroup(key, db) : null;
      const back = again && "rows" in again && again.rows.length ? again.rows : written;
      return { ids: back.map((r) => r.id), duplicate: false };
    }
    return { ids: written.map((r) => r.id), duplicate: false };
  } catch (e) {
    const dbError = thrown(e);
    return { error: describe(dbError), dbError };
  }
}
