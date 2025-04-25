import React, { useEffect, useState, useRef } from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar } from "lucide-react";
import { isMobile } from "react-device-detect";
import { useMediaQuery } from "@mantine/hooks";
import { Tooltip } from "@mantine/core";

export const DateRange = ({
  dateRange,
  setDateRange,
  eventDay,
  onPopoverClose,
  disabled,
  showTooltip = false,
  tooltipText = "אתם מוזמנים לבחור תאריך לפי העדפתכם",
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
  const [userInteracted, setUserInteracted] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showTooltip && !userInteracted) {
      const timer = setTimeout(() => {
        setTooltipOpened(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTooltip, userInteracted]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        componentRef.current &&
        (componentRef.current.contains(event.target as Node) ||
          (event.target as HTMLElement).closest(".mantine-Tooltip-root"))
      ) {
        setUserInteracted(true);
        setTooltipOpened(false);
      }
    };

    if (tooltipOpened) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [tooltipOpened]);

  const datePickerInput = (
    <div ref={componentRef} className="w-full relative">
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
    </div>
  );

  return showTooltip ? (
    <Tooltip
      label={tooltipText}
      opened={tooltipOpened}
      position="top"
      withArrow
      color="blue"
      zIndex={1000}
      offset={10}
      withinPortal={false}
    >
      {datePickerInput}
    </Tooltip>
  ) : (
    datePickerInput
  );
};
