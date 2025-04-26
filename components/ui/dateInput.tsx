import React, { useEffect, useRef, useState } from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar } from "lucide-react";
import { isMobile } from "react-device-detect";
import { useClickOutside, useMediaQuery } from "@mantine/hooks";
import { Tooltip } from "@mantine/core";

export const DateRange = ({
  dateRange,
  setDateRange,
  eventDay,
  onPopoverClose,
  disabled,
  showTooltip = false,
  tooltipText = "רוצים תאריכים אחרים? בחרו כאן",
}: {
  dateRange: [Date | null, Date | null];
  setDateRange: (value: [Date | null, Date | null]) => void;
  eventDay: string;
  onPopoverClose: () => void;
  disabled: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
}) => {
  const matches = useMediaQuery("(min-width: 1024px)");
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);
  const ref = useClickOutside(() => setTooltipOpened(false));

  useEffect(() => {
    setTimeout(() => {
      setTooltipOpened(true);
    }, 100);
  }, []);

  const datePickerInput = (
    <DatePickerInput
      disabled={disabled}
      ref={inputRef}
      className="w-full"
      size="md"
      type="range"
      highlightToday
      rightSection={
        matches ? (
          <Calendar
            className="cursor-pointer"
            onClick={() => inputRef.current?.click()}
          />
        ) : undefined
      }
      popoverProps={{
        onClose: onPopoverClose,
        keepMounted: true,
      }}
      placeholder="Pick dates range"
      value={dateRange}
      valueFormat="DD/MM/YY"
      renderDay={(date) => {
        const day = date.toDateString();

        if (day !== new Date(eventDay).toDateString()) {
          return <div>{date.getDate()}</div>;
        }

        return (
          <div
            style={{
              padding: 5,
              borderRadius: "50%",
              outline: "2px solid red",
            }}
          >
            {date.getDate()}
          </div>
        );
      }}
      onChange={setDateRange}
      dropdownType={isMobile ? "modal" : "popover"}
      styles={{
        month: {
          direction: "rtl",
        },
        input: {
          whiteSpace: "nowrap",
          borderBottomRightRadius: "var(--radius)",
          borderTopRightRadius: "var(--radius)",
          borderBottomLeftRadius: "0",
          borderTopLeftRadius: "0",
        },
      }}
    />
  );

  return showTooltip ? (
    <Tooltip
      label={tooltipText}
      opened={tooltipOpened}
      position="top"
      withArrow
      color="black"
    >
      <div>
        {datePickerInput}
        <span ref={ref} />
      </div>
    </Tooltip>
  ) : (
    datePickerInput
  );
};
