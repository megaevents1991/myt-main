import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMaxCards,
  getReservationOrThrow,
  isInProgress,
  isLocked,
  nowIso,
  readSplitState,
  SPLIT_PAYMENT_DEFAULTS,
  splitEvenAgorot,
  sumAgorot,
  type SplitPaymentStateV1,
  writeSplitState,
} from "../utils";

type UpdateAction =
  | { type: "set_amount"; paymentId: string; amount_agorot: number }
  | { type: "split_even" }
  | { type: "add_card" }
  | { type: "remove_card"; paymentId: string }
  | { type: "generate_link"; paymentId: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const action = body.action as UpdateAction;

    if (!orderId || !action?.type) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const reservation = await getReservationOrThrow(orderId);
    const split = readSplitState(reservation.payment_info);
    if (!split) {
      return NextResponse.json(
        { error: "Split payment not initialized" },
        { status: 404 }
      );
    }

    // Block structural edits while an authorization is pending.
    if (
      (action.type === "add_card" ||
        action.type === "remove_card" ||
        action.type === "split_even") &&
      split.cards.some(isInProgress)
    ) {
      return NextResponse.json(
        { error: "Payment authorization in progress" },
        { status: 409 }
      );
    }

    const next: SplitPaymentStateV1 = {
      ...split,
      cards: split.cards.map((c) => ({ ...c })),
    };

    switch (action.type) {
      case "set_amount": {
        const amount = Number(action.amount_agorot);
        if (!Number.isInteger(amount)) {
          return NextResponse.json(
            { error: "Amount must be an integer (agorot)" },
            { status: 400 }
          );
        }

        const card = next.cards.find((c) => c.id === action.paymentId);
        if (!card) {
          return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        if (isLocked(card) || isInProgress(card)) {
          return NextResponse.json(
            { error: "Card amount is locked" },
            { status: 409 }
          );
        }

        if (amount !== 0 && amount < next.min_amount_agorot) {
          return NextResponse.json(
            { error: `Minimum amount is ${next.min_amount_agorot}` },
            { status: 400 }
          );
        }

        card.amount_agorot = amount;
        card.updated_at = nowIso();
        break;
      }

      case "split_even": {
        const editableCards = next.cards.filter((c) => !isLocked(c));
        if (editableCards.length === 0) {
          return NextResponse.json(
            { error: "No editable cards" },
            { status: 409 }
          );
        }

        const lockedSum = sumAgorot(next.cards.filter(isLocked));
        const remaining = next.total_agorot - lockedSum;
        if (remaining < 0) {
          return NextResponse.json(
            { error: "Locked amounts exceed total" },
            { status: 409 }
          );
        }

        const amounts = splitEvenAgorot(remaining, editableCards.length);
        for (let i = 0; i < editableCards.length; i++) {
          if (amounts[i] < next.min_amount_agorot) {
            return NextResponse.json(
              { error: "Split would violate minimum amount" },
              { status: 409 }
            );
          }
          editableCards[i].amount_agorot = amounts[i];
          editableCards[i].updated_at = nowIso();
        }
        break;
      }

      case "add_card": {
        const maxCards = getMaxCards(next);
        if (next.cards.length >= maxCards) {
          return NextResponse.json(
            { error: "Max cards reached" },
            { status: 409 }
          );
        }

        // Split from the last editable card (prefer the last in the list).
        const lastEditableIndex = [...next.cards]
          .map((c, i) => ({ c, i }))
          .reverse()
          .find(({ c }) => !isLocked(c))?.i;

        if (lastEditableIndex === undefined) {
          return NextResponse.json(
            { error: "No editable card to split from" },
            { status: 409 }
          );
        }

        const last = next.cards[lastEditableIndex];
        const a = Math.floor(last.amount_agorot / 2);
        const b = last.amount_agorot - a;

        if (a < next.min_amount_agorot || b < next.min_amount_agorot) {
          return NextResponse.json(
            { error: "Add card would violate minimum amount" },
            { status: 409 }
          );
        }

        last.amount_agorot = a;
        last.updated_at = nowIso();

        next.cards.splice(lastEditableIndex + 1, 0, {
          id: uuidv4(),
          amount_agorot: b,
          status: "not_started",
          updated_at: nowIso(),
        });

        break;
      }

      case "remove_card": {
        if (next.cards.length <= next.min_cards) {
          return NextResponse.json(
            { error: "Cannot remove last card" },
            { status: 409 }
          );
        }

        const index = next.cards.findIndex((c) => c.id === action.paymentId);
        if (index === -1) {
          return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        const card = next.cards[index];
        if (isLocked(card)) {
          return NextResponse.json(
            { error: "Authorized cards cannot be removed" },
            { status: 409 }
          );
        }

        const transferIndex = index > 0 ? index - 1 : 1;
        if (transferIndex < 0 || transferIndex >= next.cards.length) {
          return NextResponse.json(
            { error: "Cannot transfer amount" },
            { status: 409 }
          );
        }

        if (isLocked(next.cards[transferIndex])) {
          return NextResponse.json(
            { error: "Cannot transfer into an authorized card" },
            { status: 409 }
          );
        }

        next.cards[transferIndex].amount_agorot += card.amount_agorot;
        next.cards[transferIndex].updated_at = nowIso();

        next.cards.splice(index, 1);
        break;
      }

      case "generate_link": {
        const card = next.cards.find((c) => c.id === action.paymentId);
        if (!card) {
          return NextResponse.json({ error: "Card not found" }, { status: 404 });
        }

        if (isLocked(card)) {
          return NextResponse.json(
            { error: "Authorized card link not needed" },
            { status: 409 }
          );
        }

        // Always rotate the token.
        card.link_token = uuidv4();
        card.updated_at = nowIso();
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Basic invariant: no negative amounts.
    if (next.cards.some((c) => c.amount_agorot < 0)) {
      return NextResponse.json({ error: "Invalid amounts" }, { status: 400 });
    }

    // Keep total immutable; allow mismatched sums (UI disables payment).
    // But prevent sums wildly different due to removal/transfer bugs.
    const currentSum = sumAgorot(next.cards);
    if (currentSum !== split.total_agorot && action.type !== "set_amount") {
      // structural actions must preserve total
      return NextResponse.json(
        { error: "Internal error: total mismatch" },
        { status: 500 }
      );
    }

    // Also prevent having more than max cards.
    if (next.cards.length > SPLIT_PAYMENT_DEFAULTS.failure_max_cards) {
      return NextResponse.json({ error: "Too many cards" }, { status: 400 });
    }

    await writeSplitState(orderId, reservation.payment_info, next);

    return NextResponse.json({ split: next }, { status: 200 });
  } catch (error) {
    console.error("split-payment update error", error);
    return NextResponse.json(
      { error: "Failed to update split payment" },
      { status: 500 }
    );
  }
}
