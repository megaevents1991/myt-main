"use server";

import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";

/**
 * Customer cancellation request from /cancel-order (the "ביטול הזמנה" page the
 * terms and the footer point to - consumer-protection law requires a written
 * cancellation channel, this is ours).
 *
 * Every submission is (1) saved to `cancellation_requests` and (2) emailed to
 * ops, plus an acknowledgement to the customer. DB and ops email are each
 * best-effort on their own; the request only fails if BOTH the row insert and
 * the ops email fail, so a transient SMTP hiccup never loses a request that
 * was saved, and vice versa.
 */

const EMAIL_SERVER_USER = process.env.EMAIL_SERVER_USER || "";
const EMAIL_SERVER_PASSWORD = process.env.EMAIL_SERVER_PASSWORD || "";
const FROM = '"MegaEvents Reservations" <reservations@mega-events.co.il>';

// Not exported: a "use server" module may only export async functions.
const CANCELLATION_FIELDS = [
  "firstName",
  "lastName",
  "idNumber",
  "phone",
  "orderNumber",
  "email",
  "note",
] as const;
export type CancellationField = (typeof CANCELLATION_FIELDS)[number];

export interface CancellationFormState {
  status: "idle" | "success" | "error";
  /** Top-level message (success confirmation or a general failure). */
  message?: string;
  /** Per-field validation errors, Hebrew, keyed by input name. */
  errors?: Partial<Record<CancellationField, string>>;
  /** Echo of what was typed so a failed submit doesn't wipe the form. */
  values?: Partial<Record<CancellationField, string>>;
  /** Reference the customer can quote back to us. */
  requestId?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function validate(values: Record<CancellationField, string>) {
  const errors: Partial<Record<CancellationField, string>> = {};
  if (values.firstName.length < 2 || values.firstName.length > 60) {
    errors.firstName = "נא להזין שם פרטי";
  }
  if (values.lastName.length < 2 || values.lastName.length > 60) {
    errors.lastName = "נא להזין שם משפחה";
  }
  if (!/^\d{5,9}$/.test(values.idNumber)) {
    errors.idNumber = "מספר תעודת זהות - ספרות בלבד";
  }
  const phoneDigits = values.phone.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{9,15}$/.test(phoneDigits)) {
    errors.phone = "נא להזין מספר טלפון תקין";
  }
  if (values.orderNumber.length < 1 || values.orderNumber.length > 40) {
    errors.orderNumber = "נא להזין מספר הזמנה";
  }
  if (!EMAIL_RE.test(values.email) || values.email.length > 120) {
    errors.email = "נא להזין כתובת דוא\"ל תקינה";
  }
  if (values.note.length > 2000) {
    errors.note = "ההערה ארוכה מדי (עד 2000 תווים)";
  }
  return errors;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

function opsEmailHtml(v: Record<CancellationField, string>, requestId: number | null) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 10px;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:6px 10px">${escapeHtml(value) || "-"}</td></tr>`;
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px">
    <h2 style="margin:0 0 12px">בקשת ביטול הזמנה חדשה מהאתר${requestId ? ` (#${requestId})` : ""}</h2>
    <table style="border-collapse:collapse;border:1px solid #ddd">
      ${row("שם פרטי", v.firstName)}
      ${row("שם משפחה", v.lastName)}
      ${row("ת.ז.", v.idNumber)}
      ${row("טלפון", v.phone)}
      ${row("מספר הזמנה", v.orderNumber)}
      ${row("דוא\"ל", v.email)}
      ${row("בקשה / הערה", v.note)}
    </table>
    <p style="color:#666;margin-top:12px">התקבל: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</p>
  </div>`;
}

function customerEmailHtml(v: Record<CancellationField, string>, requestId: number | null) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
    <h2 style="margin:0 0 12px">קיבלנו את בקשת הביטול שלך</h2>
    <p>שלום ${escapeHtml(v.firstName)},</p>
    <p>בקשתך לביטול הזמנה מספר <strong>${escapeHtml(v.orderNumber)}</strong> התקבלה${requestId ? ` (מספר פנייה ${requestId})` : ""}.</p>
    <p>נציג מגה איבנטס יבדוק את הבקשה מול תנאי ההזמנה וישלח אליך אישור ביטול ופירוט דמי הביטול, ככל שחלים, בהתאם לתנאי ההזמנה ולחוק הגנת הצרכן.</p>
    <p>פניות מטופלות בימי עסקים א'–ה' בין השעות 09:00–16:00. פנייה שהתקבלה מחוץ לשעות אלה תטופל ביום העסקים העוקב.</p>
    <p>לשאלות: וואטסאפ 054-200-2272 או במענה למייל זה.</p>
    <p>מגה איבנטס</p>
  </div>`;
}

