import { RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";
import { StarsGroup } from "./starGroup";

const themeColor = "#05203C";

export const HotelFilters = ({
  maxPrice,
  onPriceRangeChange,
  onSearchChange,
  onRatingChange,
}: {
  maxPrice: number;
  onPriceRangeChange: (range: [number, number]) => void;
  onSearchChange: (search: string) => void;
  onRatingChange: (rating: boolean[]) => void;
}) => {
  const [value, setValue] = useState<[number, number]>([0, 2000]);
  const handleOnChangeEnd = (value: [number, number]) => {
    onPriceRangeChange(value);
  };

  const handleOnChange = (value: [number, number]) => {
    setValue(value);
  };

  const [stars, setStars] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);

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
    <div className="flex flex-col gap-4 items-center">
      <h1>Filters</h1>
      <StarsGroup value={stars} onChange={handleRatingChange} />
      <div>ביקורת</div>
      <div style={{ margin: "auto", width: "100%" }}>
        <RangeSlider
          thumbSize={20}
          min={0}
          max={Math.ceil(maxPrice)}
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
      <input onChange={(e) => onSearchChange(e.target.value)}></input>
    </div>
  );
};
