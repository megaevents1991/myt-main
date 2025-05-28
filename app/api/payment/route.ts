import { convert } from "xmlbuilder2";
import { v4 as uuidv4 } from "uuid";
import { PaymentRequest } from "@/lib/app.types";
import { NextResponse } from "next/server";
import { buildDoDealXML } from "./buildDoDealXML";

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
  const { amount, email, orderId, promoCode }: PaymentRequest =
    await request.json();

  const xml = buildDoDealXML({
    terminalNumber,
    mid,
    uniqueid: uuidv4(),
    total: amount * 100,
    successUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/success`,
    errorUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/error`,
    cancelUrl: `${returnUrl}/api/confirmation/${orderId}/${promoCode}/cancel`,
    email,
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
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }

  const body = await response.text();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = convert(body, { format: "object" }) as any;

  return NextResponse.json({
    url: result.ashrait.response.doDeal.mpiHostedPageUrl,
  });
}
