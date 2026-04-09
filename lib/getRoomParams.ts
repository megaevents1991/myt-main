export const getRoomParams = (totalAdults: number) => {
  const baseRoom = { children: [] };
  const rooms: Array<{ children: never[]; adults: number }> = [];

  // Maximum possible rooms with 3 adults
  const maxThreePersonRooms = Math.floor(totalAdults / 3);
  const remainingAdults = totalAdults % 3;

  // Distribute 3-person rooms
  for (let i = 0; i < maxThreePersonRooms; i++) {
    rooms.push({ ...baseRoom, adults: 3 });
  }

  // Handle remaining adults
  if (remainingAdults === 1 && rooms.length > 0) {
    // Convert one 3-person room to two 2-person rooms
    rooms.pop();
    rooms.push({ ...baseRoom, adults: 2 });
    rooms.push({ ...baseRoom, adults: 2 });
  } else if (remainingAdults === 1 && rooms.length === 0) {
    rooms.push({ ...baseRoom, adults: 1 });
  } else if (remainingAdults === 2) {
    rooms.push({ ...baseRoom, adults: 2 });
  }

  return rooms;
};
