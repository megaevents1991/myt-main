export const formatHotelName = (hotelId: string): string => {
  return hotelId
    .split("_") // Split the string into words based on underscores
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(" "); // Join the words with spaces
};
