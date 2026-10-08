import { describe, expect, it } from "vitest";
import { snapshotTicketCost } from "@/lib/ticket-cost";

const deps = {
  getLiveTicketsOffers: async () => [{ id: "77", costUsd: 101.5 } as never],
  cheapestListingCostUsd: async () => 80,
};

describe("snapshotTicketCost", () => {
  it("livetickets: offer cost x quantity", async () => {
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "77", number_of_ticket: 2 },
        1,
        deps,
      ),
    ).toEqual({ ticket_cost_usd: 203, ticket_cost_source: "live" });
  });

  it("livetickets: an odd party seated in a triple also carries the group fee on its three tickets", async () => {
    const feeDeps = {
      ...deps,
      getLiveTicketsOffers: async () => [
        { id: "77", costUsd: 100, tripleFeeCostUsd: 20, maxPerOrder: 6, seatingGroupMax: 4 } as never,
      ],
    };
    // 3 tickets = one triple: 3 x 100 + 3 x 20
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "77", number_of_ticket: 3 },
        1,
        feeDeps,
      ),
    ).toEqual({ ticket_cost_usd: 360, ticket_cost_source: "live" });
    // 4 tickets = two pairs: no triple, no fee
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "77", number_of_ticket: 4 },
        1,
        feeDeps,
      ),
    ).toEqual({ ticket_cost_usd: 400, ticket_cost_source: "live" });
  });

  it("tixstock: cheapest sellable listing x quantity", async () => {
    expect(
      await snapshotTicketCost(
        { supplier: "tixstock", supplier_event_id: "t1", id: "c", number_of_ticket: 3 },
        1,
        deps,
      ),
    ).toEqual({ ticket_cost_usd: 240, ticket_cost_source: "live" });
  });

  it("tixstock: asks for the site's own pick - the matching category, and together seats for the together twin", async () => {
    const seen: unknown[] = [];
    const spy = {
      ...deps,
      cheapestListingCostUsd: async (opts: unknown) => {
        seen.push(opts);
        return 50;
      },
    };
    await snapshotTicketCost(
      {
        supplier: "tixstock",
        supplier_event_id: "t1",
        id: "c",
        category: "Categoria 2",
        supplier_category: "CATEGORIA 2 (CAT2)",
        seating_choice: "together",
        number_of_ticket: 2,
      },
      9,
      spy,
    );
    expect(seen).toEqual([
      {
        tixstockEventId: "t1",
        eventId: 9,
        ticketId: "c",
        category: "Categoria 2",
        quantity: 2,
        together: true,
      },
    ]);
  });

  it("unknown supplier or a throwing dep -> null, never a throw", async () => {
    expect(await snapshotTicketCost({ supplier: "static", number_of_ticket: 1 }, 1, deps)).toBeNull();
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "77" },
        1,
        {
          ...deps,
          getLiveTicketsOffers: async () => {
            throw new Error("down");
          },
        },
      ),
    ).toBeNull();
    expect(
      await snapshotTicketCost(
        { supplier: "tixstock", supplier_event_id: "t1", id: "c", number_of_ticket: 2 },
        1,
        {
          ...deps,
          cheapestListingCostUsd: async () => {
            throw new Error("feed down");
          },
        },
      ),
    ).toBeNull();
  });

  it("no cost found (offer gone, no sellable listing, zero cost) -> null", async () => {
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "other", number_of_ticket: 2 },
        1,
        deps,
      ),
    ).toBeNull();
    expect(
      await snapshotTicketCost(
        { supplier: "tixstock", supplier_event_id: "t1", id: "c", number_of_ticket: 2 },
        1,
        { ...deps, cheapestListingCostUsd: async () => null },
      ),
    ).toBeNull();
    expect(
      await snapshotTicketCost(
        { supplier: "livetickets", supplier_event_id: "e1", id: "77", number_of_ticket: 2 },
        1,
        { ...deps, getLiveTicketsOffers: async () => [{ id: "77", costUsd: 0 } as never] },
      ),
    ).toBeNull();
  });
});
