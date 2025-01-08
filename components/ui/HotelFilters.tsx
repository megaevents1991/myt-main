import { RangeSlider } from "@mantine/core";
import { useEffect, useState } from "react";

const themeColor = "#05203C";

export const HotelFilters = ({
  maxPrice,
  onPriceRangeChange,
  onSearchChange,
}: {
  maxPrice: number;
  onPriceRangeChange: (range: [number, number]) => void;
  onSearchChange: (search: string) => void;
}) => {
  const [value, setValue] = useState<[number, number]>([0, 2000]);
  const handleOnChangeEnd = (value: [number, number]) => {
    onPriceRangeChange(value);
  };

  const handleOnChange = (value: [number, number]) => {
    setValue(value);
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
    <div>
      <h1>Filters</h1>
      <div>כוכבים</div>
      <div>ביקורת</div>
      <div style={{ margin: "auto", maxWidth: "90%" }}>
        <RangeSlider
          thumbSize={20}
          min={0}
          max={Math.ceil(maxPrice)}
          step={10}
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
