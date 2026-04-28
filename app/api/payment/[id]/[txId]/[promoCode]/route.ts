import { convert } from "xmlbuilder2";
import { NextResponse } from "next/server";
import { buildTxQueryXML } from "./buildTxQueryXML";
import { supabase } from "@/lib/supabase";
import { sendUserEmail } from "@/app/api/sendUserEmail";
import { OrderData } from "@/lib/app.types";

const url = process.env.NEXT_SECRET_CG_GATEWAY_URL || "";
const terminalNumber = process.env.NEXT_SECRET_CG_TERMINAL || "";
const userName = process.env.NEXT_SECRET_CG_USER_NAME || "";
const password = process.env.NEXT_SECRET_CG_PASSWORD || "";
const mid = process.env.NEXT_SECRET_CG_MID || "";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ txId: string; id: string, promoCode: string }> }
) {
  const { txId, id, promoCode } = await params;

  const xml = buildTxQueryXML({
    terminalNumber,
    mid,
    txId,
  });

  const formData = new URLSearchParams();

  formData.append("user", userName);
  formData.append("password", password);
  formData.append("int_in", xml);

  console.log("XML:", xml);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error from payment gateway:", errorText);
    return NextResponse.json({ error: "Validation Failed" }, { status: 500 });
  }

  const body = await response.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = convert(body, { format: "object" }) as any;

  const isSuccess =
    result.ashrait.response.inquireTransactions.row.statusText === "SUCCEEDED";

  const { data } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .limit(1)
    .single();

  const orderData = data as OrderData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateObj = { payment_info: result, status: isSuccess ? "Paid" : "Pending" } as any;

  if (!orderData.confirmation_email_sent) {
    await sendUserEmail({
      orderData,
      isPaymentSuccess: isSuccess,
      payNow: true,
      partnerTrackingCode: promoCode,
      orderId: parseInt(id),
    });

    updateObj["confirmation_email_sent"] = true;
  }

  await supabase
    .from("reservations")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  console.log(JSON.stringify(result));

  return NextResponse.json({
    isSuccess,
  });
}

