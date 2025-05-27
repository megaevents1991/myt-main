import nodemailer from "nodemailer";
import dayjs from "dayjs";
import { userEmail } from "./confirm-order/utils";
import { OrderData } from "@/lib/app.types";

const EMAIL_SERVER_USER = process.env.EMAIL_SERVER_USER || "";
const EMAIL_SERVER_PASSWORD = process.env.EMAIL_SERVER_PASSWORD || "";

export const sendUserEmail = async ({
  orderData,
  payNow = false,
  isPaymentSuccess = false,
  partnerTrackingCode = null,
}: {
  orderData: OrderData;
  payNow?: boolean;
  isPaymentSuccess?: boolean;
  partnerTrackingCode?: string | null;
}) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: {
      user: EMAIL_SERVER_USER,
      pass: EMAIL_SERVER_PASSWORD,
    },
  });

  const emailtemplates = {
    successfulPurchase: {
      subject: `תודה שבחרת מגה איבנטס!`,
      title: `תודה שבחרת מגה איבנטס`,
      message: `ההזמנה שלך התקבלה והתשלום אושר בהצלחה.<br> ההזמנה תאושר ביום העסקים הבא ועם אישורה ישלחו אליך אישור ההזמנה כרטיסי הטיסה ושובר המלון. 
<strong>כרטיסי הכניסה לאירוע</strong> יישלחו אליך 14 יום עד ל-24 שעות לפני מועד האירוע.<br>נשמח לעמוד לרשותך בכל שאלה או בקשה נוספת,<br> מאחלים לך חוויה מהנה ובלתי נשכחת!`,
    },
    failedPurchase: {
      subject: `תודה שבחרת מגה איבנטס!`,
      title: `לא הצלחנו להשלים את ההזמנה שלך ל- ${orderData.event_order_info.name}`,
      message: `נראה כי התשלום לא הושלם עקב בעיה טכנית או בפרטי האשראי.<br> נציג שירות ממגה איבנטס יפנה אליך במהלך יום העסקים הקרוב כדי לסייע בהשלמת העסקה.`,
    },
    phoneOrder: {
      subject: `תודה שבחרת מגה איבנטס!`,
      title: "הזמנתך נתקבלה בהצלחה",
      message: "נציג ממגה איבנטס ייצור איתך קשר ביום העסקים הקרוב לקבלת תשלום ומתן מענה לכל שאלה נוספת.",
    },
  };

  const emailTemplate = payNow ? ( isPaymentSuccess ? emailtemplates.successfulPurchase : emailtemplates.failedPurchase ) : emailtemplates.phoneOrder;

  const replacements = {
    bookingReference: orderData.booking_reference,
    title: emailTemplate.title,
    message : emailTemplate.message,
    eventName: orderData.event_order_info.name,
    eventDate: new Date(orderData.event_order_info.date).toLocaleDateString(
      "he-IL"
    ),
    eventLocation: orderData.event_order_info?.location_name || "",
    ticketType: orderData.event_order_info.category,
    quantity: orderData.event_order_info.number_of_ticket,
    airline: orderData.flight_order_info?.metadata?.name,
    departFlight: orderData.flight_order_info?.outbound.flightNumber,
    departFlightDate: dayjs(
      orderData.flight_order_info?.outbound.departureTime
    ).format("DD/MM/YYYY HH:MM"),
    returnFlight: orderData.flight_order_info?.inbound.flightNumber,
    returnFlightDate: dayjs(
      orderData.flight_order_info?.inbound.departureTime
    ).format("DD/MM/YYYY HH:MM"),
    hotel: orderData.hotel_order_info?.name,
    price: orderData.final_purchase_price_ils,
    promoCode: partnerTrackingCode || undefined,
  };

  const userEmailContent = userEmail(replacements); // @TODO YAKOV - Only for the secondary CTA of talk to rep. For payment CTA we need to send the emails after payment resultion.

  await transporter.sendMail({
    from: '"MegaEvents Reservations" <reservations@mega-events.co.il>',
    replyTo: process.env.SALES_REP_EMAIL,
    to: orderData.main_contact_email,
    subject: emailTemplate.subject,
    html: userEmailContent,
  });
};
