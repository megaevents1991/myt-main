import React, { useEffect, useMemo, useRef, useState } from "react";
import { DatePickerInput } from "@mantine/dates";
import { Calendar } from "lucide-react";
import { isMobile } from "react-device-detect";
import { useClickOutside, useMediaQuery } from "@mantine/hooks";
import { Tooltip } from "@mantine/core";

function normalizeDayKey(input: string): string | null {
  // Prefer an ISO YYYY-MM-DD when available (stable across timezones)
  const isoAnywhere = input.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoAnywhere) return isoAnywhere;

  // Common site format: DD/MM/YY or DD/MM/YYYY
  const dmy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const rawYear = dmy[3];
    const yyyy = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(input);
  if (dt.toString() === "Invalid Date") return null;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateToDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const DateRange = ({
  dateRange,
  setDateRange,
  eventDay,
  highlightDays,
  onPopoverClose,
  disabled,
  showTooltip = false,
  tooltipText = "רוצים לטוס בתאריכים אחרים? בחרו כאן",
}: {
  dateRange: [Date | null, Date | null];
  setDateRange: (value: [Date | null, Date | null]) => void;
  eventDay?: string;
  highlightDays?: string[];
  onPopoverClose: () => void;
  disabled: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
}) => {
  const matches = useMediaQuery("(min-width: 1024px)");
  const [tooltipOpened, setTooltipOpened] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);
  const ref = useClickOutside(() => setTooltipOpened(false));

  const highlightSet = useMemo(() => {
    const candidates =
      highlightDays && highlightDays.length > 0
        ? highlightDays
        : eventDay
          ? [eventDay]
          : [];

    const set = new Set<string>();
    for (const d of candidates) {
      const key = normalizeDayKey(d);
      if (key) set.add(key);
    }
    return set;
  }, [eventDay, highlightDays?.join("|")]);

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
        const dayKey = dateToDayKey(date);

        if (!highlightSet.has(dayKey)) {
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
      onChange={(value) => {
        const [start, end] = value;
        if (start && end && start.getTime() > end.getTime()) {
          setDateRange([end, start]);
          return;
        }
        setDateRange(value);
      }}
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
