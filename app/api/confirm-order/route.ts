import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import { OrderData } from "@/lib/app.types";
import { validateOrderData } from "./utils";
import { sendUserEmail } from "../sendUserEmail";

export async function POST(req: Request) {
  const { payNow, ...orderDetails } = await req.json();

  const validatedData: OrderData = await validateOrderData(orderDetails);

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
      aff_partner_tracking_code: validatedData.aff_partner_tracking_code,
      final_purchase_price_ils: validatedData.final_purchase_price_ils,
      exchange_rate_usd_ils_100: validatedData.exchange_rate_usd_ils_100,
      status: "Pending",
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

  let partnerTrackingCode = "dummy_code";
  if (!validatedData.is_agent_booking) {
    partnerTrackingCode =
      validatedData.main_contact_first_name.toLocaleLowerCase() +
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

  const repEmailContent = `
          New Order Details:
          Name: ${validatedData.main_contact_first_name} ${validatedData.main_contact_last_name}
          Contact Details: ${validatedData.main_contact_phone_number}, ${validatedData.main_contact_email}
          More Pax: ${JSON.stringify(validatedData.more_pax_info)}
          Event: ${validatedData.event_order_info.name}
          Date: ${validatedData.event_order_info.date}
          Ticket Type: ${validatedData.event_order_info.category}
          Quantity: ${validatedData.event_order_info.number_of_ticket}
          Flight Outbound Number: ${(validatedData.flight_order_info.outbound.flightNumber)}
          Flight Outbound Date: ${(validatedData.flight_order_info.outbound.departureTime)}
          Flight Inbound Number: ${(validatedData.flight_order_info.inbound.flightNumber)}
          Flight Inbound Date: ${(validatedData.flight_order_info.inbound.departureTime)}
          Hotel: ${(validatedData.hotel_order_info.name)}
          Total Price: ${validatedData.user_shown_price}
        `;

  try {
    await transporter.sendMail({
      from: '"MegaEvents Reservations" <reservations@mega-events.co.il>',
      to: process.env.SALES_REP_EMAIL,
      subject: `New Order Confirmation - ${validatedData.event_order_info.name}`,
      text: repEmailContent,
    });

    const bookingReference = `ME${new Date().getDate()}${id}`;

    await supabase
      .from("reservations")
      .update({
        booking_reference: bookingReference,
      })
      .eq("id", id);

    if (!payNow) { // confirmation email to user when ask for phone order
      await sendUserEmail({
        orderData: { ...validatedData, booking_reference: bookingReference },
        payNow,
        partnerTrackingCode,
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
