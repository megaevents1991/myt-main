"use client";

import { useFetchAffiliate } from "@/app/order/hooks";

/**
 * "לוגו השותף על עמוד הנחיתה של הלקוח" - a customer arriving through a
 * partner link sees WHO sent them: the partner's portal logo (+ name) in a
 * quiet strip at the top of the order flow. Renders nothing for organic
 * traffic or partners who never uploaded a logo.
 */
export function PartnerReferralBadge() {
  const { partnerLogoUrl, partnerDisplayName } = useFetchAffiliate();
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
        בשיתוף{partnerDisplayName ? ` ${partnerDisplayName}` : " השותף שלנו"}
      </span>
    </div>
  );
}
