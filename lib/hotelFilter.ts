import { SortOptions } from "./app.types";
import { Hotel, HotelsInfoClient, HotelKind } from "./hotel.type";

export const applyFiltersAndSorting = ({
  hotels,
  priceRange,
  rating,
  hotelsInfo,
  sortOption = "price_asc",
  hotelName,
  meal,
  kind,
  distanceFromCenter,
  freeCancellation,
}: {
  distanceFromCenter: [number, number];
  hotels: Hotel[];
  priceRange: [number, number];
  rating: boolean[];
  hotelsInfo: HotelsInfoClient;
  sortOption?: SortOptions;
  hotelName?: string;
  meal: ("withMeal" | "withoutMeal")[];
  kind: HotelKind[];
  freeCancellation: ("withFreeCancellation" | "withoutFreeCancellation")[];
}) => {
  // Apply filters

  const inRange = (value: number, [min, max]: [number, number]) =>
    value >= min && value <= max;

  const filteredHotels = hotels
    .filter((hotel) => {
      const priceLow =
        +hotel.rates[0].payment_options?.payment_types[0]?.show_amount;

      const priceHigh =
        +hotel.rates[hotel.rates.length - 1].payment_options?.payment_types[0]
          .show_amount;

      const hotelRating = hotelsInfo[hotel.id]?.metadata.rating;

      const matchHasMeal = hotel.rates.some((hotelRate) =>
        meal.includes("withMeal")
          ? hotelRate.meal_data.has_breakfast
          : !hotelRate.meal_data.has_breakfast
      );

      const matchKind = kind.includes(hotelsInfo[hotel.id]?.metadata.kind);

      const matchDistanceRange = inRange(
        hotelsInfo[hotel.id]?.metadata.distanceFromCenter,
        distanceFromCenter
      );

      const isFreeCancellation = freeCancellation.includes(
        "withFreeCancellation"
      );

      const matchFreeCancellation =
        !!freeCancellation.length &&
        (freeCancellation.length === 2 ||
          hotel.rates.some((rate) =>
            rate.payment_options?.payment_types.some((paymentType) =>
              isFreeCancellation
                ? !!paymentType.cancellation_penalties.free_cancellation_before
                : !paymentType.cancellation_penalties.free_cancellation_before
            )
          ));

      const matchesName = hotelName
        ? hotelsInfo[hotel.id]?.metadata.hotelName
            .toUpperCase()
            .includes(hotelName.toUpperCase())
        : true;

      const matchesRating =
        rating.every((r) => r) ||
        rating.every((r) => !r) ||
        rating[hotelRating - 1];

      const matchesPriceRange =
        inRange(priceLow, priceRange) || inRange(priceHigh, priceRange);

      return (
        matchesPriceRange &&
        matchesRating &&
        matchesName &&
        matchHasMeal &&
        matchKind &&
        matchDistanceRange &&
        matchFreeCancellation
      );
    })
    .map((hotel) => {
      const filteredRates = hotel.rates.filter((rate) => {
        const price = +rate.payment_options?.payment_types[0]?.show_amount;

        const matchHasMeal = meal.includes("withMeal")
          ? rate.meal_data.has_breakfast
          : !rate.meal_data.has_breakfast;

        const isFreeCancellation = freeCancellation.includes(
          "withFreeCancellation"
        );

        const matchFreeCancellation =
          !!freeCancellation.length &&
          (freeCancellation.length === 2 ||
            rate.payment_options?.payment_types.every((paymentType) =>
              isFreeCancellation
                ? !!paymentType.cancellation_penalties.free_cancellation_before
                : !paymentType.cancellation_penalties.free_cancellation_before
            ));
        const matchesPriceRange = inRange(price, priceRange);

        return matchHasMeal && matchesPriceRange && matchFreeCancellation;
      });

      return { ...hotel, rates: filteredRates };
    })
    .filter((hotel) => hotel.rates.length > 0);

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
          +a.rates[0].payment_options?.payment_types[0]?.show_amount -
          +b.rates[0].payment_options?.payment_types[0]?.show_amount
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
