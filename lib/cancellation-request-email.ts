import { emailCard, emailNote, emailRow, megaEmailShell } from "@/lib/email-layout";

/**
 * HTML for the two emails a /cancel-order submission sends - the ops copy and
 * the customer acknowledgement - rendered through the shared order-email
 * chrome (lib/email-layout.ts). Pure: no env, no I/O, so it can be previewed
 * without the server action around it.
 */

export type CancellationEmailValues = {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  orderNumber: string;
  email: string;
  note: string;
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

const receivedAt = () =>
  new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

export function opsEmailHtml(v: CancellationEmailValues, requestId: number | null): string {
  const rows = [
    requestId ? emailRow("מספר פנייה", String(requestId)) : "",
    emailRow("מספר הזמנה", escapeHtml(v.orderNumber)),
    emailRow("שם פרטי", escapeHtml(v.firstName)),
    emailRow("שם משפחה", escapeHtml(v.lastName)),
    emailRow("ת.ז.", escapeHtml(v.idNumber)),
    emailRow("טלפון", `<a href="tel:${escapeHtml(v.phone)}" style="color: #0A1A14;">${escapeHtml(v.phone)}</a>`),
    emailRow("דוא\"ל", `<a href="mailto:${escapeHtml(v.email)}" style="color: #0A1A14;">${escapeHtml(v.email)}</a>`),
    emailRow("בקשה / הערה", nl2br(v.note)),
    emailRow("התקבל", receivedAt()),
  ].join("");

  return megaEmailShell({
    icon: "info",
    title: "בקשת ביטול הזמנה חדשה מהאתר",
    message: `${escapeHtml(v.firstName)} ${escapeHtml(v.lastName)} ביקש/ה לבטל את הזמנה <strong>${escapeHtml(v.orderNumber)}</strong>.<br>לחיצה על "השב" עונה ישירות ללקוח.`,
    body: emailCard("פרטי הבקשה", rows),
  });
}

export function customerEmailHtml(v: CancellationEmailValues, requestId: number | null): string {
  const rows = [
    emailRow("מספר הזמנה", escapeHtml(v.orderNumber)),
    requestId ? emailRow("מספר פנייה", String(requestId)) : "",
    emailRow("שם", `${escapeHtml(v.firstName)} ${escapeHtml(v.lastName)}`),
    v.note ? emailRow("ההערה שלך", nl2br(v.note)) : "",
  ].join("");

  const body =
    emailCard("פרטי הבקשה", rows) +
    emailNote(
      `נציג מגה איבנטס יבדוק את הבקשה מול תנאי ההזמנה וישלח אליך אישור ביטול ופירוט דמי הביטול, ככל שחלים, בהתאם לתנאי ההזמנה ולחוק הגנת הצרכן.<br><br>` +
        `פניות מטופלות בימי עסקים א'–ה' בין השעות 09:00–16:00. פנייה שהתקבלה מחוץ לשעות אלה תטופל ביום העסקים העוקב.<br><br>` +
        `לשאלות: וואטסאפ <span style="unicode-bidi: embed;">054-200-2272</span> או במענה למייל זה.`,
    );

  return megaEmailShell({
    title: "קיבלנו את בקשת הביטול שלך",
    message: `שלום ${escapeHtml(v.firstName)}, בקשתך לביטול הזמנה מספר <strong>${escapeHtml(v.orderNumber)}</strong> התקבלה${requestId ? ` (מספר פנייה ${requestId})` : ""}.`,
    body,
  });
}
