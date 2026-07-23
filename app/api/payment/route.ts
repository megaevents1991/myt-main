import { convert } from "xmlbuilder2";
import { v4 as uuidv4 } from "uuid";
import { PaymentRequest } from "@/lib/app.types";
import { NextResponse } from "next/server";
import { buildDoDealXML } from "./buildDoDealXML";
import { supabase } from "@/lib/supabase";

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

export async function POST(request: Request) {
  let email, orderId, promoCode;
  try {
    ({ email, orderId, promoCode } = (await request.json()) as PaymentRequest);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  // Charge the price PERSISTED for this order, never a client-supplied amount —
  // the request body used to control the charge, so anyone could pay ₪1.
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("final_purchase_price_ils")
    .eq("id", orderId)
    .single();

  if (reservationError || !reservation) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const amountIls = Number(reservation.final_purchase_price_ils);
  if (!Number.isFinite(amountIls) || amountIls <= 0) {
    return NextResponse.json(
      { error: "Order has no valid amount" },
      { status: 400 },
    );
  }

  const xml = buildDoDealXML({
    terminalNumber,
    mid,
    uniqueid: uuidv4(),
    // CreditGuard expects the total in agorot (ILS * 100).
    total: Math.round(amountIls * 100),
    successUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/success`,
    errorUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/error`,
    cancelUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/cancel`,
    email,
  });

  const formData = new URLSearchParams();

  formData.append("user", userName);
  formData.append("password", password);
  formData.append("int_in", xml);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from payment gateway:", errorText);
      return NextResponse.json({ error: "Payment failed" }, { status: 500 });
    }

    const body = await response.text();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = convert(body, { format: "object" }) as any;

    // A gateway HTTP 200 can still carry an error envelope (auth failure,
    // terminal error) with no doDeal — surface it instead of throwing.
    const hostedPageUrl = result?.ashrait?.response?.doDeal?.mpiHostedPageUrl;
    if (!hostedPageUrl) {
      console.error("Payment gateway returned no hosted page URL:", body);
      return NextResponse.json({ error: "Payment failed" }, { status: 500 });
    }

    return NextResponse.json({ url: hostedPageUrl });
  } catch (error) {
    console.error("Payment gateway request failed:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
