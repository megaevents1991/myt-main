/**
 * Timezone-agnostic date utilities for travel application
 * 
 * PRINCIPLE: All dates are treated as LOCAL times at their respective locations.
 * - Event dates: Local time in event location (usually Israel)
 * - Flight times: Local time at departure/arrival airport
 * - User's timezone is IGNORED for all date calculations
 * 
 * This ensures consistent behavior regardless of where the user opens the website.
 */

/**
 * Parse a date string (YYYY-MM-DD) as a local date, ignoring timezone
 * This prevents timezone conversion that would shift dates by ±1 day
 * 
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2025-05-15")
 * @returns Date object representing midnight in LOCAL timezone of the date
 * 
 * @example
 * parseLocalDate("2025-05-15") // Always May 15, regardless of user timezone
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) {
    throw new Error("Date string is required");
  }

  // Split the date string and create Date using local timezone
  const [year, month, day] = dateString.split('-').map(Number);
  
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }

  // Create date in local timezone (not UTC)
  // month is 0-indexed in JavaScript Date
  return new Date(year, month - 1, day);
}

/**
 * Parse a datetime string (ISO 8601) as local time, ignoring the timezone info
 * Used for flight times which are always in local airport time
 * 
 * @param dateTimeString - ISO 8601 datetime string
 * @returns Date object in user's local timezone, but representing the time at the location
 * 
 * @example
 * parseLocalDateTime("2025-05-15T15:00:00Z") // 15:00 local time
 */
export function parseLocalDateTime(dateTimeString: string): Date {
  if (!dateTimeString) {
    throw new Error("DateTime string is required");
  }

  // Parse the datetime components, ignoring timezone
  const date = new Date(dateTimeString);
  
  // Extract components from the ISO string
  const match = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  
  if (!match) {
    // Fallback: just return the parsed date
    return date;
  }

  const [, year, month, day, hours, minutes, seconds] = match.map(Number);
  
  // Create date with local timezone interpretation
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/**
 * Format a Date object to YYYY-MM-DD string (date only, no time)
 * Always uses local date components to avoid timezone shifts
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 * 
 * @example
 * formatLocalDate(new Date(2025, 4, 15)) // "2025-05-15"
 */
export function formatLocalDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Valid Date object is required");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to DD/MM/YYYY string for display
 * 
 * @param date - Date object
 * @returns Date string in DD/MM/YYYY format
 * 
 * @example
 * formatDisplayDate(new Date(2025, 4, 15)) // "15/05/2025"
 */
export function formatDisplayDate(date: Date): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error("Valid Date object is required");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${day}/${month}/${year}`;
}

/**
 * Compare two dates by their date components only (ignoring time)
 * Returns true if they represent the same calendar day
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if same calendar day
 * 
 * @example
 * isSameDay(new Date(2025, 4, 15, 10, 0), new Date(2025, 4, 15, 18, 0)) // true
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Compare two date strings in YYYY-MM-DD format
 * 
 * @param dateString1 - First date string
 * @param dateString2 - Second date string
 * @returns true if same date
 */
export function isSameDateString(dateString1: string, dateString2: string): boolean {
  return dateString1 === dateString2;
}

/**
 * Get the hour component from a datetime string representing local time
 * Used for flight arrival/departure times
 * 
 * @param dateTimeString - ISO datetime string
 * @returns Hour (0-23) at the local location
 * 
 * @example
 * getLocalHour("2025-05-15T15:30:00Z") // 15 (3 PM local time)
 */
export function getLocalHour(dateTimeString: string): number {
  const match = dateTimeString.match(/T(\d{2}):/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Fallback: parse as date and get hours
  const date = parseLocalDateTime(dateTimeString);
  return date.getHours();
}

/**
 * Create a date range tuple for display
 * Ensures both dates are properly formatted
 * 
 * @param startDate - Start date string (YYYY-MM-DD)
 * @param endDate - End date string (YYYY-MM-DD)
 * @returns Tuple of Date objects
 */
export function createDateRange(
  startDate: string,
  endDate: string
): [Date, Date] {
  return [parseLocalDate(startDate), parseLocalDate(endDate)];
}

/**
 * Format date range for API transmission
 * 
 * @param dateRange - Tuple of Date objects
 * @returns Object with formatted date strings
 */
export function formatDateRangeForAPI(
  dateRange: [Date | null, Date | null]
): { departureDate: string; returnDate: string } | null {
  if (!dateRange[0] || !dateRange[1]) {
    return null;
  }
  
  return {
    departureDate: formatLocalDate(dateRange[0]),
    returnDate: formatLocalDate(dateRange[1]),
  };
}
