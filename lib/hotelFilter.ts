import { Hotel, RoomsInfo } from "./hotel.type";

export const applyFiltersAndSorting = ({
  hotels,
  priceRange,
  rating,
  hotelsInfo,
}: {
  hotels: Hotel[];
  priceRange: [number, number];
  rating: boolean[];
  hotelsInfo: RoomsInfo;
}) => {
  // Apply filters

  const filteredHotels = hotels.filter((hotel) => {
    const price = +hotel.rates[0].payment_options.payment_types[0].show_amount;

    const hotelRating = hotelsInfo[hotel.id].rating;

    const matchesRating =
      rating.every((r) => r) ||
      rating.every((r) => !r) ||
      rating[hotelRating - 1];

    const matchesPriceRange = price >= priceRange[0] && price <= priceRange[1];

    return matchesPriceRange && matchesRating;
  });

  return filteredHotels;
};
