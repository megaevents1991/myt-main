import { Slider, Text } from "@mantine/core";
import { useState } from "react";

export const TimeSlider = ({
  handleOnChangeEnd,
}: {
  handleOnChangeEnd: (value: number) => void;
}) => {
  const [value, setValue] = useState(30); // Default value (e.g., noon)

  // Function to convert hour to 24-hour time format
  const formatTime = (value: number) => {
    const hours = Math.floor(value);
    const minutes = Math.floor((value - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const onChangeEnd = (value: number) => {
    handleOnChangeEnd(value);
  };
  const handleOnChange = (value: number) => {
    setValue(value);
  };

  return (
    <div style={{ width: 300, margin: "auto" }}>
      <Slider
        min={0} // 12:00 AM
        max={30} // 11:00 PM
        step={0.5} // Each tick represents an hour
        value={value}
        onChange={handleOnChange}
        onChangeEnd={onChangeEnd}
        label={formatTime(value)}
      />
      <Text>Trip Duration: {formatTime(value)}</Text>
    </div>
  );
};
