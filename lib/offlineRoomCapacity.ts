// Capacity mapping for the controlled vocabulary in offline_hotels.room_type.
// Must match the <SelectItem> values in the backoffice's offline-hotels form
// (../myt---backoffice/app/(dashboard)/offline-hotels/new/page.tsx).
// Follow-up: add a real `capacity` column to offline_hotels so admins can
// override these defaults per row.
export const OFFLINE_ROOM_CAPACITY: Record<string, number> = {
  Standard: 2,
  Double: 2,
  Twin: 2,
  Triple: 3,
  Deluxe: 2,
  "Junior Suite": 2,
  Suite: 2,
  "Family Room": 4,
  Studio: 2,
};

export const getOfflineRoomCapacity = (
  roomType: string | null | undefined
): number => {
  if (!roomType) return 0;
  return OFFLINE_ROOM_CAPACITY[roomType] ?? 0;
};
