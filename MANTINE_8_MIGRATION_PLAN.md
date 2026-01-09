# Mantine 8.x Date Migration Plan

## Overview

Mantine 8 changes date components to use **string format** (`YYYY-MM-DD`) instead of `Date` objects. This affects 7 files in your codebase.

---

## Files to Modify

### 1. [components/ui/dateInput.tsx](components/ui/dateInput.tsx) - DateRange Component

**Current (lines 17-18):**
```tsx
dateRange: [Date | null, Date | null];
setDateRange: (value: [Date | null, Date | null]) => void;
```

**Change to:**
```tsx
dateRange: [string | null, string | null];
setDateRange: (value: [string | null, string | null]) => void;
```

**Current `renderDay` (lines 59-77):**
```tsx
renderDay={(date) => {
  const day = date.toDateString();
  if (day !== new Date(eventDay).toDateString()) {
    return <div>{date.getDate()}</div>;
  }
  // ...
}}
```

**Change to:**
```tsx
renderDay={(date) => {
  // In Mantine 8, date is already a string 'YYYY-MM-DD'
  if (date !== eventDay) {
    const dayNum = new Date(date).getDate();
    return <div>{dayNum}</div>;
  }
  const dayNum = new Date(date).getDate();
  return (
    <div style={{ padding: 5, borderRadius: "50%", outline: "2px solid red" }}>
      {dayNum}
    </div>
  );
}}
```

> **Note:** Verify `renderDay` callback signature in Mantine 8 docs - it may still receive a Date object for display purposes while `value`/`onChange` use strings.

---

### 2. [app/order/OrderPageClient.tsx](app/order/OrderPageClient.tsx) - DatesProvider

**Current (lines 82-89):**
```tsx
<DatesProvider
  settings={{
    locale: "he",
    firstDayOfWeek: 0,
    weekendDays: [6],
    timezone: "Israel",  // ❌ REMOVED in Mantine 8
  }}
>
```

**Change to:**
```tsx
<DatesProvider
  settings={{
    locale: "he",
    firstDayOfWeek: 0,
    weekendDays: [6],
    // timezone option removed - handle timezone with dayjs if needed
  }}
>
```

**Impact:** Timezone handling must now be done externally using `dayjs` (which you already have installed).

---

### 3. [app/order/FlightSelection.tsx](app/order/FlightSelection.tsx)

**State declaration (lines 84-87):**
```tsx
// Current
const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
  new Date(event.def_date_depart),
  new Date(event.def_date_return),
]);

// Change to
const [dateRange, setDateRange] = useState<[string | null, string | null]>([
  dayjs(event.def_date_depart).format("YYYY-MM-DD"),
  dayjs(event.def_date_return).format("YYYY-MM-DD"),
]);
```

**Debug state (lines 92-95):**
```tsx
// Current
const [debug, setDebug] = useState<{
  departureDate: Date;
  returnDate: Date;
}>({ departureDate: new Date(), returnDate: new Date() });

// Change to
const [debug, setDebug] = useState<{
  departureDate: string;
  returnDate: string;
}>({ departureDate: "", returnDate: "" });
```

**API call (lines 181-182):**
```tsx
// Current
departureDate: dateRange[0]?.toDateString(),
returnDate: dateRange[1]?.toDateString(),

// Change to (already strings, just pass them)
departureDate: dateRange[0],
returnDate: dateRange[1],
```

**Debug setter (lines 215-218):**
```tsx
// Current
setDebug({
  departureDate: new Date(debug.departureDate),
  returnDate: new Date(debug.returnDate),
});

// Change to
setDebug({
  departureDate: debug.departureDate,
  returnDate: debug.returnDate,
});
```

**handleDatePopoverClose (lines 383-401):**
```tsx
// Current
const handleDatePopoverClose = () => {
  if (!dateRange[0] || !dateRange[1]) {
    const defaultDates: [Date, Date] = [
      new Date(event.def_date_depart),
      new Date(event.def_date_return),
    ];
    setDateRange(defaultDates);
    return;
  }

  if (
    dayjs(dateRange[0]).isSame(dayjs(debug.departureDate), "day") &&
    dayjs(dateRange[1]).isSame(dayjs(debug.returnDate), "day")
  ) {
    return;
  }

  fetchFlights();
};

// Change to
const handleDatePopoverClose = () => {
  if (!dateRange[0] || !dateRange[1]) {
    const defaultDates: [string, string] = [
      dayjs(event.def_date_depart).format("YYYY-MM-DD"),
      dayjs(event.def_date_return).format("YYYY-MM-DD"),
    ];
    setDateRange(defaultDates);
    return;
  }

  if (dateRange[0] === debug.departureDate && dateRange[1] === debug.returnDate) {
    return;
  }

  fetchFlights();
};
```

