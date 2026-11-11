// The short e-mail that carries the customer's ticket-page link, sent once a TixStock SANDBOX test order is
// Approved (lib/tixstock-booking/site-booking.ts). An e-mail of its own: the order confirmation e-mail and its
// template (app/api/sendUserEmail.ts) are not touched. Same transport and sender as that e-mail; the text is the
// shared `ticketLinkEmail` (rules.ts), which the backoffice sweep sends too when it is the one that approves.
import nodemailer from "nodemailer";
import { ticketLinkEmail } from "./rules";

const FROM = '"MegaEvents Reservations" <reservations@mega-events.co.il>';

export async function sendTicketLinkEmail(to: string, eventName: string, url: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: {
      user: process.env.EMAIL_SERVER_USER || "",
      pass: process.env.EMAIL_SERVER_PASSWORD || "",
    },
  });
  const mail = ticketLinkEmail(eventName, url);
  await transporter.sendMail({ from: FROM, to, subject: mail.subject, html: mail.html, text: mail.text });
}
