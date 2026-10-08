import { afterEach, describe, expect, it, vi } from "vitest";
import { trackServerSideEvent, unitPrice } from "@/lib/gtmAnalytics";

const sent = async (eventData: Parameters<typeof trackServerSideEvent>[0]["eventData"]) => {
  let body: { events: { params: Record<string, unknown> & { items: Record<string, unknown>[] } }[] } | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body);
      return { ok: true, text: async () => "" };
    }),
  );
  await trackServerSideEvent({ eventData, eventType: "purchase" });
  return body!.events[0].params;
};

afterEach(() => vi.unstubAllGlobals());

describe("unitPrice", () => {
  it("spreads the total over the units, in cents", () => {
    expect(unitPrice(1500, 3)).toBe(500);
    expect(unitPrice(1000, 3)).toBe(333.33);
  });
  it("a missing or sub-1 quantity counts as one unit", () => {
    expect(unitPrice(1500)).toBe(1500);
    expect(unitPrice(1500, 0)).toBe(1500);
    expect(unitPrice(1500, undefined)).toBe(1500);
  });
});

describe("trackServerSideEvent value", () => {
  it("sends the order total as `value` and the PER-UNIT price on the item", async () => {
    const params = await sent({ id: 1, name: "e", value: 1500, currency: "USD", quantity: 3 });
    expect(params.value).toBe(1500);
    expect(params.items[0].price).toBe(500);
    expect(params.items[0].quantity).toBe(3);
  });

  it("no value -> no `value` and no item `price` (never a made-up number)", async () => {
    const params = await sent({ id: 1, name: "e" });
    expect(params).not.toHaveProperty("value");
    expect(params.items[0]).not.toHaveProperty("price");
    expect(params.currency).toBe("USD");
  });
});
