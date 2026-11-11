// MEGA CLUB - the welcome mail (spec §9, wording D18 = Tom 11.11). A signup confirmation the customer asked for: it
// introduces the club they joined and hands them their card and code - no price, no amount, no event, no link but the
// site and the unsubscribe page (ZeptoMail is transactional-only, and the same account sends every order
// confirmation; ZeptoMail counts a welcome mail that introduces the service as transactional). Offers wait for Zoho
// Campaigns. Table layout and inline styles, like the site's other mails.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const CLUB_MAIL_FROM = '"מגה איבנטס" <news@mega-events.co.il>';
const ADDRESS_LINE = "מגה איבנטס מבית מגה תיירות · ראול ולנברג, תל אביב · 03-768-4800";

/** Tom's words (D18). The wishlist line is softened: the site has no sign-up to an artist's wishlist yet. */
export const CLUB_MAIL_COPY = {
  subject: "ברוכים הבאים ל-MEGA CLUB",
  preview: "הצטרפתם בהצלחה! קוד הקופון עם ההנחה מחכה לכם בפנים...",
  heading: "ברוכים הבאים ל-MEGA CLUB",
  intro: "המועדון האקסקלוסיבי של מגה איבנטס.",
  firstToKnow: "מעכשיו אתם תהיו הראשונים לדעת על כל הופעה, מבצע ומשחק חדש שעולים לאתר - גם של האמנים שאתם הכי מחכים להם!",
  cardReady: "כרטיס החבר שלכם מוכן:",
  codeLabel: "קוד קופון ממבר:",
  thisDevice: "ההנחה מתווספת אוטומטית במכשיר שממנו הצטרפתם.",
  otherDevice: "במכשיר אחר, הקלידו את קוד הקופון שלכם או התחברו עם המייל, וההנחה תתווסף לסיכום ההזמנה.",
  thanks: "תודה שבחרתם ב-MEGA EVENTS",
  cta: "לאתר מגה איבנטס",
} as const;

export function welcomeMail(m: {
  memberNo: number;
  code: string;
  firstName: string | null;
  email: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const c = CLUB_MAIL_COPY;
  const name = m.firstName?.trim() || null;
  const heading = name ? `${name}, ${c.heading}` : c.heading;
  const subject = c.subject;
  const site = esc(m.siteUrl);
  const unsub = esc(m.unsubscribeUrl);
  // Our wordmark in forest, as a PNG from the sending site: Gmail and Outlook drop SVG (Tom 11.11).
  const logo = esc(`${m.siteUrl}/brand/logo-wordmark-forest.png`);

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f3;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f2f5f3;">${esc(c.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f3;" dir="rtl">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#0A1A14;" dir="rtl">
<tr><td style="padding:28px 28px 4px;text-align:right;">
<h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;">${esc(heading)}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.5;font-weight:bold;color:#0A1A14;">${esc(c.intro)}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#33443d;">${esc(c.firstToKnow)}</p>
<p style="margin:0;font-size:15px;line-height:1.6;font-weight:bold;">${esc(c.cardReady)}</p>
</td></tr>
<tr><td style="padding:12px 28px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;background:#25D3B0;background-image:linear-gradient(135deg,#5BFF95 0%,#25D3B0 100%);" dir="rtl">
<tr>
<td style="padding:18px 22px 0;text-align:right;vertical-align:top;color:#0A1A14;">
<span style="display:inline-block;border:2px solid #0A1A14;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:bold;">מס׳ חבר ${m.memberNo}</span>
</td>
<td style="padding:18px 22px 0;text-align:left;vertical-align:top;color:#0A1A14;">
<span style="font-size:20px;font-weight:bold;letter-spacing:2px;" dir="ltr">MEGA CLUB</span>
</td>
</tr>
<tr><td colspan="2" style="padding:22px 22px 0;text-align:right;color:#0A1A14;">
<div style="font-size:15px;word-break:break-all;" dir="ltr">${esc(m.email)}</div>
</td></tr>
<tr>
<td style="padding:16px 22px 20px;text-align:right;vertical-align:bottom;color:#0A1A14;">
<div style="font-size:13px;font-weight:bold;">${esc(c.codeLabel)}</div>
<div style="margin-top:2px;font-size:28px;font-weight:bold;letter-spacing:4px;font-family:'Courier New',monospace;" dir="ltr">${esc(m.code)}</div>
</td>
<td style="padding:16px 22px 24px;text-align:left;vertical-align:bottom;">
<img src="${logo}" width="110" height="16" alt="מגה איבנטס" style="display:block;margin-left:0;margin-right:auto;border:0;width:110px;height:16px;">
</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:4px 28px 0;text-align:right;">
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;">${esc(c.thisDevice)}</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#33443d;">${esc(c.otherDevice)}</p>
<p style="margin:18px 0 0;font-size:15px;line-height:1.6;font-weight:bold;">${esc(c.thanks)}</p>
</td></tr>
<tr><td style="padding:20px 28px 22px;text-align:right;">
<a href="${site}" style="display:inline-block;background:#0A1A14;color:#5BFF95;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px;">${esc(c.cta)}</a>
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
    heading,
    c.intro,
    "",
    c.firstToKnow,
    "",
    c.cardReady,
    `MEGA CLUB · מס׳ חבר ${m.memberNo}`,
    m.email,
    `${c.codeLabel} ${m.code}`,
    "",
    c.thisDevice,
    c.otherDevice,
    "",
    c.thanks,
    m.siteUrl,
    "",
    "קיבלתם את המייל כי הצטרפתם ל-MEGA CLUB באתר מגה איבנטס.",
    ADDRESS_LINE,
    `הסרה מהעדכונים (מחיר החבר נשאר שלכם): ${m.unsubscribeUrl}`,
  ].join("\n");

  return { subject, html, text };
}
