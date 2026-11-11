// The sandbox summary's rules (lib/tixstock-booking/summary.ts): what the order summary of a TixStock test event
// adds, and the attendees it sends with the pay click. A real event's summary gets `none` and changes nothing.
import { describe, expect, it } from "vitest";
import type { OrderTicket } from "@/lib/app.types";
import { attendeesForRequest, attendeesReady, sandboxSummaryState } from "@/lib/tixstock-booking/summary";

const ticket = (tixstock?: OrderTicket["tixstock"]): OrderTicket => ({
  id: "row-1",
  vendor: "",
  category: "Curva Sud",
  price: 121,
  description: "",
  quantity: 2,
  tixstock,
});

const sandbox = { is_test: true, tixstock_booking: "sandbox_site" };

describe("what the summary of a sandbox test event adds", () => {
  it("none for real events", () => {
    expect(sandboxSummaryState({ is_test: false }, ticket({ listingId: "L", italian: true, singleSeats: true }))).toEqual({ kind: "none" });
    expect(sandboxSummaryState({ is_test: false, tixstock_booking: "sandbox_site" }, ticket())).toEqual({ kind: "none" });
    expect(sandboxSummaryState({ is_test: true, tixstock_booking: null }, ticket())).toEqual({ kind: "none" });
    expect(sandboxSummaryState(undefined, ticket())).toEqual({ kind: "none" });
  });

  it("pick_again without listing", () => {
    expect(sandboxSummaryState(sandbox, ticket())).toEqual({ kind: "pick_again" });
    expect(sandboxSummaryState(sandbox, undefined)).toEqual({ kind: "pick_again" });
    expect(sandboxSummaryState(sandbox, ticket({ listingId: "  ", italian: false, singleSeats: false }))).toEqual({ kind: "pick_again" });
  });

  it("ready", () => {
    expect(sandboxSummaryState(sandbox, ticket({ listingId: "L", italian: true, singleSeats: false }))).toEqual({
      kind: "ready",
      listingId: "L",
      italian: true,
      singleSeats: false,
    });
    expect(
      sandboxSummaryState({ is_test: true, tixstock_booking: "sandbox_office" }, ticket({ listingId: "L2", italian: false, singleSeats: true })),
    ).toEqual({ kind: "ready", listingId: "L2", italian: false, singleSeats: true });
  });
});

describe("the attendees sent with the pay click", () => {
  const passengers = [
    { firstName: "  Dana ", lastName: " Levi  " },
    { firstName: "Omer", lastName: "Levi" },
  ];
  const extra = [
    { passport: " 12345678 ", nationality: "il", dob: "1990-04-02", gender: "F" as const, birth_place: " Haifa " },
    { passport: "87654321", nationality: "IL", dob: "1988-11-30", gender: "M" as const, birth_place: "Tel Aviv" },
  ];

  it("attendees: one per passenger, names trimmed, the Italian details kept for an Italian event", () => {
    expect(attendeesForRequest(passengers, extra, true)).toEqual([
      { first_name: "Dana", last_name: "Levi", passport: "12345678", nationality: "IL", dob: "1990-04-02", gender: "F", birth_place: "Haifa" },
      { first_name: "Omer", last_name: "Levi", passport: "87654321", nationality: "IL", dob: "1988-11-30", gender: "M", birth_place: "Tel Aviv" },
    ]);
  });

  it("attendees: the Italian details are dropped when the event is not in Italy", () => {
    expect(attendeesForRequest(passengers, extra, false)).toEqual([
      { first_name: "Dana", last_name: "Levi" },
      { first_name: "Omer", last_name: "Levi" },
    ]);
  });

  it("attendees: a passenger with no details typed yet is still an attendee", () => {
    expect(attendeesForRequest(passengers, [extra[0]], true)).toHaveLength(2);
    expect(attendeesForRequest(passengers, [extra[0]], true)[1]).toEqual({ first_name: "Omer", last_name: "Levi" });
  });

  it("pay waits for every Italian detail of every traveller, and for nothing on another event", () => {
    expect(attendeesReady(attendeesForRequest(passengers, extra, true), true)).toBe(true);
    expect(attendeesReady(attendeesForRequest(passengers, [extra[0]], true), true)).toBe(false);
    expect(attendeesReady(attendeesForRequest(passengers, [{ ...extra[0], dob: "1990-02-31" }, extra[1]], true), true)).toBe(false);
    // Names are the summary's own fields and its own validation: they never hold the pay button here.
    expect(attendeesReady(attendeesForRequest([{ firstName: "", lastName: "" }], [], false), false)).toBe(true);
  });
});

describe("the nationality list of the Italian attendee form", () => {
  it("offers ISO 3166-1 alpha-2 codes, each once, with a Hebrew name, Israel first", async () => {
    const { NATIONALITY_CODES, nationalityOptions } = await import("@/lib/tixstock-booking/nationalities");
    expect(NATIONALITY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(NATIONALITY_CODES).size).toBe(NATIONALITY_CODES.length);
    for (const code of ["IL", "IT", "GB", "US", "FR", "DE"]) expect(NATIONALITY_CODES).toContain(code);

    const options = nationalityOptions();
    expect(options).toHaveLength(NATIONALITY_CODES.length);
    expect(options[0].code).toBe("IL");
    expect(options[0].label).toBe("ישראל");
    expect(options.find((o) => o.code === "IT")?.label).toBe("איטליה");
    // Every code the form can send passes the rule confirm-order checks it with.
    expect(options.every((o) => /^[A-Za-z]{2}$/.test(o.code))).toBe(true);
  });
});
