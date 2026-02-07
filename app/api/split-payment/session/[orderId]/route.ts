import { NextResponse } from "next/server";
import { getReservationOrThrow, readSplitState } from "../../utils";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const reservation = await getReservationOrThrow(orderId);

    const split = readSplitState(reservation.payment_info);
    if (!split) {
      return NextResponse.json(
        { error: "Split payment not initialized" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        orderId,
        reservationStatus: reservation.status,
        split,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("split-payment session error", error);
    return NextResponse.json(
      { error: "Failed to load split payment session" },
      { status: 500 }
    );
  }
}
