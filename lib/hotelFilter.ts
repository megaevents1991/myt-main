import { Hotel } from "./hotel.type";

export const applyFiltersAndSorting = ({
  hotels,
  priceRange,
}: {
  hotels: Hotel[];
  priceRange: [number, number];
}) => {
  // Apply filters

  const filteredHotels = hotels.filter((hotel) => {
    const price = +hotel.rates[0].payment_options.payment_types[0].show_amount;

    const matchesPriceRange = price >= priceRange[0] && price <= priceRange[1];

    return matchesPriceRange;
  });

  return filteredHotels;
};
