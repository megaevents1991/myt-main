import { convert } from "xmlbuilder2";
import { supabase } from "@/lib/supabase";
import { sendUserEmail } from "@/app/api/sendUserEmail";
import { OrderData } from "@/lib/app.types";
import { buildTxQueryXML } from "./[id]/[txId]/[promoCode]/buildTxQueryXML";

const url = process.env.NEXT_SECRET_CG_GATEWAY_URL || "";
const terminalNumber = process.env.NEXT_SECRET_CG_TERMINAL || "";
const userName = process.env.NEXT_SECRET_CG_USER_NAME || "";
const password = process.env.NEXT_SECRET_CG_PASSWORD || "";
const mid = process.env.NEXT_SECRET_CG_MID || "";

/**
 * Verify a CreditGuard transaction and record the outcome on the reservation.
 *
 * Ordering is deliberate and load-bearing:
 * 1. Persist `payment_info` + `status` FIRST — a paid order must be marked
 *    Paid no matter what happens later. (A crash in the confirmation email
 *    used to abort this route before the update, so real payments sat as
 *    Pending until the backoffice flagged them Lost.)
 * 2. Only then send the customer email, wrapped so its failure is non-fatal.
 *
 * Idempotent: safe to call from both the CreditGuard server callback and the
 * client confirmation page — the second call rewrites the same values and the
 * `confirmation_email_sent` flag stops a duplicate email.
 */
export async function validateAndRecordPayment({
  orderId,
  txId,
  promoCode,
}: {
  orderId: string;
  txId: string;
  promoCode: string;
}): Promise<{ isSuccess: boolean }> {
  const xml = buildTxQueryXML({
    terminalNumber,
    mid,
    txId,
  });

  const formData = new URLSearchParams();
  formData.append("user", userName);
  formData.append("password", password);
  formData.append("int_in", xml);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error from payment gateway:", errorText);
    throw new Error("Payment gateway inquiry failed");
  }

  const body = await response.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = convert(body, { format: "object" }) as any;

  const isSuccess =
    result.ashrait.response.inquireTransactions.row.statusText === "SUCCEEDED";

  // 1. Record the payment outcome BEFORE anything that can fail.
  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      payment_info: result,
      status: isSuccess ? "Paid" : "Pending",
    })
    .eq("id", orderId);

  if (updateError) {
    console.error(
      "Failed to record payment outcome:",
      JSON.stringify({ orderId, updateError }),
    );
  }

  // 2. Customer email — non-fatal by design.
  try {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", orderId)
      .limit(1)
      .single();

    const orderData = data as OrderData | null;

    if (orderData && !orderData.confirmation_email_sent) {
      await sendUserEmail({
        orderData,
        isPaymentSuccess: isSuccess,
        payNow: true,
        partnerTrackingCode: promoCode,
        orderId: parseInt(orderId),
      });

      await supabase
        .from("reservations")
        .update({ confirmation_email_sent: true })
        .eq("id", orderId);
    }
  } catch (emailError) {
    console.error(
      "Confirmation email failed (payment already recorded):",
      JSON.stringify({ orderId, error: String(emailError) }),
    );
  }

  return { isSuccess };
}
