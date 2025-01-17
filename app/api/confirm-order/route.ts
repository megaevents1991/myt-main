import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";
import * as yup from 'yup';
import { OrderData } from "@/lib/app.types";

  // 0. Extract data
  // 1. Data validation
  //    Event Data, structure / missing info
  // 2. Insert to DB
  // 3. Send email to sales rep
  // 4. Send email to user
  // 5. Return response

export async function POST(req: Request) {
  const orderDetails = await req.json();

  const validatedData = await validateOrderData(orderDetails);

  const { error } = await supabase
      .from('reservations')
      .insert({
        main_contact_first_name: validatedData.main_contact_first_name,
        main_contact_last_name: validatedData.main_contact_last_name,
        main_contact_phone_number: validatedData.main_contact_phone_number,
        main_contact_email: validatedData.main_contact_email,
        more_pax_info: validatedData.more_pax_info,
        event_order_info: validatedData.event_order_info,
        flight_order_info: validatedData.flight_order_info,
        hotel_order_info: validatedData.hotel_order_info,
        user_shown_price: validatedData.user_shown_price
      });
  if (error) {
    return NextResponse.json({ error: "Failed to confirm order" }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  const emailContent = `
    New Order Details:
    Event: ${validatedData.event_order_info.name}
    Date: ${validatedData.event_order_info.date}
    Ticket Type: ${validatedData.event_order_info.category}
    Quantity: ${validatedData.event_order_info.number_of_ticket}
    Flight: flight.code
    Hotel: hotel.name
    Total Price: ${validatedData.user_shown_price}
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_SERVER_USER,
      to: process.env.SALES_REP_EMAIL,
      subject: `New Order Confirmation - ${validatedData.event_order_info.name}`,
      text: emailContent,
    });
    console.log("Sent");

    return NextResponse.json(
      {
        bookingReference: "123456",
        message: "Order confirmed and email sent to sales rep",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
  }
}

const orderSchema = yup.object().shape({
  main_contact_first_name: yup.string().required().min(1),
  main_contact_last_name: yup.string().required().min(1),
  main_contact_phone_number: yup.string().required().min(1),
  main_contact_email: yup.string().required().min(1),
  more_pax_info: yup
    .array()
    .of(
      yup.object().shape({
        first_name: yup.string().required().min(1),
        last_name: yup.string().required().min(1),
      })
    )
    .required(),
  event_order_info: yup
    .object()
    .shape({
      event_id: yup.number().required(),
      date: yup.date().required(),
      name: yup.string().required().min(1),
      number_of_ticket: yup.number().required(),
      category: yup.string().required().min(1),
      price_per_ticket: yup.number().required(),
      total_tickets_price: yup.number().required(),
    })
    .required(),
  flight_order_info: yup.object().required(), // Adjust based on your flight_order_info schema
  hotel_order_info: yup.object().required(), // Adjust based on your hotel_order_info schema
  user_shown_price: yup.number().required(),
});

const validateOrderData = async (data: OrderData): Promise<OrderData> => {
  try {
    await orderSchema.validate(data);
    return data as OrderData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error('Invalid order data: ' + errorMessage);
  }
};
