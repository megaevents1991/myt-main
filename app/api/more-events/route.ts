import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const moreEvents = await req.json();  

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  const repEmailContent = `
    Event Request Received: ${moreEvents.event}
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_SERVER_USER,
      to: process.env.SALES_REP_EMAIL,
      subject: `Event Request Received`,
      text: repEmailContent,
    });

    return NextResponse.json(
      { message: "Thank you"},
      { status: 200 }
    );
  } catch (error) {
    console.log("Error sending email - more-events:", error);
    return NextResponse.json(
      { error: "Something has happened" },
      { status: 500 }
    );
  }
}

