import { Flight } from "@/lib/app.types";

export const TIMEOUT = 15 * 60; // 15 minutes

export const formatPhoneNumber = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  let formatted = cleaned;

  if (cleaned.length >= 3) {
    formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  if (cleaned.length >= 6) {
    formatted = `${formatted.slice(0, 7)}-${formatted.slice(7)}`;
  }

  return formatted.slice(0, 12); // Limit length
};

export const getPenText = (selectedFlight: Flight | undefined) => {
  if (!selectedFlight?.penalties) return "";

  return (
    selectedFlight.penalties
      .replace(/PE\.PENALTIES\s*\n/, "")
      .replace(
        /CANCELLATIONS\s*\n/,
        '<h3 class="font-bold mt-4 mb-2">Cancellation Policy</h3>',
      )
      .replace(
        /CHANGES\s*\n/,
        '<h3 class="font-bold mt-4 mb-2">Change Policy</h3>',
      )
      .replace(/NOTE -/g, "<strong>Note:</strong>")
      .replace(/--+/g, '<hr class="my-2">')
      // Convert newlines to paragraphs
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<p class="mb-2">${line}</p>`)
      .join("")
  );
};

export const getPrices = ({
  finalPurchasePrice,
  recommendedPriceAllPax,
  agentCommission,
  isAgent,
  isNumberOfPersonsEqual,
  numberOfPersons,
  finalPurchasePriceILS,
  perPersonAddOnsUsd = 0,
}: {
  finalPurchasePrice: number;
  recommendedPriceAllPax: number;
  agentCommission: number;
  /** True for ANY signed agent code - commission may legitimately be 0, so
   *  `agentCommission > 0` alone under-detects (kept as fallback default). */
  isAgent?: boolean;
  isNumberOfPersonsEqual: boolean;
  numberOfPersons: number;
  finalPurchasePriceILS: number;
  /** Booking-level add-ons (added bags) excluded from the "(לאדם)" figure -
   *  one $47 bag used to show as +$24 per person because it split across the
   *  travelers (Dor 23.8: "זו רק התצוגה לאדם"). The TOTAL still includes it. */
  perPersonAddOnsUsd?: number;
}) => {
  const agentViewer = isAgent ?? agentCommission > 0;
  // The strikethrough "recommended price" framing is retail-customer-only -
  // agents (any commission, including 0) never see it.
  const originalNoDiscount =
    !agentViewer &&
    isNumberOfPersonsEqual &&
    recommendedPriceAllPax > finalPurchasePrice
      ? recommendedPriceAllPax
      : null;

  const pricePerPerson = Math.ceil(
    Math.max(0, finalPurchasePrice - perPersonAddOnsUsd) / numberOfPersons,
  );

  return {
    originalNoDiscount: originalNoDiscount
      ? originalNoDiscount.toLocaleString("en-US")
      : null,
    pricePerPerson: pricePerPerson.toLocaleString("en-US"),
    finalPurchasePrice: finalPurchasePrice.toLocaleString("en-US"),
    finalPurchasePriceILS: finalPurchasePriceILS.toLocaleString("en-US"),
  };
};
