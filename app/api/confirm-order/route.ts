import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { events, flights, hotels } from "@/lib/events-data";

process.env.EMAIL_SERVER_USER = "studio.gta@gmail.com";
process.env.EMAIL_SERVER_PASSWORD = "uxcjowkgihhfyibv";
process.env.SALES_REP_EMAIL = "giladlesh@gmail.com";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(req: Request) {
  const orderDetails = await req.json();

  // Validate and process the order details
  const event = events.find((e) => e.id === orderDetails.eventId);
  const flight = flights.find((f) => f.id === orderDetails.flightId);
  const hotel = hotels.find((h) => h.id === orderDetails.hotelId);

  if (!event || !flight || !hotel) {
    return NextResponse.json(
      { error: "Invalid order details" },
      { status: 400 }
    );
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
    Event: ${event.name}
    Date: ${formatDate(event.date)}
    Ticket Type: ${orderDetails.ticketType}
    Quantity: ${orderDetails.quantity}
    Flight: ${flight.airline} (${formatDate(
    flight.departureTime
  )} - ${formatDate(flight.arrivalTime)})
    Hotel: ${hotel.name}
    Check-in: ${formatDate(orderDetails.checkInDate)}
    Check-out: ${formatDate(orderDetails.checkOutDate)}
    Total Price: $${orderDetails.totalPrice.toFixed(2)}
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_SERVER_USER,
      to: process.env.SALES_REP_EMAIL,
      subject: `New Order Confirmation - ${event.name}`,
      text: emailContent,
    });
    console.log("Sent");

    // Generate a unique booking reference
    const bookingReference = `MYT-${Date.now().toString(36).toUpperCase()}`;

    return NextResponse.json(
      {
        message: "Order confirmed and email sent to sales rep",
        bookingReference: bookingReference,
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
