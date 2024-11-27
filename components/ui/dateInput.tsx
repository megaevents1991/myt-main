import React from "react";
import { DatePickerInput } from "@mantine/dates";

export const DateRange = ({
  dateRange,
  setDateRange,
}: {
  dateRange: [Date | null, Date | null];
  setDateRange: (value: [Date | null, Date | null]) => void;
}) => {
  return (
    <DatePickerInput
      type="range"
      label="Pick dates range"
      placeholder="Pick dates range"
      value={dateRange}
      onChange={setDateRange}
    />
  );
};
