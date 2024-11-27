import { Slider, Text } from "@mantine/core";

export const TimeSlider = ({
  onChangeEnd,
  onChange,
  value,
  maxValue = 30,
}: {
  onChangeEnd: (value: number) => void;
  onChange: (value: number) => void;
  value: number;
  maxValue: number;
}) => {
  // Function to convert hour to 24-hour time format
  const formatTime = (value: number) => {
    const hours = Math.floor(value);
    const minutes = Math.floor((value - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const handleOnChangeEnd = (value: number) => {
    onChangeEnd(value);
  };
  const handleOnChange = (value: number) => {
    onChange(value);
  };

  return (
    <div style={{ width: 300, margin: "auto" }}>
      <Slider
        min={0} // 12:00 AM
        max={maxValue} // 11:00 PM
        step={0.5} // Each tick represents an hour
        value={value}
        onChange={handleOnChange}
        onChangeEnd={handleOnChangeEnd}
        label={formatTime(value)}
      />
      <Text>Trip Duration: {formatTime(value)}</Text>
    </div>
  );
};
