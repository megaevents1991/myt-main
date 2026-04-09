import dayjs from "dayjs";
import { Event } from "./app.types";

export const getTotalPersons = (
  roomParams: { adults: number; children: number[] }[]
) => {
  return roomParams?.reduce(
    (ppl, room) => ppl + room.children.length + room.adults,
    0
  );
};

export const getDaysDiff = (event: Event) => {
  return Math.abs(
    dayjs(event.def_date_depart).diff(event.def_date_return, "day")
  );
};

export const formatPrice = (
  price: number,
  options?: {
    factor?: number;
    formatted?: boolean;
    applyColor?: boolean;
    bold?: boolean;
  }
) => {
  const { factor = 1, formatted = false, applyColor = false } = options || {};

  let ceilPrice = Math.ceil(price);
  if (factor !== 1) {
    ceilPrice = Math.abs(ceilPrice * factor);
  }
  if (formatted) {
    if (price > 0) {
      return <span dir="ltr">+${ceilPrice.toLocaleString("en-US")}</span>;
    }
    if (price < 0) {
      return (
        <span dir="ltr">-${Math.abs(ceilPrice).toLocaleString("en-US")}</span>
      );
    }
  } else {
    if (price > 0) {
      return <span dir="ltr">+${ceilPrice}</span>;
    }
    if (price < 0) {
      return (
        <span
          dir="ltr"
          style={{
            ...(applyColor && { color: "green" }),
            ...(options?.bold && { fontWeight: "bold" }),
          }}
        >
          -${Math.abs(ceilPrice)}
        </span>
      );
    }
  }
  return 0;
};
