import React from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar } from "lucide-react";
import { Indicator } from "@mantine/core";
import { isMobile } from "react-device-detect";

// Alterntive in case needed: https://codesandbox.io/p/sandbox/material-ui-rtl-date-range-picker-ojf0d?file=%2Fsrc%2FApp.js%3A12%2C49

export const DateRange = ({
  dateRange,
  setDateRange,
  eventDay,
}: {
  dateRange: [Date | null, Date | null];
  setDateRange: (value: [Date | null, Date | null]) => void;
  eventDay: string;
}) => {
  const inputRef = React.useRef<HTMLButtonElement>(null);
  return (
    <DatePickerInput
      ref={inputRef}
      className="w-full"
      size="md"
      type="range"
      highlightToday
      rightSection={
        <Calendar
          className="cursor-pointer	"
          onClick={() => inputRef.current?.click()}
        />
      }
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
      dropdownType={isMobile ? "modal" : "popover"}
      styles={{
        month: {
          direction: "rtl",
        },
        input: {
          borderBottomRightRadius: "var(--radius)",
          borderTopRightRadius: "var(--radius)",
          borderBottomLeftRadius: "0",
          borderTopLeftRadius: "0",
        },
      }}
    />
  );
};
