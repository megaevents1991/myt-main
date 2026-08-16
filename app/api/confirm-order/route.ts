import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import { Coupon, OrderData } from "@/lib/app.types";
import { findValidCoupon, incrementCouponUse } from "@/lib/coupons";
import { getCouponDiscountUsd } from "@/lib/coupon.utils";
import { consumeOldestLiveVoucher } from "@/lib/partner-vouchers";
import {
  validateOrderData,
  validatePurchasePriceFloor,
  resolveAgentSettlement,
} from "./utils";
import { sendUserEmail } from "../sendUserEmail";
import {
  trackServerSideEvent,
  extractIpFromRequest,
  extractUserAgentFromRequest,
} from "@/lib/gtmAnalytics";
import {
  influencerPrimaryCode,
  readUtmCookieFromHeader,
  touchRows,
} from "@/lib/utm";

export async function POST(req: Request) {
  // Bad JSON / failed validation is a client error - return 400 before any
  // side effect (an uncaught throw here used to surface as a 500).
  let payNow, onlySave, gtmIdnts, skipAnalytics, orderDetails;
  let validatedData: OrderData;
  try {
    ({ payNow, onlySave, gtmIdnts, skipAnalytics, ...orderDetails } =
      await req.json());
    validatedData = await validateOrderData(orderDetails, payNow);
  } catch (validationError) {
    console.error(
      "Order validation failed:",
      validationError instanceof Error
        ? validationError.message
        : JSON.stringify(validationError),
    );
    return NextResponse.json({ error: "Invalid order data" }, { status: 400 });
  }

  // Attribution cookie - server-set by middleware, server-read here. Fail-open:
  // any parse problem behaves like "no cookie" (today's exact behavior).
  const utmCookie = readUtmCookieFromHeader(req.headers.get("cookie"));

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
  // tampering - the client filter in /api/offline-hotels is the first line).
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
        "Offline hotel date mismatch - rejecting order.",
        JSON.stringify({ bookedCheckin, bookedCheckout, offlineRows }),
      );
      return NextResponse.json(
        { error: "OFFLINE_HOTEL_DATE_MISMATCH" },
        { status: 409 },
      );
    }
  }

  // Coupon: re-validate against the DB at order time (never trust a
  // client-computed discount). A coupon that expired / ran out between
  // "apply" and "pay" rejects the order so the customer re-checks the price.
  let coupon: Coupon | null = null;
  let couponDiscountUsd = 0;
  if (validatedData.coupon_code) {
    coupon = await findValidCoupon(
      validatedData.coupon_code,
      validatedData.event_id,
    );
    if (!coupon) {
      console.error(
        "Coupon rejected at confirm-order:",
        JSON.stringify({
          code: validatedData.coupon_code,
          eventId: validatedData.event_id,
        }),
      );
      return NextResponse.json({ error: "COUPON_INVALID" }, { status: 409 });
    }
    couponDiscountUsd = getCouponDiscountUsd(
      {
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      },
      validatedData.coupon_base_total_usd ?? 0,
    );
  }

  // Reject grossly-tampered totals before persisting - the stored
  // final_purchase_price_ils is what /api/payment later charges. Runs after the
  // coupon re-check so the floor can be relaxed by the DB-trusted coupon row.
  // Fails open, so it never blocks a legitimate order (see
  // validatePurchasePriceFloor).
  const priceError = await validatePurchasePriceFloor(validatedData, coupon);
  if (priceError) {
    console.error(
      "Rejected order - purchase-price floor:",
      JSON.stringify({ event_id: validatedData.event_id, reason: priceError }),
    );
    return NextResponse.json(
      { error: "PRICE_VALIDATION_FAILED" },
      { status: 400 },
    );
  }

  // Agent booking-on-behalf: decides whether this order is charged in full,
  // netted for the agent's own card, or settled by voucher (no charge at
  // all). Must run after the floor check above so a voucher/agent_card order
  // still has to clear it on the full price the client submitted.
  const settlement = await resolveAgentSettlement(validatedData, payNow);
  if (!settlement.ok) {
    console.error("Rejected order - agent settlement:", settlement.reason);
    return NextResponse.json(
      { error: "SETTLEMENT_NOT_ALLOWED" },
      { status: 400 },
    );
  }

  const reservationPayload = {
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
    // Influencer-protected attribution wins: the myt_utm cookie's primary is
    // immune to later campaign clicks (utm_source=google used to overwrite the
    // influencer's code in localStorage and steal the credit). Falls back to
    // the legacy client-sent value, then coupon attribution - today's chain.
    aff_partner_tracking_code:
      influencerPrimaryCode(utmCookie) ||
      validatedData.aff_partner_tracking_code ||
      coupon?.partner_tracking_code ||
      "",
    // Always the FULL, undiscounted total - see resolveAgentSettlement.
    final_purchase_price_ils: settlement.finalPurchasePriceIls,
    exchange_rate_usd_ils_100: validatedData.exchange_rate_usd_ils_100,
    gtmIdnts: gtmIdnts || null,
    status: onlySave ? "24Save" : "Pending",
    // Staff-only marker (never shown to the customer) so a Pending
    // reservation reads as "awaiting a voucher from this partner" instead
    // of a generic uncalled phone lead. Null for every non-agent-assisted
    // booking.
    partner_settlement_method: settlement.method,
    // The ONLY column /api/payment subtracts before charging - 0 for every
    // order except an agent_card settlement.
    agent_card_discount_ils: settlement.agentCardDiscountIls || null,
    offline_flight_id: flightInfoForLink?.offlineId ?? null,
    // offlineRawPrice on flights is per-traveler; multiply to match hotel
    // semantics (already a booking-level total) so profit calc is correct.
    offline_flight_cost:
      flightInfoForLink?.offlineRawPrice != null
        ? flightInfoForLink.offlineRawPrice *
          (flightInfoForLink.numOfTravelers ?? 1)
        : null,
    offline_hotel_id: offlineHotelIdsForLink ? offlineHotelIdsForLink[0] : null,
    offline_hotel_ids: offlineHotelIdsForLink,
    offline_hotel_cost: hotelInfoForLink?.offlineRawPrice ?? null,
    coupon_code: coupon ? coupon.code : null,
    coupon_discount_usd: coupon ? couponDiscountUsd : null,
    // Source attribution for the partner portal's "how did this order arrive"
    // label (package link / quote / plain link). Sanitized, never trusted
    // beyond labeling - no FK, no pricing effect.
    source_share_token:
      typeof validatedData.source_share_token === "string" &&
      validatedData.source_share_token.trim()
        ? validatedData.source_share_token.trim().slice(0, 64)
        : null,
    quote_id:
      typeof validatedData.quote_id === "number" &&
      Number.isInteger(validatedData.quote_id) &&
      validatedData.quote_id > 0
        ? validatedData.quote_id
        : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (supabase as any)
    .from("reservations")
    .insert(reservationPayload)
    .select()
    .single();

  if (error?.code === "42703") {
    // The settlement/attribution columns' migration hasn't landed yet - retry
    // without them rather than failing EVERY order confirmation (not just
    // agent ones) on a column that doesn't exist yet.
    const {
      partner_settlement_method: _partnerSettlementMethod,
      agent_card_discount_ils: _agentCardDiscountIls,
      source_share_token: _sourceShareToken,
      quote_id: _quoteId,
      ...payloadWithoutSettlementColumns
    } = reservationPayload;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ data, error } = await (supabase as any)
      .from("reservations")
      .insert(payloadWithoutSettlementColumns)
      .select()
      .single());
  }

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

  // Attribution touches → utm_touches (position 0 = primary). Purely
  // additive analytics data: a failure here must NEVER fail the booking.
  if (id && utmCookie) {
    try {
      const rows = touchRows(utmCookie, id);
      if (rows.length > 0) {
        const { error: utmError } = await supabase
          .from("utm_touches")
          .insert(rows);
        if (utmError)
          console.error("utm_touches insert failed:", JSON.stringify(utmError));
      }
    } catch (e) {
      console.error("utm_touches insert failed:", e);
    }
  }

  // Hold offline inventory immediately - released only on cancellation.
  await holdOfflineInventory(validatedData);

  // Order saved - count the redemption (soft limit; failure is non-fatal).
  if (coupon) await incrementCouponUse(coupon);

  // Voucher settlement SPENDS a live voucher: mark the agent's oldest one
  // used and record it on the reservation like an applied coupon, so (a) one
  // voucher can't gate unlimited orders, and (b) the backoffice credit ledger
  // settles it exactly like any credit coupon (spent when Paid, value
  // returned if the order is abandoned). Runs after the insert so a failed
  // order never burns a voucher; done best-effort - an order must not die
  // over the bookkeeping.
  if (
    settlement.method === "voucher" &&
    validatedData.aff_partner_tracking_code
  ) {
    try {
      const voucher = await consumeOldestLiveVoucher(
        validatedData.aff_partner_tracking_code,
      );
      if (voucher) {
        await supabase
          .from("reservations")
          .update({
            coupon_code: voucher.code,
            coupon_discount_usd: Math.min(
              voucher.valueUsd,
              Number(validatedData.user_shown_price) || voucher.valueUsd,
            ),
          })
          .eq("id", id);
      } else {
        // Balance was verified moments ago in resolveAgentSettlement - this
        // is either a race with another voucher order or data drift. The
        // order stands; staff see the settlement marker and chase the voucher.
        console.error(
          "voucher settlement: no live voucher left to consume for",
          validatedData.aff_partner_tracking_code,
        );
      }
    } catch (e) {
      console.error("voucher settlement: consume failed -", e);
    }
  }

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
          Payment Method: ${
            onlySave
              ? "24Save"
              : settlement.method === "voucher"
                ? `Voucher (awaiting from partner ${validatedData.aff_partner_tracking_code})`
                : settlement.method === "agent_card"
                  ? `Credit Card (agent's own - charging ₪${
                      settlement.finalPurchasePriceIls -
                      settlement.agentCardDiscountIls
                    } of ₪${settlement.finalPurchasePriceIls}, net of commission)`
                  : payNow
                    ? "Credit Card"
                    : "Phone Order"
          }
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
          Flight Inbound Number: ${validatedData.flight_order_info.inbound?.flightNumber ?? "N/A"}
          Flight Inbound Date: ${validatedData.flight_order_info.inbound?.departureTime ?? "N/A"}`
          }

          ******* Hotel Details *********
          ${
            !validatedData.hotel_order_info ||
            Object.keys(validatedData.hotel_order_info).length === 0
              ? "Hotel: SKIPPED BY CUSTOMER"
              : `Hotel: ${validatedData.hotel_order_info.name}
          Room Type: ${validatedData.hotel_order_info.rate?.room_name ?? "N/A"}`
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
      console.warn(
        "Sales rep email failed (non-fatal):",
        JSON.stringify(emailError),
      );
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
          isAgentVoucherOrder: settlement.method === "voucher",
        });

        await supabase
          .from("reservations")
          .update({
            confirmation_email_sent: true,
          })
          .eq("id", id);
      } catch (userEmailError) {
        console.warn(
          "User confirmation email failed (non-fatal):",
          JSON.stringify(userEmailError),
        );
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
            .update({ consumed_rooms: (hotelRow.consumed_rooms || 0) + count })
            .eq("id", rowId);
        }
      }
    }
  } catch (e) {
    console.error("Failed to hold offline inventory:", e);
  }
}
