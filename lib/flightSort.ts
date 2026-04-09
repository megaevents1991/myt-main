import { Flight } from "./app.types";
import { parseDuration } from "./parseDuration";

export type SortOptions = "price_asc" | "price_desc" | "duration";

export const flightSort = (data: Flight[], sortOption: SortOptions) => {
  return [...data].sort((a, b) => {
    switch (sortOption) {
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      case "duration":
        return parseDuration(a.duration) - parseDuration(b.duration);
      default:
        return 0;
    }
  });
};
