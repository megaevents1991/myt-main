import { formatPrice } from "@/lib/price.utils";
import { Slider } from "@mantine/core";

const themeColor = "#05203C";

const formatTime = (value: number) => {
  const hours = Math.floor(value);
  const minutes = Math.floor((value - hours) * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
};

export const CustomSlider = ({
  onChangeEnd,
  onChange,
  value,
  maxValue = 3000,
  minValue = 0,
  variant = "time",
  basePrice = 0,
  numOfPassengers = 1,
}: {
  onChange: (value: number) => void;
  onChangeEnd: (value: number) => void;
  value: number;
  maxValue: number;
  minValue: number;
  variant?: "price" | "time";
  basePrice?: number;
  numOfPassengers?: number;
}) => {
  const handleOnChange = (value: number) => {
    onChange(value);
  };
  const handleOnChangeEnd = (value: number) => {
    onChangeEnd(value);
  };

  const priceMinValue = Math.min(minValue / numOfPassengers, basePrice);

  const marks =
    variant === "time"
      ? [
          {
            value: 0,
            label: <>שעות {minValue}</>,
          },
          { value: 1439, label: <>שעות {maxValue}</> },
        ]
      : [
          {
            value: priceMinValue,
            label: <>{formatPrice(minValue / numOfPassengers - basePrice)}</>,
          },
          {
            value: maxValue,
            label: <>{formatPrice(maxValue / numOfPassengers - basePrice)}</>,
          },
        ];

  return (
    <div style={{ margin: "auto", maxWidth: "90%" }}>
      <Slider
        thumbSize={20}
        min={variant === "time" ? minValue : Math.ceil(minValue)}
        max={variant === "time" ? maxValue : Math.ceil(maxValue + 10)}
        step={
          variant === "time"
            ? 0.5
            : Math.floor((maxValue / numOfPassengers - priceMinValue) / 10)
        }
        value={value}
        styles={{
          bar: { backgroundColor: themeColor },
          mark: { backgroundColor: "transparent", borderColor: "transparent" },
          label: { backgroundColor: themeColor },
          thumb: { backgroundColor: themeColor, borderColor: themeColor },
        }}
        onChange={handleOnChange}
        onChangeEnd={handleOnChangeEnd}
        label={
          variant === "time"
            ? formatTime(value)
            : Math.ceil(value / numOfPassengers - priceMinValue)
        }
        marks={marks}
      />
    </div>
  );
};
