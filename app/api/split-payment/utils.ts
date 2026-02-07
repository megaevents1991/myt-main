import { supabase } from "@/lib/supabase";
import type { OrderData } from "@/lib/app.types";
import { v4 as uuidv4 } from "uuid";

export type SplitPaymentStatus =
  | "not_started"
  | "pending"
  | "authorized"
  | "failed";

export type SplitPaymentCard = {
  id: string;
  amount_agorot: number;
  status: SplitPaymentStatus;
  tx_id?: string;
  link_token?: string;
  last_error?: string;
  updated_at: string;
  gateway_response?: unknown;
};

export type SplitPaymentStateV1 = {
  version: 1;
  mode: "split";
  currency: "ILS";
  total_agorot: number;
  min_amount_agorot: number;
  min_cards: number;
  base_max_cards: number;
  failure_max_cards: number;
  promo_code: string;
  cards: SplitPaymentCard[];
};

export const SPLIT_PAYMENT_DEFAULTS = {
  currency: "ILS" as const,
  min_amount_agorot: 100 * 100,
  min_cards: 1,
  base_max_cards: 4,
  failure_max_cards: 5,
};

export function nowIso() {
  return new Date().toISOString();
}

export function toAgorot(amountIls: number) {
  return Math.round(amountIls * 100);
}

export function assertPositiveInt(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

export function splitEvenAgorot(totalAgorot: number, n: number): number[] {
  assertPositiveInt(totalAgorot, "totalAgorot");
  if (!Number.isInteger(n) || n <= 0) throw new Error("n must be > 0");

  const base = Math.floor(totalAgorot / n);
  const remainder = totalAgorot - base * n;
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] += remainder;
  return amounts;
}

export function getMaxCards(state: SplitPaymentStateV1): number {
  const hasFailure = state.cards.some((c) => c.status === "failed");
  return hasFailure ? state.failure_max_cards : state.base_max_cards;
}

export function sumAgorot(cards: { amount_agorot: number }[]) {
  return cards.reduce((sum, c) => sum + c.amount_agorot, 0);
}

export function isLocked(card: SplitPaymentCard) {
  return card.status === "authorized";
}

export function isInProgress(card: SplitPaymentCard) {
  return card.status === "pending";
}

export async function getReservationOrThrow(orderId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", orderId)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("Reservation not found");
  }

  return data as OrderData & {
    id: number;
    payment_info: unknown;
    status: string;
  };
}

export function readSplitState(paymentInfo: unknown): SplitPaymentStateV1 | null {
  if (!paymentInfo || typeof paymentInfo !== "object") return null;
  const maybe = paymentInfo as { split_payment?: unknown };
  const state = maybe.split_payment;
  if (!state || typeof state !== "object") return null;

  const typed = state as Partial<SplitPaymentStateV1>;
  if (typed.version !== 1 || typed.mode !== "split") return null;
  return typed as SplitPaymentStateV1;
}

export async function writeSplitState(
  orderId: string,
  paymentInfo: unknown,
  state: SplitPaymentStateV1
) {
  const nextPaymentInfo = {
    ...(paymentInfo && typeof paymentInfo === "object" ? (paymentInfo as object) : {}),
    split_payment: state,
  };

  const { error } = await supabase
    .from("reservations")
    .update({ payment_info: nextPaymentInfo })
    .eq("id", orderId);

  if (error) throw new Error("Failed to persist split payment state");

  return nextPaymentInfo;
}

export function createInitialSplitState(params: {
  totalAgorot: number;
  promoCode: string;
}): SplitPaymentStateV1 {
  const { totalAgorot, promoCode } = params;
  assertPositiveInt(totalAgorot, "totalAgorot");

  const [a0, a1] = splitEvenAgorot(totalAgorot, 2);

  return {
    version: 1,
    mode: "split",
    currency: SPLIT_PAYMENT_DEFAULTS.currency,
    total_agorot: totalAgorot,
    min_amount_agorot: SPLIT_PAYMENT_DEFAULTS.min_amount_agorot,
    min_cards: SPLIT_PAYMENT_DEFAULTS.min_cards,
    base_max_cards: SPLIT_PAYMENT_DEFAULTS.base_max_cards,
    failure_max_cards: SPLIT_PAYMENT_DEFAULTS.failure_max_cards,
    promo_code: promoCode,
    cards: [
      {
        id: uuidv4(),
        amount_agorot: a0,
        status: "not_started",
        updated_at: nowIso(),
      },
      {
        id: uuidv4(),
        amount_agorot: a1,
        status: "not_started",
        updated_at: nowIso(),
      },
    ],
  };
}
