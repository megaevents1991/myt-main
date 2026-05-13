import type { Event } from "@/lib/app.types";

export const MONDIAL2026_EVENT_NAME_PREFIX = "מונדיאל 2026";
export const MONDIAL2026_ORDER_ORIGIN = "https://mondial2026.mega-events.co.il";
export const MONDIAL2026_HOST = "mondial2026.mega-events.co.il";

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

export function isMondial2026Event(event: Pick<Event, "name"> | undefined) {
  return (
    event?.name?.trimStart().startsWith(MONDIAL2026_EVENT_NAME_PREFIX) ?? false
  );
}

export function isMondial2026Host(host: string | null) {
  return host?.split(":")[0]?.toLowerCase() === MONDIAL2026_HOST;
}

export function getMondial2026OrderUrl(
  eventId: string,
  searchParams?: SearchParams,
) {
  const target = new URL(
    `/order/${encodeURIComponent(eventId)}`,
    MONDIAL2026_ORDER_ORIGIN,
  );

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined) return;

      if (Array.isArray(value)) {
        value.forEach((item) => target.searchParams.append(key, item));
        return;
      }

      target.searchParams.set(key, value);
    });
  }

  return target.toString();
}
