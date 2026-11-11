import { describe, expect, it } from "vitest";
import { welcomeMail } from "@/lib/club/mail";

const input = {
  memberNo: 1001,
  code: "MEGAK7Q2XP",
  firstName: "דנה",
  email: "dana@example.com",
  unsubscribeUrl: "https://www.mega-events.co.il/club/unsubscribe?t=tok123",
  siteUrl: "https://www.mega-events.co.il",
};

describe("welcomeMail (Tom's wording, D18)", () => {
  const mail = welcomeMail(input);

  it("the inbox line: subject and preview text", () => {
    expect(mail.subject).toBe("ברוכים הבאים ל-MEGA CLUB");
    expect(mail.html).toContain("הצטרפתם בהצלחה! קוד הקופון עם ההנחה מחכה לכם בפנים...");
    // the preview text is hidden in the body, so it never shows as a line of the mail
    expect(mail.html).toMatch(/display:none[^>]*>הצטרפתם בהצלחה!/);
  });

  it("introduces the club in Tom's words, with the wishlist line softened", () => {
    for (const s of [mail.html, mail.text]) {
      expect(s).toContain("המועדון האקסקלוסיבי של מגה איבנטס.");
      expect(s).toContain("מעכשיו אתם תהיו הראשונים לדעת על כל הופעה, מבצע ומשחק חדש שעולים לאתר");
      expect(s).toContain("כרטיס החבר שלכם מוכן:");
      expect(s).toContain("ההנחה מתווספת אוטומטית במכשיר שממנו הצטרפתם.");
      expect(s).toContain("במכשיר אחר, הקלידו את קוד הקופון שלכם או התחברו עם המייל, וההנחה תתווסף לסיכום ההזמנה.");
      expect(s).toContain("תודה שבחרתם ב-MEGA EVENTS");
    }
    // no sign-up to an artist's wishlist exists on the site, so the mail promises none
    expect(mail.html).not.toContain("WISHLIST");
    expect(mail.html).not.toContain("להירשם");
  });

  it("the card holds the number, the member's e-mail and the coupon code (Tom's drawing)", () => {
    expect(mail.html).toContain("MEGA CLUB");
    expect(mail.html).toContain("מס׳ חבר 1001");
    expect(mail.html).toContain("dana@example.com");
    expect(mail.html).toContain("קוד קופון ממבר:");
    expect(mail.html).toContain("MEGAK7Q2XP");
    expect(mail.text).toContain("מס׳ חבר 1001");
    expect(mail.text).toContain("dana@example.com");
    expect(mail.text).toContain("קוד קופון ממבר: MEGAK7Q2XP");
  });

  it("the card wears our logo - a PNG from the site, since mail clients drop SVG (Tom 11.11)", () => {
    expect(mail.html).toContain(
      '<img src="https://www.mega-events.co.il/brand/logo-wordmark-forest.png" width="110" height="16" alt="מגה איבנטס"',
    );
    const preview = welcomeMail({ ...input, siteUrl: "https://preview.example.app" });
    expect(preview.html).toContain('src="https://preview.example.app/brand/logo-wordmark-forest.png"');
  });

  it("stays a sign-up mail: no price, no amount, no link but the site and the unsubscribe page", () => {
    const shown = mail.html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
    for (const s of [shown, mail.text, mail.subject]) {
      expect(s).not.toMatch(/\$\s?\d|\d\s?\$|₪|%/);
    }
    const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect([input.siteUrl, input.unsubscribeUrl]).toContain(l);
    expect(mail.text).toContain(input.unsubscribeUrl);
    expect(mail.text).toContain(input.siteUrl);
  });

  it("greets by name when the member gave one, and works without", () => {
    expect(mail.html).toContain("דנה, ברוכים הבאים ל-MEGA CLUB");
    const m = welcomeMail({ ...input, firstName: null });
    expect(m.html).toContain("ברוכים הבאים ל-MEGA CLUB");
    expect(m.html).toContain("מס׳ חבר 1001");
    expect(m.html).not.toContain("null");
  });

  it("escapes what a visitor typed: the name and the e-mail", () => {
    const m = welcomeMail({ ...input, firstName: '<img src=x onerror="alert(1)">', email: 'a"<b>@x.co' });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
    expect(m.html).not.toContain("<b>@x.co");
    expect(m.html).toContain("&lt;b&gt;@x.co");
  });
});
