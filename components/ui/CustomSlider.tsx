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
}: {
  onChange: (value: number) => void;
  onChangeEnd: (value: number) => void;
  value: number;
  maxValue: number;
  minValue: number;
  variant?: "price" | "time";
}) => {
  const handleOnChange = (value: number) => {
    onChange(value);
  };
  const handleOnChangeEnd = (value: number) => {
    onChangeEnd(value);
  };

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
            value: 0,
            label: <>&#36;0</>,
          },
          {
            value: maxValue,
            label: <>+&#36;{Math.ceil(maxValue - minValue)}</>,
          },
        ];

  return (
    <div style={{ margin: "auto", maxWidth: "90%" }}>
      <Slider
        thumbSize={20}
        min={variant === "time" ? minValue : Math.ceil(minValue)}
        max={variant === "time" ? maxValue : Math.ceil(maxValue)}
        step={variant === "time" ? 0.5 : Math.floor((maxValue - minValue) / 10)}
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
          variant === "time" ? formatTime(value) : Math.ceil(value - minValue)
        }
        marks={marks}
      />
    </div>
  );
};
