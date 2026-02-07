import { convert } from "xmlbuilder2";
import { NextResponse } from "next/server";
import { buildTxQueryXML } from "@/app/api/payment/[id]/[txId]/[promoCode]/buildTxQueryXML";
import {
  getReservationOrThrow,
  isLocked,
  nowIso,
  readSplitState,
  sumAgorot,
  writeSplitState,
} from "../../../../utils";
import { sendUserEmail } from "@/app/api/sendUserEmail";

const url = process.env.NEXT_SECRET_CG_GATEWAY_URL || "";
const terminalNumber = process.env.NEXT_SECRET_CG_TERMINAL || "";
const userName = process.env.NEXT_SECRET_CG_USER_NAME || "";
const password = process.env.NEXT_SECRET_CG_PASSWORD || "";
const mid = process.env.NEXT_SECRET_CG_MID || "";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ orderId: string; paymentId: string; txId: string }> }
) {
  try {
    const { orderId, paymentId, txId } = await params;

    const xml = buildTxQueryXML({ terminalNumber, mid, txId });

    const formData = new URLSearchParams();
    formData.append("user", userName);
    formData.append("password", password);
    formData.append("int_in", xml);

    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from payment gateway:", errorText);
      return NextResponse.json({ error: "Validation Failed" }, { status: 500 });
    }

    const body = await response.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = convert(body, { format: "object" }) as any;

    const statusText = result?.ashrait?.response?.inquireTransactions?.row?.statusText;
    const isSuccess = statusText === "SUCCEEDED";

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

    if (isLocked(card)) {
      return NextResponse.json({ isSuccess: true, split }, { status: 200 });
    }

    card.tx_id = txId;
    card.gateway_response = result;
    card.updated_at = nowIso();

    if (isSuccess) {
      card.status = "authorized";
      card.last_error = undefined;
    } else {
      card.status = "failed";
      card.last_error = String(statusText || "FAILED");
    }

    await writeSplitState(orderId, reservation.payment_info, split);

    // If all cards authorized and totals match, mark reservation Paid + send email once.
    const allAuthorized = split.cards.every((c) => c.status === "authorized");
    const totalsMatch = sumAgorot(split.cards) === split.total_agorot;

    if (isSuccess && allAuthorized && totalsMatch) {
      const updateObj: Record<string, unknown> = { status: "Paid" };

      if (!reservation.confirmation_email_sent) {
        await sendUserEmail({
          orderData: reservation,
          isPaymentSuccess: true,
          payNow: true,
          partnerTrackingCode: split.promo_code,
          orderId: Number(orderId),
        });
        updateObj["confirmation_email_sent"] = true;
      }

      await supabaseUpdateReservation(orderId, updateObj);
    }

    return NextResponse.json({ isSuccess, split }, { status: 200 });
  } catch (error) {
    console.error("split-payment validate error", error);
    return NextResponse.json(
      { error: "Failed to validate payment" },
      { status: 500 }
    );
  }
}

async function supabaseUpdateReservation(orderId: string, updateObj: Record<string, unknown>) {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase
    .from("reservations")
    .update(updateObj)
    .eq("id", orderId);
  if (error) throw new Error("Failed to update reservation");
}
