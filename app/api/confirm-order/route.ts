import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import { OrderData } from "@/lib/app.types";
import { validateOrderData, validatePurchasePriceFloor } from "./utils";
import { sendUserEmail } from "../sendUserEmail";
import {
  trackServerSideEvent,
  extractIpFromRequest,
  extractUserAgentFromRequest,
} from "@/lib/gtmAnalytics";

export async function POST(req: Request) {
  const { payNow, onlySave, gtmIdnts, skipAnalytics, ...orderDetails } =
    await req.json();

  const validatedData: OrderData = await validateOrderData(
    orderDetails,
    payNow,
  );

  // Reject grossly-tampered totals before persisting — the stored
  // final_purchase_price_ils is what /api/payment later charges. Fails open, so
  // it never blocks a legitimate order (see validatePurchasePriceFloor).
  const priceError = await validatePurchasePriceFloor(validatedData);
  if (priceError) {
    console.error(
      "Rejected order — purchase-price floor:",
      JSON.stringify({ event_id: validatedData.event_id, reason: priceError }),
    );
    return NextResponse.json(
      { error: "PRICE_VALIDATION_FAILED" },
      { status: 400 },
    );
  }

  // Surface offline inventory linkage as top-level columns so the backoffice
  // can query / JOIN without unpacking the order JSON blobs.
  const flightInfoForLink = validatedData.flight_order_info as
    | { offlineId?: number; offlineRawPrice?: number; numOfTravelers?: number }
    | undefined;
  const hotelInfoForLink = validatedData.hotel_order_info as
    | {
        offlineId?: number;
        offlineIds?: number[];
        offlineRawPrice?: number;
        checkin?: string;
        checkout?: string;
      }
    | undefined;

  const offlineHotelIdsForLink: number[] | null =
    hotelInfoForLink?.offlineIds && hotelInfoForLink.offlineIds.length > 0
      ? hotelInfoForLink.offlineIds
      : hotelInfoForLink?.offlineId != null
      ? [hotelInfoForLink.offlineId]
      : null;

  // Defense-in-depth: offline hotel inventory has fixed dates. Reject the order
  // if any linked offline_hotels row doesn't EXACTLY match the booked stay
  // (guards against stale client state after a flight-date change, races, or
  // tampering — the client filter in /api/offline-hotels is the first line).
  if (offlineHotelIdsForLink) {
    const bookedCheckin = hotelInfoForLink?.checkin;
    const bookedCheckout = hotelInfoForLink?.checkout;
    const uniqueOfflineIds = Array.from(new Set(offlineHotelIdsForLink));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: offlineRows, error: offlineErr } = await (supabase as any)
      .from("offline_hotels")
      .select("id, check_in, check_out")
      .in("id", uniqueOfflineIds);

    if (offlineErr) {
      console.error(
        "Offline hotel date validation query failed:",
        JSON.stringify(offlineErr),
      );
      return NextResponse.json(
        { error: "Failed to validate offline hotel" },
        { status: 500 },
      );
    }

    const datesMismatch =
      !bookedCheckin ||
      !bookedCheckout ||
      uniqueOfflineIds.length !== (offlineRows?.length ?? 0) ||
      (offlineRows ?? []).some(
        (r: { check_in: string; check_out: string }) =>
          r.check_in !== bookedCheckin || r.check_out !== bookedCheckout,
      );

    if (datesMismatch) {
      console.error(
        "Offline hotel date mismatch — rejecting order.",
        JSON.stringify({ bookedCheckin, bookedCheckout, offlineRows }),
      );
      return NextResponse.json(
        { error: "OFFLINE_HOTEL_DATE_MISMATCH" },
        { status: 409 },
      );
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("reservations")
    .insert({
      main_contact_first_name: validatedData.main_contact_first_name,
      main_contact_last_name: validatedData.main_contact_last_name,
      main_contact_phone_number: validatedData.main_contact_phone_number,
      main_contact_email: validatedData.main_contact_email,
      more_pax_info: validatedData.more_pax_info,
      event_order_info: validatedData.event_order_info,
      flight_order_info: validatedData.flight_order_info,
      hotel_order_info: validatedData.hotel_order_info,
      user_shown_price: validatedData.user_shown_price,
      event_id: validatedData.event_id,
      payment_info: payNow ? {} : null,
      aff_partner_tracking_code: validatedData.aff_partner_tracking_code,
      final_purchase_price_ils: validatedData.final_purchase_price_ils,
      exchange_rate_usd_ils_100: validatedData.exchange_rate_usd_ils_100,
      gtmIdnts: gtmIdnts || null,
      status: onlySave ? "24Save" : "Pending",
      offline_flight_id: flightInfoForLink?.offlineId ?? null,
      // offlineRawPrice on flights is per-traveler; multiply to match hotel
      // semantics (already a booking-level total) so profit calc is correct.
      offline_flight_cost:
        flightInfoForLink?.offlineRawPrice != null
          ? flightInfoForLink.offlineRawPrice * (flightInfoForLink.numOfTravelers ?? 1)
          : null,
      offline_hotel_id: offlineHotelIdsForLink ? offlineHotelIdsForLink[0] : null,
      offline_hotel_ids: offlineHotelIdsForLink,
      offline_hotel_cost: hotelInfoForLink?.offlineRawPrice ?? null,
    })
    .select()
    .single();

  const id = data?.id;

  if (error) {
    console.error(
      "Error inserting into reservations table:",
      JSON.stringify(error),
    );
    console.error(
      "Error inserting into reservations table:",
      JSON.stringify(data),
    );
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }

  // Hold offline inventory immediately — released only on cancellation.
  await holdOfflineInventory(validatedData);

  // Generate referral tracking code only for non-agent bookings
  let partnerTrackingCode = "dummy_code";
  if (!validatedData.is_agent_booking) {
    partnerTrackingCode =
      validatedData.main_contact_first_name
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, "_") +
      "_" +
      id.toString();

    const passcode = partnerTrackingCode + "_pass";

    const { error: error2 } = await supabase
      .from("partners")
      .insert({
        partner_tracking_code: partnerTrackingCode,
        name_hebrew: "החזר ללקוח ניתן להתעלם",
        email: "support@mega-events.co.il",
        password: passcode,
        commission: 40,
        user_discount: 20,
        created_at: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error2) {
      console.error(
        "Error inserting into partners table:",
        JSON.stringify(error2),
      );
    }
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  const repEmailContent = `
          New Order Details:
          Name: ${validatedData.main_contact_first_name} ${validatedData.main_contact_last_name}
          Contact Details: ${validatedData.main_contact_phone_number}, ${validatedData.main_contact_email}
          Payment Method: ${onlySave ? "24Save" : payNow ? "Credit Card" : "Phone Order"}
          More Pax: ${validatedData.more_pax_info.length}- ${validatedData.more_pax_info.map((pax) => `${pax.first_name} ${pax.last_name}`).join("; ")}

          ******** Event Details ********
          Event: ${validatedData.event_order_info.name}
          Date: ${validatedData.event_order_info.date}
          Ticket Type: ${validatedData.event_order_info.category}
          Quantity: ${validatedData.event_order_info.number_of_ticket}
          Ticket ID: ${validatedData.event_order_info.id || "N/A"}
          Vendor: ${validatedData.event_order_info.vendor || "N/A"}

          ******** Flight Info **********
          ${
            !validatedData.flight_order_info ||
            !validatedData.flight_order_info.outbound
              ? "Flight: SKIPPED BY CUSTOMER"
              : `Flight Outbound Number: ${validatedData.flight_order_info.outbound.flightNumber}
          Flight Outbound Date: ${validatedData.flight_order_info.outbound.departureTime}
          Flight Inbound Number: ${validatedData.flight_order_info.inbound.flightNumber}
          Flight Inbound Date: ${validatedData.flight_order_info.inbound.departureTime}`
          }

          ******* Hotel Details *********
          ${
            !validatedData.hotel_order_info ||
            Object.keys(validatedData.hotel_order_info).length === 0
              ? "Hotel: SKIPPED BY CUSTOMER"
              : `Hotel: ${validatedData.hotel_order_info.name}
          Room Type: ${validatedData.hotel_order_info.rate.room_name}`
          }

          ******************
          Total Price USD: ${validatedData.user_shown_price}
          Total Price ILS: ${validatedData.final_purchase_price_ils}
          Exchange Rate: ${validatedData.exchange_rate_usd_ils_100}
        `;

  try {
    try {
      await transporter.sendMail({
        from: '"MegaEvents Reservations" <reservations@mega-events.co.il>',
        to: process.env.SALES_REP_EMAIL,
        subject: `New Order Confirmation - ${validatedData.event_order_info.name}`,
        text: repEmailContent,
      });
    } catch (emailError) {
      console.warn("Sales rep email failed (non-fatal):", JSON.stringify(emailError));
    }

    const bookingReference = `ME${new Date().getDate()}${id}`;

    await supabase
      .from("reservations")
      .update({
        booking_reference: bookingReference,
      })
      .eq("id", id);

    // Track analytics event - begin_checkout for immediate payment, generate_lead for phone orders
    // skipAnalytics is sent by the client when the event was already fired this session
    if (!skipAnalytics)
      try {
        const ip = extractIpFromRequest(req);
        const userAgent = extractUserAgentFromRequest(req);

        await trackServerSideEvent({
          eventData: {
            id: validatedData.event_id,
            name: validatedData.event_order_info.name,
            value: validatedData.user_shown_price,
            currency: "USD",
            category:
              validatedData.event_order_info.event_type || "music_event",
            brand: "Mega Events",
            quantity: validatedData.event_order_info.number_of_ticket,
          },
          eventType: payNow ? "begin_checkout" : "generate_lead",
          gtmIdnts,
          userAgent,
          ip,
        });
      } catch (analyticsError) {
        // Don't fail the main request if analytics fails
        console.warn(
          "Analytics tracking failed for order confirmation:",
          analyticsError,
        );
      }

    if (!payNow) {
      // confirmation email to user when ask for phone order
      try {
        await sendUserEmail({
          orderData: { ...validatedData, booking_reference: bookingReference },
          payNow,
          onlySave,
          partnerTrackingCode,
          orderId: id,
        });

        await supabase
          .from("reservations")
          .update({
            confirmation_email_sent: true,
          })
          .eq("id", id);
      } catch (userEmailError) {
        console.warn("User confirmation email failed (non-fatal):", JSON.stringify(userEmailError));
      }
    }

    return NextResponse.json(
      {
        message: "Order confirmed and email sent to sales rep",
        bookingReference,
        newPromoterCode: partnerTrackingCode,
        id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Error sending email into reservations table:",
      JSON.stringify(error),
    );
    console.error(
      "Error sending email into reservations table:",
      JSON.stringify(data),
    );
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 },
    );
  }
}

async function holdOfflineInventory(orderData: OrderData) {
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
              (flightRow.consumed_quantity || 0) + (flightInfo.numOfTravelers || 0),
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
            .update({ consumed_rooms: (hotelRow.consumed_rooms || 0) + count })
            .eq("id", rowId);
        }
      }
    }
  } catch (e) {
    console.error("Failed to hold offline inventory:", e);
  }
}
