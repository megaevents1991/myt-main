"use client";

import { useEffect, useState } from "react";
import { useFetchAffiliate } from "@/app/order/hooks";

/**
 * "לוגו השותף על עמוד הנחיתה של הלקוח" - a customer arriving through a
 * partner link sees WHO sent them: the partner's portal logo (+ name) in a
 * quiet strip at the top of the order flow. Renders nothing for organic
 * traffic or partners who never uploaded a logo.
 *
 * Hidden for a connected AGENT (doc 2026-08-30, item 9): the agent booking on
 * a customer's behalf was seeing both "סוכן · אלון" and "בשיתוף אלון" at once
 * - "מבולבל אם אני סוכן או משתמש". The agent chip is the truthful one there;
 * "בשיתוף" is the customer-facing framing and belongs to the customer's own
 * visit.
 */
export function PartnerReferralBadge() {
  const { partnerLogoUrl, partnerDisplayName, affType } = useFetchAffiliate();
  const [agentConnected, setAgentConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner-session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.connected && data.role === "agent") {
          setAgentConnected(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (agentConnected) return null;
  if (!partnerLogoUrl) return null;

  return (
    <div
      dir="rtl"
      className="mx-auto mb-2 flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={partnerLogoUrl}
        alt={partnerDisplayName ?? "לוגו השותף"}
        className="h-7 w-7 rounded-full border border-gray-100 object-contain"
      />
      <span className="text-xs text-gray-600">
        {/* An AGENT is handling this booking for the customer, so say so by
            name (backoffice doc 2026-08-30, item 5); an influencer only sent
            them here, which stays "בשיתוף". */}
        {affType === "agent"
          ? `ההזמנה מבוצעת ע"י${
              partnerDisplayName ? ` ${partnerDisplayName}` : " סוכן הנסיעות שלך"
            }`
          : `בשיתוף${partnerDisplayName ? ` ${partnerDisplayName}` : " השותף שלנו"}`}
      </span>
    </div>
  );
}
