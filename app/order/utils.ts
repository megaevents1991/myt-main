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

export const getPenText = (selectedFlight: Flight) => {
  if (!selectedFlight.penalties) return "";

  return (
    selectedFlight.penalties
      .replace(/PE\.PENALTIES\s*\n/, "")
      .replace(
        /CANCELLATIONS\s*\n/,
        '<h3 class="font-bold mt-4 mb-2">Cancellation Policy</h3>'
      )
      .replace(
        /CHANGES\s*\n/,
        '<h3 class="font-bold mt-4 mb-2">Change Policy</h3>'
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
  isNumberOfPersonsEqual,
  numberOfPersons,
  finalPurchasePriceILS,
}: {
  finalPurchasePrice: number;
  recommendedPriceAllPax: number;
  agentCommission: number;
  isNumberOfPersonsEqual: boolean;
  numberOfPersons: number;
  finalPurchasePriceILS: number;
}) => {
  const originalNoDiscount =
    agentCommission <= 0 &&
    isNumberOfPersonsEqual &&
    recommendedPriceAllPax > finalPurchasePrice
      ? recommendedPriceAllPax
      : 0;

  const pricePerPerson = Math.ceil(finalPurchasePrice / numberOfPersons);

  return {
    originalNoDiscount: originalNoDiscount.toLocaleString("en-US"),
    pricePerPerson: pricePerPerson.toLocaleString("en-US"),
    finalPurchasePrice: finalPurchasePrice.toLocaleString("en-US"),
    finalPurchasePriceILS: finalPurchasePriceILS.toLocaleString("en-US"),
  };
};
