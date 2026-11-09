import { describe, expect, it } from "vitest";
import { welcomeMail } from "@/lib/club/mail";

const input = {
  memberNo: 1001,
  code: "MEGAK7Q2XP",
  firstName: "דנה",
  unsubscribeUrl: "https://www.mega-events.co.il/club/unsubscribe?t=tok123",
  siteUrl: "https://www.mega-events.co.il",
};

describe("welcomeMail", () => {
  const mail = welcomeMail(input);

  it("is a Hebrew RTL mail with the member card and the code", () => {
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain("MEGA CLUB");
    expect(mail.html).toContain("מס׳ חבר 1001");
    expect(mail.html).toContain("MEGAK7Q2XP");
    expect(mail.html).toContain("דנה");
    expect(mail.html).toContain(input.unsubscribeUrl);
    expect(mail.html).toContain(input.siteUrl);
    expect(mail.text).toContain("MEGAK7Q2XP");
    expect(mail.text).toContain(input.unsubscribeUrl);
    expect(mail.subject).toContain("MEGA CLUB");
  });

  it("says nothing about perks, deals or events", () => {
    for (const word of ["מבצעים", "הנחה בלעדית", "אירועים חדשים", "מבצע"]) {
      expect(mail.html).not.toContain(word);
      expect(mail.text).not.toContain(word);
      expect(mail.subject).not.toContain(word);
    }
  });

  it("works without a name", () => {
    const m = welcomeMail({ ...input, firstName: null });
    expect(m.html).toContain("מס׳ חבר 1001");
    expect(m.html).not.toContain("null");
  });

  it("escapes a name typed by the visitor", () => {
    const m = welcomeMail({ ...input, firstName: '<img src=x onerror="alert(1)">' });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img");
  });
});
