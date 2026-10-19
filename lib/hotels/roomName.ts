import type { Rate } from "@/lib/hotel.type";

/**
 * The room an order bought, as the hotel card names it: the rate's own
 * `main_name`, plus its bedding when the supplier names one (the same string
 * is the key of `hotelsInfo[id].rooms`). Stored as
 * `hotel_order_info.hotelInformation.roomName`.
 *
 * Until 2026-10-19 the hotel step stored the hotel's FIRST room there,
 * whatever rate was picked - reservation 2233 bought a "Classic room" and
 * saved "Single room". `fallback` is only for a rate that names no room.
 */
export const rateRoomName = (rate: Rate | null | undefined, fallback = ""): string => {
  const main = rate?.room_data_trans?.main_name;
  if (!main) return fallback;
  const bedding = rate?.room_data_trans?.bedding_type;
  return bedding ? `${main} ${bedding}` : main;
};
