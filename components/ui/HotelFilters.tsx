import { RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";
import { StarsGroup } from "@/components/ui/StarsGroup";
import { Search } from "lucide-react";

const themeColor = "#05203C";

export const HotelFilters = ({
  maxPrice,
  onPriceRangeChange,
  onSearch,
  onRatingChange,
  selectedRating,
}: {
  maxPrice: number;
  onPriceRangeChange: (range: [number, number]) => void;
  onSearch: (search: string) => void;
  onRatingChange: (rating: boolean[]) => void;
  selectedRating: boolean[];
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [value, setValue] = useState<[number, number]>([0, 2000]);
  const handleOnChangeEnd = (value: [number, number]) => {
    onPriceRangeChange(value);
  };

  const handleOnChange = (value: [number, number]) => {
    setValue(value);
  };

  const [stars, setStars] = useState<boolean[]>(selectedRating);

  const handleRatingChange = (value: boolean[]) => {
    setStars(value);
    onRatingChange(value);
  };

  useEffect(() => {
    setValue([0, maxPrice]);
  }, [maxPrice]);

  const marks = [
    {
      value: 0,
      label: <>0 &#8364;</>,
    },
    { value: maxPrice, label: <>{Math.ceil(maxPrice)} &#8364;</> },
  ];

  return (
    <div className="flex flex-col items-center p-5 gap-5">
      <StarsGroup
        value={stars}
        onChange={handleRatingChange}
        className="mt-5"
      />
      <div className="m-auto w-full mt-5">
        <RangeSlider
          thumbSize={20}
          min={0}
          max={Math.ceil(maxPrice) + 10}
          step={5}
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
          onChange={handleOnChange}
          onChangeEnd={handleOnChangeEnd}
          marks={marks}
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
            onSearch(searchValue);
            setSearchValue("");
          }}
        >
          <Search />
        </button>
      </form>
    </div>
  );
};
