import { exchangeRateService } from "@/lib/exchangeRateService";

/**
 * Supplier cost → the USD ticket price we sell at. ONE formula for every live
 * supplier, so two suppliers offering the same zone compete on their real cost
 * and not on which code path priced them:
 *
 *   (cost + fixed per-currency markup) → USD → +3.5% → rounded up
 *
 * The per-currency markups are the platform's ticket markups (USD +40 /
 * EUR +40 / GBP +35 / ILS +150) - the same ones the backoffice syncs apply.
 * Callers must `await exchangeRateService.ensureFresh()` first: rates are read
 * synchronously here.
 */
const CARD_FEE_MULTIPLIER = 1.035;

export const SUPPLIER_CURRENCY_MARKUP = {
  USD: 40,
  EUR: 40,
  GBP: 35,
  ILS: 150,
} as const;

export type SupplierCurrency = keyof typeof SUPPLIER_CURRENCY_MARKUP;

export const isSupplierCurrency = (value: string): value is SupplierCurrency =>
  value in SUPPLIER_CURRENCY_MARKUP;

/** USD per one unit of `currency`, from the live exchange-rate service. */
function usdPerUnit(currency: SupplierCurrency): number {
  switch (currency) {
    case "USD":
      return 1;
    case "EUR":
      return exchangeRateService.getEurUsdRate().rate;
    case "GBP":
      return exchangeRateService.getGbpUsdRate().rate;
    case "ILS":
      // The service holds ILS per USD.
      return 1 / exchangeRateService.getUsdIlsRate().rate;
  }
}

/**
 * Unrounded selling price in USD, or null for a currency we don't price
 * (caller decides what to do - never guess a rate).
 */
export function supplierCostToUsd(
  cost: number,
  currency: string,
): number | null {
  const code = currency.toUpperCase();
  if (!Number.isFinite(cost) || !isSupplierCurrency(code)) return null;
  const rate = usdPerUnit(code);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return (cost + SUPPLIER_CURRENCY_MARKUP[code]) * rate * CARD_FEE_MULTIPLIER;
}
