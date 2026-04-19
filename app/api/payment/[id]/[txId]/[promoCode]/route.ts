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

  // Idempotency guard: only decrement on the first Pending -> Paid flip. If
  // the reservation is already Paid we are replaying a callback and must not
  // consume stock again.
  const shouldDecrement = isSuccess && orderData.status !== "Paid";

  await supabase
    .from("reservations")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  if (shouldDecrement) {
    await decrementOfflineInventory(orderData);
  }

  console.log(JSON.stringify(result));

  return NextResponse.json({
    isSuccess,
  });
}

async function decrementOfflineInventory(orderData: OrderData) {
  try {
    const flightInfo = orderData.flight_order_info as
      | { offlineId?: number; numOfTravelers?: number }
      | undefined;
    if (flightInfo?.offlineId) {
      const { data: flightRow } = await supabase
        .from("flights")
        .select("consumed_quantity")
        .eq("id", flightInfo.offlineId)
        .single();
      if (flightRow) {
        await supabase
          .from("flights")
          .update({
            consumed_quantity:
              (flightRow.consumed_quantity || 0) +
              (flightInfo.numOfTravelers || 0),
          })
          .eq("id", flightInfo.offlineId);
      }
    }

    const hotelInfo = orderData.hotel_order_info as
      | { offlineId?: number; offlineIds?: number[] }
      | undefined;
    const offlineHotelIds: number[] =
      hotelInfo?.offlineIds && hotelInfo.offlineIds.length > 0
        ? hotelInfo.offlineIds
        : hotelInfo?.offlineId
        ? [hotelInfo.offlineId]
        : [];
    if (offlineHotelIds.length > 0) {
      const counts = new Map<number, number>();
      for (const rowId of offlineHotelIds) {
        counts.set(rowId, (counts.get(rowId) || 0) + 1);
      }
      for (const [rowId, count] of counts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: hotelRow } = await (supabase as any)
          .from("offline_hotels")
          .select("consumed_rooms")
          .eq("id", rowId)
          .single();
        if (hotelRow) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("offline_hotels")
            .update({
              consumed_rooms: (hotelRow.consumed_rooms || 0) + count,
            })
            .eq("id", rowId);
        }
      }
    }
  } catch (decrementError) {
    console.error("Failed to decrement offline inventory:", decrementError);
  }
}
