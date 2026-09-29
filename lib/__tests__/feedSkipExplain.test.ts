import { describe, expect, it } from "vitest";
import { explainFeedSkip, type SkipEvent } from "../feed/skipExplain";

const ev = (over: Partial<SkipEvent>): SkipEvent => ({
  date: "2027-07-11T20:00:00",
  tags: "",
  tickets_and_rates: [{ id: "a", price: 100, available: true } as never],
  created_at: "2026-09-27T10:00:00Z",
  campaign_input_hash: null,
  campaign_skip_reason: null,
  ...over,
});

describe("explainFeedSkip - no campaign creative", () => {
  it("never reached: says the event is fine and nothing but the image is missing", () => {
    const why = explainFeedSkip(ev({}), "no campaign creative");
    expect(why.missing).toContain("חסרה רק תמונת הקמפיין");
    expect(why.missing).toContain("27.9.2026");
    expect(why.fix).toContain("העלה לפיד עכשיו");
    expect(why.actionable).toBe(true);
  });

  it("refused or crashed: quotes the generator's own reason", () => {
    const why = explainFeedSkip(
      ev({ campaign_input_hash: "abc123abc123", campaign_skip_reason: "אין מחיר - אין כרטיסים זמינים" }),
      "no campaign creative",
    );
    expect(why.missing).toContain("אין מחיר - אין כרטיסים זמינים");
  });

  it("a crash note wins even with no hash (the run retries it)", () => {
    const why = explainFeedSkip(
      ev({ campaign_skip_reason: "שגיאה ביצירת התמונה: Upload failed for square" }),
      "no campaign creative",
    );
    expect(why.missing).toContain("Upload failed for square");
  });

  it("looked, no image, no reason: points at the button", () => {
    const why = explainFeedSkip(ev({ campaign_input_hash: "abc123abc123" }), "no campaign creative");
    expect(why.missing).toContain("בלי לשמור סיבה");
  });
});

describe("explainFeedSkip - sold out", () => {
  it("a manual Sold tag is on purpose", () => {
    const why = explainFeedSkip(ev({ tags: "Sold" }), "sold out");
    expect(why.missing).toContain("Sold");
    expect(why.actionable).toBe(false);
  });

  it("every ticket unavailable counts the categories", () => {
    const why = explainFeedSkip(
      ev({ tickets_and_rates: [{ available: false }, { available: false }] as never }),
      "sold out",
    );
    expect(why.missing).toContain("כל 2 קטגוריות");
  });

  it("a locked package whose flight is gone", () => {
    const why = explainFeedSkip(ev({ locked_flight_sold_out: true }), "sold out");
    expect(why.missing).toContain("טיסה");
  });
});

describe("explainFeedSkip - other codes", () => {
  it("inside the booking window prints the date and is not actionable", () => {
    const why = explainFeedSkip(ev({ date: "2026-09-30T20:00:00" }), "inside booking window");
    expect(why.missing).toContain("30.9.2026");
    expect(why.actionable).toBe(false);
  });

  it("an unknown code is shown as is", () => {
    expect(explainFeedSkip(ev({}), "something new").missing).toBe("something new");
  });
});
