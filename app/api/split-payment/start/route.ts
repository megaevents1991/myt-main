import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { convert } from "xmlbuilder2";
import {
  getReservationOrThrow,
  getMaxCards,
  isInProgress,
  isLocked,
  nowIso,
  readSplitState,
  sumAgorot,
  writeSplitState,
} from "../utils";
import { buildDoDealXML } from "@/app/api/payment/buildDoDealXML";

const url = process.env.NEXT_SECRET_CG_GATEWAY_URL || "";
const terminalNumber = process.env.NEXT_SECRET_CG_TERMINAL || "";
const userName = process.env.NEXT_SECRET_CG_USER_NAME || "";
const password = process.env.NEXT_SECRET_CG_PASSWORD || "";
const mid = process.env.NEXT_SECRET_CG_MID || "";
const returnUrl = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === "production"
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `https://${process.env.VERCEL_BRANCH_URL}`
  : process.env.NEXT_PUBLIC_API_URL;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const paymentId = String(body.paymentId || "");
    const token = body.token ? String(body.token) : undefined;

    if (!orderId || !paymentId) {
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

    const card = split.cards.find((c) => c.id === paymentId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (token && card.link_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    if (isLocked(card)) {
      return NextResponse.json({ error: "Already authorized" }, { status: 409 });
    }

    if (split.cards.some(isInProgress)) {
      return NextResponse.json(
        { error: "Only one authorization at a time" },
        { status: 409 }
      );
    }

    const maxCards = getMaxCards(split);
    if (split.cards.length > maxCards) {
      return NextResponse.json(
        { error: "Too many cards for current state" },
        { status: 409 }
      );
    }

    // Payment can start only when all amounts valid and sum matches total.
    if (sumAgorot(split.cards) !== split.total_agorot) {
      return NextResponse.json(
        { error: "Split amounts must equal total" },
        { status: 409 }
      );
    }

    if (split.cards.some((c) => !isLocked(c) && c.amount_agorot < split.min_amount_agorot)) {
      return NextResponse.json(
        { error: "One or more cards violate minimum amount" },
        { status: 409 }
      );
    }

    // Set pending before redirect.
    card.status = "pending";
    card.tx_id = undefined;
    card.last_error = undefined;
    card.updated_at = nowIso();

    await writeSplitState(orderId, reservation.payment_info, split);

    const xml = buildDoDealXML({
      terminalNumber,
      mid,
      uniqueid: uuidv4(),
      total: card.amount_agorot,
      successUrl: `${returnUrl}/api/split-payment/confirmation/${orderId}/${paymentId}/success`,
      errorUrl: `${returnUrl}/api/split-payment/confirmation/${orderId}/${paymentId}/error`,
      cancelUrl: `${returnUrl}/api/split-payment/confirmation/${orderId}/${paymentId}/cancel`,
      email: reservation.main_contact_email,
    });

    const formData = new URLSearchParams();
    formData.append("user", userName);
    formData.append("password", password);
    formData.append("int_in", xml);

    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from payment gateway:", errorText);

      // Best-effort: revert pending -> failed.
      try {
        const reservation2 = await getReservationOrThrow(orderId);
        const split2 = readSplitState(reservation2.payment_info);
        const card2 = split2?.cards.find((c) => c.id === paymentId);
        if (split2 && card2) {
          card2.status = "failed";
          card2.last_error = "PAYMENT_GATEWAY_ERROR";
          card2.updated_at = nowIso();
          await writeSplitState(orderId, reservation2.payment_info, split2);
        }
      } catch {
        // ignore
      }

      return NextResponse.json({ error: "Payment failed" }, { status: 500 });
    }

    const bodyText = await response.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = convert(bodyText, { format: "object" }) as any;

    return NextResponse.json(
      { url: result.ashrait.response.doDeal.mpiHostedPageUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("split-payment start error", error);
    return NextResponse.json(
      { error: "Failed to start payment" },
      { status: 500 }
    );
  }
}
