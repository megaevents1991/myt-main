import { Hotel, HotelsInfoClient } from "./hotel.type";

export type SortOptions = "price_asc" | "rating";

export const applyFiltersAndSorting = ({
  hotels,
  priceRange,
  rating,
  hotelsInfo,
  sortOption = "price_asc",
  hotelName,
}: {
  hotels: Hotel[];
  priceRange: [number, number];
  rating: boolean[];
  hotelsInfo: HotelsInfoClient;
  sortOption?: SortOptions;
  hotelName?: string;
}) => {
  // Apply filters

  const filteredHotels = hotels.filter((hotel) => {
    const price = +hotel.rates[0].payment_options.payment_types[0].show_amount;

    const hotelRating = hotelsInfo[hotel.id].metadata.rating;

    const matchesName = hotelName
      ? hotelsInfo[hotel.id].metadata.hotelName
          .toUpperCase()
          .includes(hotelName.toUpperCase())
      : true;

    const matchesRating =
      rating.every((r) => r) ||
      rating.every((r) => !r) ||
      rating[hotelRating - 1];

    const matchesPriceRange = price >= priceRange[0] && price <= priceRange[1];

    return matchesPriceRange && matchesRating && matchesName;
  });

  const sortedHotels = hotelSort(filteredHotels, sortOption, hotelsInfo);

  return sortedHotels;
};

export const hotelSort = (
  hotels: Hotel[],
  sortOption: SortOptions,
  hotelsInfo: HotelsInfoClient
) => {
  return [...hotels].sort((a, b) => {
    switch (sortOption) {
      case "price_asc":
        return (
          +a.rates[0].payment_options.payment_types[0].show_amount -
          +b.rates[0].payment_options.payment_types[0].show_amount
        );
      case "rating":
        return (
          hotelsInfo[b.id].metadata.rating - hotelsInfo[a.id].metadata.rating
        );

      default:
        return 0;
    }
  });
};
