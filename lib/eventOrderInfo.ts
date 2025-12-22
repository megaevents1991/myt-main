import type { EventOrderInfo, MultiEventOrderInfo, SingleEventOrderInfo } from "@/lib/app.types";

export function isMultiEventOrderInfo(value: EventOrderInfo): value is MultiEventOrderInfo {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("event1" in value || "event2" in value || "event3" in value)
  );
}

export function getEventOrderInfoList(info: EventOrderInfo): SingleEventOrderInfo[] {
  if (!isMultiEventOrderInfo(info)) return [info];

  const list: SingleEventOrderInfo[] = [];
  if (info.event1) list.push(info.event1);
  if (info.event2) list.push(info.event2);
  if (info.event3) list.push(info.event3);
  return list;
}

export function getPrimaryEventOrderInfo(info: EventOrderInfo): SingleEventOrderInfo {
  return isMultiEventOrderInfo(info) ? info.event1 : info;
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
