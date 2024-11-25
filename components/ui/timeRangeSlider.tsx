import React, { useState } from "react";
import { RangeSlider, Text } from "@mantine/core";

export const TimeRangeSlider = ({
  onChangeEnd,
}: {
  onChangeEnd: (value: [number, number]) => void;
}) => {
  const [value, setValue] = useState<[number, number]>([0, 24]); // Initial range: 12 AM to 12 AM

  // Convert slider values to time format (e.g., 12:00 AM, 1:00 PM)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatTime = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${adjustedHour}:00 ${period}`;
  };

  const handleOnChangeEnd = (value: [number, number]) => {
    onChangeEnd(value);
  };

  const handleOnChange = (value: [number, number]) => {
    setValue(value);
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <Text mb="xs">
        Selected time range: {value[0]} - {value[1]}
      </Text>
      <RangeSlider
        label={null}
        value={value}
        onChangeEnd={handleOnChangeEnd}
        onChange={handleOnChange}
        min={0}
        max={24}
        step={1}
        minRange={2}
        // marks={[
        //   { value: 0, label: "12 AM" },
        //   { value: 6, label: "6 AM" },
        //   { value: 12, label: "12 PM" },
        //   { value: 18, label: "6 PM" },
        //   { value: 24, label: "12 AM" },
        // ]}
      />
    </div>
  );
};

export default TimeRangeSlider;
