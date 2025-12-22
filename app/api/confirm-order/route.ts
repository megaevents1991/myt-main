import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import { OrderData } from "@/lib/app.types";
import { validateOrderData } from "./utils";
import { sendUserEmail } from "../sendUserEmail";
import {
  getEventOrderInfoList,
  getPrimaryEventOrderInfo,
  getEventOrderNameSummary,
} from "@/lib/eventOrderInfo";
import { 
  trackServerSideEvent, 
  extractIpFromRequest, 
  extractUserAgentFromRequest 
} from "@/lib/gtmAnalytics";

export async function POST(req: Request) {
  const { payNow, onlySave, gtmIdnts, ...orderDetails } = await req.json();

  const validatedData: OrderData = await validateOrderData(orderDetails, payNow);

  const { data, error } = await supabase
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
    })
    .select()
    .single();

  const id = data?.id;

  if (error) {
    console.error("Error inserting into reservations table:", JSON.stringify(error));
    console.error("Error inserting into reservations table:", JSON.stringify(data));
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
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
        name_hebrew:
          "החזר ללקוח ניתן להתעלם",
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
        JSON.stringify(error2)
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

  const eventInfos = getEventOrderInfoList(validatedData.event_order_info);
  const primaryEvent = getPrimaryEventOrderInfo(validatedData.event_order_info);
  const eventDetailsText = eventInfos
    .map(
      (e, idx) => `
          ******** Event ${idx + 1} ********
          Event: ${e.name}
          Date: ${e.date}
          Ticket Type: ${e.category}
          Quantity: ${e.number_of_ticket}
          Ticket ID: ${e.id || "N/A"}
          Vendor: ${e.vendor || "N/A"}
      `.trimEnd()
    )
    .join("\n\n");

  const repEmailContent = `
          New Order Details:
          Name: ${validatedData.main_contact_first_name} ${validatedData.main_contact_last_name}
          Contact Details: ${validatedData.main_contact_phone_number}, ${validatedData.main_contact_email}
          Payment Method: ${onlySave ? "24Save" : (payNow ? "Credit Card" : "Phone Order")}
          More Pax: ${validatedData.more_pax_info.length}- ${validatedData.more_pax_info.map(pax => `${pax.first_name} ${pax.last_name}`).join('; ')}

${eventDetailsText}

          ******** Flight Info **********
          Flight Outbound Number: ${(validatedData.flight_order_info.outbound.flightNumber)}
          Flight Outbound Date: ${(validatedData.flight_order_info.outbound.departureTime)}
          Flight Inbound Number: ${(validatedData.flight_order_info.inbound.flightNumber)}
          Flight Inbound Date: ${(validatedData.flight_order_info.inbound.departureTime)}

          ******* Hotel Details *********
          ${(!validatedData.hotel_order_info || Object.keys(validatedData.hotel_order_info).length === 0)
            ? 'Hotel: SKIPPED BY CUSTOMER' 
            : `Hotel: ${validatedData.hotel_order_info.name}
          Room Type: ${validatedData.hotel_order_info.rate.room_name}`}

          ******************
          Total Price USD: ${validatedData.user_shown_price}
          Total Price ILS: ${validatedData.final_purchase_price_ils}
          Exchange Rate: ${validatedData.exchange_rate_usd_ils_100}
        `;

  try {
    await transporter.sendMail({
      from: '"MegaEvents Reservations" <reservations@mega-events.co.il>',
      to: process.env.SALES_REP_EMAIL,
      subject: `New Order Confirmation - ${getEventOrderNameSummary(validatedData.event_order_info)}`,
      text: repEmailContent,
    });

    const bookingReference = `ME${new Date().getDate()}${id}`;
    
    await supabase
      .from("reservations")
      .update({
        booking_reference: bookingReference,
      })
      .eq("id", id);

    // Track analytics event - purchase for immediate payment, begin_checkout for phone orders
    try {
      const ip = extractIpFromRequest(req);
      const userAgent = extractUserAgentFromRequest(req);
      
      await trackServerSideEvent({
        eventData: {
          id: validatedData.event_id,
          name: primaryEvent.name,
          value: validatedData.user_shown_price,
          currency: "USD",
          category: primaryEvent.event_type || "music_event",
          brand: "Mega Events",
          quantity: primaryEvent.number_of_ticket
        },
        eventType: payNow ? "begin_checkout" : "generate_lead",
        gtmIdnts,
        userAgent,
        ip,
      });
    } catch (analyticsError) {
      // Don't fail the main request if analytics fails
      console.warn("Analytics tracking failed for order confirmation:", analyticsError);
    }

    if (!payNow) { // confirmation email to user when ask for phone order
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
    }

    return NextResponse.json(
      {
        message: "Order confirmed and email sent to sales rep",
        bookingReference,
        newPromoterCode: partnerTrackingCode,
        id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email into reservations table:", JSON.stringify(error));
    console.error("Error sending email into reservations table:", JSON.stringify(data));
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
  }
}
