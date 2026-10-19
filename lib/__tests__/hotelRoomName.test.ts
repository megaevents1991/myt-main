import { describe, it, expect } from "vitest";
import { rateRoomName } from "../hotels/roomName";
import type { Rate } from "../hotel.type";

const rate = (main: string | undefined, bedding?: string | null): Rate =>
  ({ room_data_trans: { main_name: main, bedding_type: bedding ?? null } }) as unknown as Rate;

describe("rateRoomName - the room the order bought (reservation 2233 stored 'Single room' for a 'Classic room')", () => {
  it("is the rate's own room, with its bedding when the supplier names one", () => {
    expect(rateRoomName(rate("Classic room"))).toBe("Classic room");
    expect(rateRoomName(rate("Standard Double room", "double bed"))).toBe("Standard Double room double bed");
  });
  it("falls back only when the rate names no room", () => {
    expect(rateRoomName(rate(undefined), "Single room")).toBe("Single room");
    expect(rateRoomName(undefined, "Single room")).toBe("Single room");
    expect(rateRoomName(undefined)).toBe("");
  });
});
