import dayjs from "dayjs";
import { Event } from "./app.types";

export const getTotalPersons = (
  roomParams: { adults: number; children: number[] }[]
) => {
  return roomParams.reduce(
    (ppl, room) => ppl + room.children.length + room.adults,
    0
  );
};

export const getDaysDiff = (event: Event) => {
  return Math.abs(
    dayjs(event.def_date_depart).diff(event.def_date_return, "day")
  );
};

export const formatPrice = (price: number) => {
  const ceilPrice = Math.ceil(price);
  if (price > 0) {
    return <span dir="ltr">+${ceilPrice}</span>;
  }
  if (price < 0) {
    return <span dir="ltr">-${Math.abs(ceilPrice)}</span>;
  }
  return 0;
};
