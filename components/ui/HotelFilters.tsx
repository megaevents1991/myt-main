import { Checkbox, RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";
import { StarsGroup } from "@/components/ui/StarsGroup";
import { Search } from "lucide-react";
import { HotelSearchCriteria } from "@/lib/app.types";
import { HotelKind } from "@/lib/hotel.type";

const themeColor = "#05203C";

const hotelKindOptionsNaming = {
  Resort: "Resort",
  Sanatorium: "Sanatorium",
  Guesthouse: "Guesthouse",
  "Mini-hotel": "Mini-hotel",
  Castle: "Castle",
  Hotel: "Hotel",
  Boutique_and_Design: "Boutique",
  Apartment: "Apartment",
  Cottages_and_Houses: "Houses",
  Farm: "Farm",
  Villas_and_Bungalows: "Villas",
  Camping: "Camping",
  Hostel: "Hostel",
  BNB: "B&B",
  Glamping: "Glamping",
  "Apart-hotel": "Apart-hotel",
};

export const HotelFilters = ({
  maxPrice,
  onCriteriaChange,
  selectedRating,
  meal,
  kind,
  maxDistance,
  minPrice,
  basePrice,
  hotelKindOptions,
}: //freeCancellation,
{
  onCriteriaChange: (criteria: HotelSearchCriteria) => void;
  maxPrice: number;
  maxDistance: number;
  selectedRating: boolean[];
  meal: ("withMeal" | "withoutMeal")[];
  kind: HotelKind[];
  minPrice: number;
  basePrice: number;
  hotelKindOptions: HotelKind[];
  freeCancellation: ("withFreeCancellation" | "withoutFreeCancellation")[];
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
      label: <>&#8364;{minPrice - basePrice}</>,
    },
    {
      value: maxPrice,
      label: <>+&#8364;{Math.ceil(maxPrice - basePrice)}</>,
    },
  ];

  const distanceMarks = [
    {
      value: 0,
      label: <>0 ק&quot;מ</>,
    },
    {
      value: maxDistance + 1000,
      label: <>{Math.round((maxDistance / 1000) * 10) / 10 + 1} ק&quot;מ</>,
    },
  ];

  return (
    <div className="flex flex-col items-center p-4 border-2 border-gray-200 shadow-lg rounded-lg">
      <div className="m-auto w-full px-2">
        <div dir="rtl" className="w-full">
          <h3 className="text-lg text-start font-semibold mb-2">ארוחות בוקר</h3>
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
              <label htmlFor="withMeal">כולל ארוחת בוקר</label>
            </div>
          </Checkbox.Group>
        </div>
      </div>
      <div className="m-auto w-full mt-4 px-2">
        <div dir="rtl" className="w-full">
          <h3 className="text-lg text-start font-semibold mb-2">סוג אירוח</h3>
          <Checkbox.Group
            value={kind}
            onChange={(value) =>
              onCriteriaChange({
                value: value as [
                  "Resort",
                  "Sanatorium",
                  "Guesthouse",
                  "Mini-hotel",
                  "Castle",
                  "Hotel",
                  "Boutique_and_Design",
                  "Apartment",
                  "Cottages_and_Houses",
                  "Farm",
                  "Villas_and_Bungalows",
                  "Camping",
                  "Hostel",
                  "BNB",
                  "Glamping",
                  "Apart-hotel"
                ],
                type: "kind",
              })
            }
          >
            {hotelKindOptions.map((value, i) => (
              <Checkbox
                value={value}
                id={value}
                label={hotelKindOptionsNaming[value]}
                key={i}
                className="my-2"
              />
            ))}
          </Checkbox.Group>
        </div>
      </div>
      <div className="m-auto w-full mt-2 px-2">
        <h3 className="text-lg text-end font-semibold mb-2">דירוג כוכבים</h3>
        <StarsGroup
          value={stars}
          onChange={handleRatingChange}
          className="mb-6"
        />
        <h3 className="text-lg text-end font-semibold mb-2">מחיר</h3>
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
      </div>
      <div className="m-auto w-full mt-2 px-2">
        <form className="flex w-full shadow-md mt-8" dir="rtl">
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
      </div>
      <div className="m-auto w-full mt-4 px-2">
        <h3 className="text-lg text-end font-semibold mb-2">מרחק</h3>
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
        <div className="p-6"></div>
      </div>
    </div>
  );
};

/*

          <div dir="rtl" className="w-full">
            <h3 className="text-lg text-start font-semibold mb-2">
              ביטול מלון חינם
            </h3>
            <Checkbox.Group
              value={freeCancellation}
              onChange={(value) =>
                onCriteriaChange({
                  value: value as (
                    | "withFreeCancellation"
                    | "withoutFreeCancellation"
                  )[],
                  type: "freeCancellation",
                })
              }
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  value="withFreeCancellation"
                  id="with-free-cancellation"
                />
                <label htmlFor="withFreeCancellation">ביטול חינם</label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  value="withoutFreeCancellation"
                  id="without-free-cancellation"
                />
                <label htmlFor="withoutFreeCancellation">ללא ביטול חינם</label>
              </div>
            </Checkbox.Group>
          </div>
*/
