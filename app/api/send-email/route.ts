import { log } from "console";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  const body = await request.json();
  const { to, subject, text } = body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "studio.gta@gmail.com",
      pass: "uxcjowkgihhfyibv",
    },
  });

  const mailOptions = {
    from: "studio.gta@gmail.com",
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    log(mailOptions.to);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}
