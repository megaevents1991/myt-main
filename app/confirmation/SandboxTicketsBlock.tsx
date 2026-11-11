"use client";

// The tickets block of the confirmation page for a TixStock SANDBOX test order only (TixStock's health check). The
// confirmation page mounts it when the order carries `event_order_info.tixstock_sandbox === true`; a real order's
// page never loads this file and makes no request of it.
//
// It shows the booked listing's ticket type, restrictions and delivery date, and ONE line about the tickets - and
// never says a link was sent when none was. The ticket-page link itself goes by e-mail only.
import { useEffect, useState } from "react";
import { deliveryDay } from "@/lib/tixstock-booking/sandbox-ticket";

type Summary = {
  state: "ordered" | "pending" | "problem";
  ticketType: string;
  restrictions: string[];
  deliveryDate: string | null;
};

const STATE_LINE: Record<Summary["state"], string> = {
  ordered: "קישור לכרטיסים נשלח אליכם במייל",
  pending: "הכרטיסים בהזמנה - קישור יישלח אליכם במייל",
  problem: "נציג שלנו יחזור אליכם לגבי הכרטיסים",
};

const isSummary = (v: unknown): v is Summary => {
  if (v === null || typeof v !== "object") return false;
  const o: Record<string, unknown> = { ...v };
  return (
    (o.state === "ordered" || o.state === "pending" || o.state === "problem") &&
    typeof o.ticketType === "string" &&
    Array.isArray(o.restrictions) &&
    o.restrictions.every((line) => typeof line === "string") &&
    (o.deliveryDate === null || typeof o.deliveryDate === "string")
  );
};

export function SandboxTicketsBlock({ orderId }: { orderId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const res = await fetch(`/api/tixstock/order-summary/${encodeURIComponent(orderId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const body: unknown = await res.json();
        if (!controller.signal.aborted && isSummary(body)) setSummary(body);
      } catch {
        // No block is better than a wrong one: the order's own details stay on the page.
      }
    };
    void load();
    return () => controller.abort();
  }, [orderId]);

  if (!summary) return null;
  const delivery = deliveryDay(summary.deliveryDate);
  return (
    <div className="space-y-3" data-sandbox-tickets={summary.state}>
      {summary.ticketType && (
        <p className="flex flex-wrap gap-x-1">
          <strong>Ticket type:</strong>
          <span dir="ltr">{summary.ticketType}</span>
        </p>
      )}
      {delivery && (
        <p className="flex flex-wrap gap-x-1">
          <strong>Delivery by:</strong>
          <span dir="ltr">{delivery}</span>
        </p>
      )}
      {summary.restrictions.length > 0 && (
        <div>
          <strong>Benefits &amp; restrictions:</strong>
          <ul className="list-disc ps-5" dir="ltr">
            {summary.restrictions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="font-bold" role="status">
        {STATE_LINE[summary.state]}
      </p>
    </div>
  );
}
