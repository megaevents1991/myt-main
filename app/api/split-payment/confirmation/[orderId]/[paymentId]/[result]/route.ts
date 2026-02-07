import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ orderId: string; paymentId: string; result: string }> }
) {
  try {
    const { orderId, paymentId, result } = await params;

    const formData = await request.formData();
    const paymentData: Record<string, string> = {};
    formData.forEach((value, key) => {
      paymentData[key] = value.toString();
    });

    const queryParams = new URLSearchParams(paymentData);
    queryParams.set("paymentId", paymentId);
    queryParams.set("result", result);

    const redirectUrl = new URL(
      `/split-payment/${orderId}?${queryParams.toString()}`,
      request.url
    );

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing split-payment callback:", error);

    let orderIdForError = "unknown";
    try {
      const resolvedParams = await params;
      orderIdForError = resolvedParams.orderId;
    } catch {
      // ignore
    }

    const errorUrl = new URL(`/split-payment/${orderIdForError}`, request.url);
    return NextResponse.redirect(errorUrl);
  }
}
