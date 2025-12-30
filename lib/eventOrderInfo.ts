import type { EventOrderInfo, MultiEventOrderInfo, SingleEventOrderInfo } from "@/lib/app.types";

export function isMultiEventOrderInfo(value: EventOrderInfo): value is MultiEventOrderInfo {
  return Boolean(value && typeof value === "object" && "events" in value);
}

export function getEventOrderInfoList(info: EventOrderInfo): SingleEventOrderInfo[] {
  return isMultiEventOrderInfo(info) ? info.events : [info];
}

export function getPrimaryEventOrderInfo(info: EventOrderInfo): SingleEventOrderInfo {
  return isMultiEventOrderInfo(info) ? info.events[0] : info;
}

export function getEventOrderIds(info: EventOrderInfo): number[] {
  return getEventOrderInfoList(info)
    .map((e) => e?.event_id)
    .filter((id): id is number => typeof id === "number" && !Number.isNaN(id));
}

export function getEventOrderNameSummary(info: EventOrderInfo): string {
  const events = getEventOrderInfoList(info);
  if (events.length <= 1) return events[0]?.name || "";
  const firstName = events[0]?.name || "";
  return `${firstName} +${events.length - 1}`;
}
