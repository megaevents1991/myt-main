// MEGA CLUB - the welcome mail (spec §9). A signup confirmation the customer asked for, and it stays one: no perks, no
// deals, no events (ZeptoMail is transactional-only, the same account sends every order confirmation). Offers wait for
// Zoho Campaigns. Table layout and inline styles, like the site's other mails.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const CLUB_MAIL_FROM = '"מגה איבנטס" <news@mega-events.co.il>';
const ADDRESS_LINE = "מגה איבנטס מבית מגה תיירות · ראול ולנברג, תל אביב · 03-768-4800";

export function welcomeMail(m: {
  memberNo: number;
  code: string;
  firstName: string | null;
  unsubscribeUrl: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const name = m.firstName?.trim() || null;
  const hello = name ? `${esc(name)}, ברוכים הבאים ל-MEGA CLUB` : "ברוכים הבאים ל-MEGA CLUB";
  const subject = `ברוכים הבאים ל-MEGA CLUB · מס׳ חבר ${m.memberNo}`;
  const site = esc(m.siteUrl);
  const unsub = esc(m.unsubscribeUrl);

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f3;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f3;" dir="rtl">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#0A1A14;" dir="rtl">
<tr><td style="padding:28px 28px 8px;text-align:right;">
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">${hello}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#33443d;">ההצטרפות הושלמה. זה כרטיס החבר שלכם:</p>
</td></tr>
<tr><td style="padding:16px 28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:#25D3B0;background-image:linear-gradient(135deg,#5BFF95 0%,#25D3B0 100%);" dir="rtl">
<tr><td style="padding:20px 22px;text-align:right;color:#0A1A14;">
<div style="font-size:20px;font-weight:bold;letter-spacing:2px;" dir="ltr">MEGA CLUB</div>
<div style="margin-top:28px;font-size:15px;font-weight:bold;">מס׳ חבר ${m.memberNo}</div>
${name ? `<div style="margin-top:4px;font-size:15px;">${esc(name)}</div>` : ""}
</td></tr>
</table>
</td></tr>
<tr><td style="padding:8px 28px 0;text-align:right;">
<p style="margin:0 0 6px;font-size:14px;color:#33443d;">קוד החבר שלכם:</p>
<div style="font-size:30px;font-weight:bold;letter-spacing:4px;font-family:'Courier New',monospace;color:#0A1A14;" dir="ltr">${esc(m.code)}</div>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;">מחיר החבר מופעל לבד במכשיר הזה. במכשיר אחר, הקלידו את הקוד בשדה הקופון בסיכום ההזמנה.</p>
</td></tr>
<tr><td style="padding:22px 28px;text-align:right;">
<a href="${site}" style="display:inline-block;background:#0A1A14;color:#5BFF95;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px;">לאתר מגה איבנטס</a>
</td></tr>
<tr><td style="padding:16px 28px 26px;border-top:1px solid #e3e9e6;text-align:right;font-size:12px;line-height:1.6;color:#6b7a74;">
קיבלתם את המייל כי הצטרפתם ל-MEGA CLUB באתר מגה איבנטס.<br>
${ADDRESS_LINE}<br>
<a href="${unsub}" style="color:#6b7a74;">הסרה מהעדכונים</a> (מחיר החבר נשאר שלכם)
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    name ? `${name}, ברוכים הבאים ל-MEGA CLUB` : "ברוכים הבאים ל-MEGA CLUB",
    "",
    `מס׳ חבר ${m.memberNo}`,
    `קוד החבר שלכם: ${m.code}`,
    "",
    "מחיר החבר מופעל לבד במכשיר הזה. במכשיר אחר, הקלידו את הקוד בשדה הקופון בסיכום ההזמנה.",
    "",
    m.siteUrl,
    "",
    "קיבלתם את המייל כי הצטרפתם ל-MEGA CLUB באתר מגה איבנטס.",
    ADDRESS_LINE,
    `הסרה מהעדכונים (מחיר החבר נשאר שלכם): ${m.unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}
