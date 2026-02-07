import { NextResponse } from "next/server";
import {
  createInitialSplitState,
  getReservationOrThrow,
  readSplitState,
  toAgorot,
  writeSplitState,
} from "../utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const promoCode = String(body.promoCode || "dummy_code");

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const reservation = await getReservationOrThrow(orderId);

    const existing = readSplitState(reservation.payment_info);
    if (existing) {
      return NextResponse.json({ split: existing }, { status: 200 });
    }

    const totalAgorot = toAgorot(Number(reservation.final_purchase_price_ils || 0));
    if (totalAgorot <= 0) {
      return NextResponse.json(
        { error: "Invalid order total" },
        { status: 400 }
      );
    }

    const split = createInitialSplitState({ totalAgorot, promoCode });

    await writeSplitState(orderId, reservation.payment_info, split);

    return NextResponse.json({ split }, { status: 200 });
  } catch (error) {
    console.error("split-payment init error", error);
    return NextResponse.json(
      { error: "Failed to init split payment" },
      { status: 500 }
    );
  }
}
