import { Checkbox, RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";
import { StarsGroup } from "@/components/ui/StarsGroup";
import { Search } from "lucide-react";
import { HotelSearchCriteria } from "@/lib/app.types";
import { on } from "events";

const themeColor = "#05203C";

export const HotelFilters = ({
  maxPrice,
  onCriteriaChange,
  selectedRating,
  meal,
  maxDistance,
  minPrice,
  basePrice,
  freeCancellation,
}: {
  onCriteriaChange: (criteria: HotelSearchCriteria) => void;
  maxPrice: number;
  maxDistance: number;
  selectedRating: boolean[];
  meal: ["withMeal", "withoutMeal"];
  minPrice: number;
  basePrice: number;
  freeCancellation: boolean;
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [value, setValue] = useState<[number, number]>([minPrice, maxPrice]);
  const handlePriceRangeChangeEnd = (value: [number, number]) => {
    onCriteriaChange({ value, type: "priceRange" });
  };
  const [distanceFromCenter, setDistanceFromCenter] = useState<
    [number, number]
  >([0, maxDistance]);
  const [stars, setStars] = useState<boolean[]>(selectedRating);

  const handleDistanceFromCenterChange = (value: [number, number]) => {
    setDistanceFromCenter(value);
  };

  const handlePriceRangeChange = (value: [number, number]) => {
    setValue(value);
  };
  const handleRatingChange = (value: boolean[]) => {
    setStars(value);
    onCriteriaChange({ value, type: "rating" });
  };

  const handleDistanceFromCenterChangeEnd = (value: [number, number]) => {
    onCriteriaChange({ value, type: "distanceFromCenter" });
  };

  useEffect(() => {
    setValue([minPrice, maxPrice]);
  }, [maxPrice, minPrice]);

  useEffect(() => {
    setDistanceFromCenter([0, maxDistance]);
  }, [maxDistance]);

  const marks = [
    {
      value: minPrice,
      label: <>{minPrice - basePrice} &#8364;</>,
    },
    {
      value: maxPrice,
      label: <>+{Math.ceil(maxPrice - basePrice)} &#8364;</>,
    },
  ];

  const distanceMarks = [
    {
      value: 0,
      label: <>0 ק"מ</>,
    },
    {
      value: maxDistance + 1000,
      label: <>{Math.round((maxDistance / 1000) * 10) / 10 + 1} ק"מ</>,
    },
  ];

  return (
    <div className="flex flex-col items-center p-5 gap-5 border-2 border-gray-200 shadow-lg rounded-lg">
      <StarsGroup
        value={stars}
        onChange={handleRatingChange}
        className="mt-5"
      />
      <div className="m-auto w-full mt-5 px-2">
        <h3 className="text-lg text-end font-semibold mb-4">מחיר</h3>
        <RangeSlider
          thumbSize={20}
          min={minPrice}
          max={maxPrice + 2}
          step={5}
          label={(value) => value - basePrice}
          value={value}
          styles={{
            bar: { backgroundColor: themeColor },
            mark: {
              backgroundColor: "transparent",
              borderColor: "transparent",
            },
            label: { backgroundColor: themeColor },
            thumb: { backgroundColor: themeColor, borderColor: themeColor },
          }}
          onChange={handlePriceRangeChange}
          onChangeEnd={handlePriceRangeChangeEnd}
          marks={marks}
        />
        <div className="p-6"></div>
        <h3 className="text-lg text-end font-semibold mb-4">מרחק</h3>
        <RangeSlider
          thumbSize={20}
          min={0}
          max={maxDistance + 1000}
          step={100}
          label={(value) => Math.round((value / 1000) * 10) / 10}
          value={distanceFromCenter}
          styles={{
            bar: { backgroundColor: themeColor },
            mark: {
              backgroundColor: "transparent",
              borderColor: "transparent",
            },
            label: { backgroundColor: themeColor },
            thumb: { backgroundColor: themeColor, borderColor: themeColor },
          }}
          onChange={handleDistanceFromCenterChange}
          onChangeEnd={handleDistanceFromCenterChangeEnd}
          marks={distanceMarks}
        />
      </div>
      <form className="flex w-full shadow-md mt-10" dir="rtl">
        <input
          onChange={(e) => setSearchValue(e.target.value)}
          value={searchValue}
          placeholder="חפש מלון..."
          type="text"
          className="w-2/3 rounded-r p-2 text-main border text-xs"
        />
        <button
          className="w-1/3 bg-secondary text-white rounded-l flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            onCriteriaChange({
              value: searchValue,
              type: "hotelName",
            });
            setSearchValue("");
          }}
        >
          <Search />
        </button>
      </form>
      <div dir="rtl" className="w-full">
        <Checkbox.Group
          value={meal}
          onChange={(value) =>
            onCriteriaChange({
              value: value as ["withMeal", "withoutMeal"],
              type: "meal",
            })
          }
        >
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="withMeal" id="with-meal" />
            <label htmlFor="withMeal">כולל ארוחה</label>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox value="withoutMeal" id="without-meal" />
            <label htmlFor="withoutMeal">ללא ארוחה</label>
          </div>
        </Checkbox.Group>
        <div dir="rtl" className="w-full">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              onChange={(value) =>
                onCriteriaChange({
                  value: value.target.checked,
                  type: "freeCancellation",
                })
              }
              checked={freeCancellation}
              id={"free-cancellation"}
            />
            <label htmlFor="free-cancellation">ביטול חינם</label>
          </div>
        </div>
      </div>
    </div>
  );
};
