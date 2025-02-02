import { cn } from "@/lib/utils";
import { useState } from "react";

type AmenitiesProps = {
  roomAmenities: string[];
  hotelAmenities: string[];
  onChange?: (isHotel: boolean) => void;
};

export const Amenities = ({
  roomAmenities,
  hotelAmenities,
  onChange,
}: AmenitiesProps) => {
  const [showHotelData, setShowHotelData] = useState(true);

  const handleChange = (isHotel: boolean) => {
    setShowHotelData(isHotel);
    onChange?.(isHotel);
  };

  return (
    <>
      <button
        onClick={() => handleChange(true)}
        className={cn(showHotelData && "underline", "px-1 mr-1 text-main")}
      >
        שירותי המלון
      </button>
      <button
        onClick={() => handleChange(false)}
        className={cn(!showHotelData && "underline", "px-1 mr-1 text-main")}
      >
        פרטי חדר
      </button>
      <br />
      {(!showHotelData ? roomAmenities : hotelAmenities).map((amenity) => (
        <span
          style={{ display: "inline-block" }}
          className="bg-gray-200 rounded-md text-xs px-1 py-0.5 m-1"
          key={amenity}
        >
          {amenity}
        </span>
      ))}
    </>
  );
};