---

### 4. [app/order/HotelSelection.tsx](app/order/HotelSelection.tsx)

**State declarations (lines 51-53, 87-89):**
```tsx
// Current
const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(
  getDefaultDateRange(event, flight)
);
const [prevDateRange, setPrevDateRange] = useState<[Date | null, Date | null]>(
  getDefaultDateRange(event, flight)
);

// Change to
const [dateRange, setDateRange] = useState<[string | null, string | null]>(
  getDefaultDateRangeString(event, flight)
);
const [prevDateRange, setPrevDateRange] = useState<[string | null, string | null]>(
  getDefaultDateRangeString(event, flight)
);
```

**handleDatePopoverClose (lines 364-386):**
```tsx
// Current - uses .getTime() for comparison
const datesChanged =
  !prevDateRange[0] ||
  !prevDateRange[1] ||
  prevDateRange[0].getTime() !== dateRange[0].getTime() ||
  prevDateRange[1].getTime() !== dateRange[1].getTime();

// Change to - simple string comparison
const datesChanged =
  !prevDateRange[0] ||
  !prevDateRange[1] ||
  prevDateRange[0] !== dateRange[0] ||
  prevDateRange[1] !== dateRange[1];
```

---

### 5. [lib/getDefaultDateRange.ts](lib/getDefaultDateRange.ts)

**Option A: Keep Date return type, add new string function**

```tsx
// Keep existing function for internal Date usage
export const getDefaultDateRange = (
  event: Event,
  flight?: Flight
): [Date, Date] => {
  // ... existing code
};

// Add new function for Mantine 8 components
export const getDefaultDateRangeString = (
  event: Event,
  flight?: Flight
): [string, string] => {
  const [start, end] = getDefaultDateRange(event, flight);
  return [
    dayjs(start).format("YYYY-MM-DD"),
    dayjs(end).format("YYYY-MM-DD"),
  ];
};
```

**Option B: Change return type to strings throughout**

If you prefer to fully migrate to strings, change the return type and update all callers.

---

### 6. [app/order/fetchHotels.ts](app/order/fetchHotels.ts)

**Type definition (lines 5-13):**
```tsx
// Current
export type FetchHotelsParams = {
  dateRange: [Date | null, Date | null];
  // ...
};

// Change to
export type FetchHotelsParams = {
  dateRange: [string | null, string | null];
  // ...
};
```

**API call formatting (lines 36-37):**
```tsx
// Current - converts Date to string
checkin: dayjs(dateRange[0]?.toDateString()).format("YYYY-MM-DD"),
checkout: dayjs(dateRange[1]?.toDateString()).format("YYYY-MM-DD"),

// Change to - already a string
checkin: dateRange[0] || "",
checkout: dateRange[1] || "",
```

---

### 7. [app/hooks/HotelFetch.provider.tsx](app/hooks/HotelFetch.provider.tsx) (if applicable)

Check if `getHotels` function signature uses Date types and update accordingly.

---

## Migration Checklist

- [ ] Update `@mantine/dates` to ^8.x
- [ ] Remove `timezone` from DatesProvider settings
- [ ] Update DateRange component props to use `string` instead of `Date`
- [ ] Update FlightSelection.tsx state and handlers
- [ ] Update HotelSelection.tsx state and handlers
- [ ] Add `getDefaultDateRangeString` helper (or refactor existing)
- [ ] Update fetchHotels.ts types and formatting
- [ ] Verify `renderDay` callback signature in Mantine 8 docs
- [ ] Test date picker functionality with Hebrew locale
- [ ] Test date range selection and API calls

---

## Helper: Date Conversion Utilities

If needed, add these utilities to your codebase:

```tsx
// lib/dateUtils.ts
import dayjs from "dayjs";

// Convert Date to Mantine 8 string format
export const toDateString = (date: Date | null): string | null => {
  return date ? dayjs(date).format("YYYY-MM-DD") : null;
};

// Convert Mantine 8 string to Date
export const toDate = (dateStr: string | null): Date | null => {
  return dateStr ? new Date(dateStr) : null;
};

// Convert date range
export const toDateRangeString = (
  range: [Date | null, Date | null]
): [string | null, string | null] => {
  return [toDateString(range[0]), toDateString(range[1])];
};
```

---

## Timezone Handling (Post-Migration)

Since `DatesProvider.timezone` is removed, handle timezones using dayjs:

```tsx
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// Convert to Israel timezone
const israelDate = dayjs(dateString).tz("Asia/Jerusalem").format("YYYY-MM-DD");
```
