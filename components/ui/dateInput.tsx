import React from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar } from "lucide-react";
import { Indicator } from "@mantine/core";

export const DateRange = ({
  dateRange,
  setDateRange,
  eventDay,
}: {
  dateRange: [Date | null, Date | null];
  setDateRange: (value: [Date | null, Date | null]) => void;
  eventDay: string;
}) => {
  return (
    <DatePickerInput
      className="w-full"
      size="md"
      type="range"
      highlightToday
      rightSection={<Calendar />}
      placeholder="Pick dates range"
      value={dateRange}
      valueFormat="DD/MM/YY"
      renderDay={(date) => {
        const day = date.toDateString();
        return (
          <Indicator
            size={6}
            color="red"
            offset={-2}
            disabled={day !== new Date(eventDay).toDateString()}
          >
            <div>{date.getDate()}</div>
          </Indicator>
        );
      }}
      onChange={setDateRange}
      dropdownType="modal"
      styles={{
        input: {
          borderRadius: "var(--radius)",
        },
      }}
    />
  );
};
