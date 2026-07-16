import { NextResponse } from "next/server";
import { validateAndRecordPayment } from "../../../validateAndRecord";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ txId: string; id: string; promoCode: string }> },
) {
  const { txId, id, promoCode } = await params;

  try {
    const { isSuccess } = await validateAndRecordPayment({
      orderId: id,
      txId,
      promoCode,
    });

    return NextResponse.json({
      isSuccess,
    });
  } catch (error) {
    console.error(
      "Payment validation failed:",
      JSON.stringify({ orderId: id, txId, error: String(error) }),
    );
    return NextResponse.json({ error: "Validation Failed" }, { status: 500 });
  }
}