export async function submitCancellationRequest(
  _prev: CancellationFormState,
  formData: FormData,
): Promise<CancellationFormState> {
  // Honeypot - bots fill every field; humans never see this one.
  if (str(formData, "website")) {
    return { status: "success", message: "הבקשה התקבלה." };
  }

  const values = Object.fromEntries(
    CANCELLATION_FIELDS.map((f) => [f, str(formData, f)]),
  ) as Record<CancellationField, string>;

  const errors = validate(values);
  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values };
  }

  // 1. Durable record.
  let requestId: number | null = null;
  let dbOk = false;
  try {
    const { data, error } = await supabase
      .from("cancellation_requests")
      .insert({
        first_name: values.firstName,
        last_name: values.lastName,
        id_number: values.idNumber,
        phone: values.phone,
        order_number: values.orderNumber,
        email: values.email,
        note: values.note || null,
        source: "website",
      })
      .select("id")
      .single();
    if (error) {
      console.error("cancellation_requests insert failed:", JSON.stringify(error));
    } else {
      requestId = (data as { id: number }).id;
      dbOk = true;
    }
  } catch (e) {
    console.error("cancellation_requests insert threw:", e);
  }

  // 2. Emails - ops first (the one that matters), then the customer ack.
  const opsTo = process.env.CANCELLATION_REQUEST_EMAIL || process.env.SALES_REP_EMAIL;
  let opsOk = false;
  if (EMAIL_SERVER_USER && EMAIL_SERVER_PASSWORD && opsTo) {
    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.com",
      port: 587,
      auth: { user: EMAIL_SERVER_USER, pass: EMAIL_SERVER_PASSWORD },
    });
    try {
      await transporter.sendMail({
        from: FROM,
        to: opsTo,
        replyTo: values.email,
        subject: `בקשת ביטול הזמנה ${values.orderNumber} - ${values.firstName} ${values.lastName}`,
        html: opsEmailHtml(values, requestId),
      });
      opsOk = true;
    } catch (e) {
      console.error("cancellation ops email failed:", e);
    }
    try {
      await transporter.sendMail({
        from: FROM,
        to: values.email,
        subject: `קיבלנו את בקשת הביטול שלך | מגה איבנטס`,
        html: customerEmailHtml(values, requestId),
      });
    } catch (e) {
      console.error("cancellation customer ack email failed:", e);
    }
  } else {
    console.error("cancellation request: email not configured (EMAIL_SERVER_* / CANCELLATION_REQUEST_EMAIL / SALES_REP_EMAIL)");
  }

  if (!dbOk && !opsOk) {
    return {
      status: "error",
      values,
      message:
        "לא הצלחנו לקלוט את הבקשה. נסו שוב בעוד מספר דקות, או שלחו אותה במייל ל-opsfit1@megatr.co.il או בוואטסאפ 054-200-2272.",
    };
  }

  return {
    status: "success",
    requestId: requestId ?? undefined,
    message: "בקשת הביטול התקבלה. שלחנו אישור קבלה למייל שלך, ונציג יחזור אליך ביום העסקים הקרוב.",
  };
}
