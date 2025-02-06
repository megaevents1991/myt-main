import { cn } from "@/lib/utils";
import { useState } from "react";
import { icons } from "../icons/amenitiesIcons";
import Image from "next/image";

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
        className={cn(showHotelData && "underline", "ml-2 text-main")}
      >
        שירותי המלון
      </button>
      <button
        onClick={() => handleChange(false)}
        className={cn(!showHotelData && "underline", "ml-2 text-main")}
      >
        פרטי חדר
      </button>
      <br />
      {(!showHotelData ? roomAmenities : hotelAmenities).map((amenity) => {
        const icon = icons.find((icon) => icon.originalTag === amenity);

        return icon ? (
          <span
            key={icon.originalTag}
            style={{ display: "inline-block" }}
            className="bg-gray-200 rounded-md text-xs px-1 py-0.5 my-1 ml-2"
          >
            <div className="flex items-center gap-1">
              <span className="hidden lg:inline-block">{icon?.displayTag}</span>
              <Image
                style={{ fill: "#05203C" }}
                alt="amenity icon"
                src={`/icons/${icon?.icon}`}
                // src={icon?.icon || ""}
                width={16}
                height={16}
              />
            </div>
          </span>
        ) : null;
      })}
    </>
  );
};
