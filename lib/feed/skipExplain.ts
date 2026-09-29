/**
 * Why an event is NOT in the feed, in words staff can act on. Pure - the
 * /product-feed page runs every skipped event through it.
 *
 * The builders (`buildActivityItem` / `buildFeedItem`) return a short reason
 * code; "no campaign creative" alone covered three different situations (never
 * rendered yet, the generator refused, the generator crashed), so "אין
 * קריאייטיב" told nobody what to do. The backoffice creative pipeline leaves
 * its footprints on the event row, and those are what tell them apart:
 * - `campaign_skip_reason` - it looked and refused, or it crashed (the text says which);
 * - `campaign_input_hash` - it looked at the event at all.
 */
import type { Event } from "@/lib/app.types";

export type SkipExplanation = {
  /** What is missing - the actual blocker. */
  missing: string;
  /** What gets it in. */
  fix: string;
  /** False when the drop is on purpose (sold out by hand, too close) - nothing to fix. */
  actionable: boolean;
};

/** One event a feed left out: the builder's reason code plus what it means. */
export type FeedSkip = {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  reason: string;
  why: SkipExplanation;
};

export type SkipEvent = Pick<
  Event,
  | "date"
  | "tags"
  | "tickets_and_rates"
  | "locked_flight_sold_out"
  | "campaign_input_hash"
  | "campaign_skip_reason"
  | "created_at"
>;

/** "2027-07-11T20:00:00" → "11.7.2027" */
function dmy(iso: string | null | undefined): string {
  const day = (iso ?? "").split("T")[0];
  const [y, m, d] = day.split("-").map(Number);
  return y && m && d ? `${d}.${m}.${y}` : "";
}

const PUSH_NOW = "להעלאה מיידית: בעורך האירוע בבקאופיס - 'העלה לפיד עכשיו'";

export function explainFeedSkip(
  event: SkipEvent,
  reason: string,
): SkipExplanation {
  switch (reason) {
    case "sold out":
      return explainSoldOut(event);

    case "inside booking window":
      return {
        missing: `האירוע ב-${dmy(event.date)} - פחות מ-3 ימים, האתר כבר לא מוכר אותו`,
        fix: "אין מה לתקן - יוצא מהפיד בכוונה",
        actionable: false,
      };

    case "no computable price":
      return {
        missing: "אין מחיר: אף כרטיס לא מחזיק מחיר, וגם 'מחיר רגיל' ריק",
        fix: "להזין מחיר לכרטיס (או לחבר ספק) בעורך האירוע",
        actionable: true,
      };

    case "no campaign creative":
      return explainNoCreative(event);

    default:
      return { missing: reason, fix: "", actionable: true };
  }
}

function explainSoldOut(event: SkipEvent): SkipExplanation {
  if (event.tags === "Sold") {
    return {
      missing: "האירוע מסומן 'Sold' ידנית בבקאופיס",
      fix: "אם יש כרטיסים למכירה - להסיר את הסימון Sold בעורך האירוע",
      actionable: false,
    };
  }
  if (event.locked_flight_sold_out) {
    return {
      missing: "חבילה נעולה לטיסה אופליין אחת - והמקומות בטיסה נגמרו",
      fix: "להוסיף מקומות לטיסה או לשחרר את הנעילה לטיסה",
      actionable: true,
    };
  }
  const tickets = event.tickets_and_rates ?? [];
  if (tickets.length === 0) {
    return {
      missing: "אין לאירוע אף קטגוריית כרטיס",
      fix: "להוסיף כרטיסים / לחבר ספק בעורך האירוע",
      actionable: true,
    };
  }
  return {
    missing: `כל ${tickets.length} קטגוריות הכרטיסים לא זמינות (אזלו אצל הספק או במלאי שלנו)`,
    fix: "לחבר ספק עם מלאי, או להוסיף מלאי לכרטיס שלנו",
    actionable: true,
  };
}

function explainNoCreative(event: SkipEvent): SkipExplanation {
  const refused = event.campaign_skip_reason?.trim();
  if (refused) {
    return {
      missing: `לא נוצרה תמונת קמפיין: ${refused}`,
      fix: `לתקן את הסיבה. ${PUSH_NOW}`,
      actionable: true,
    };
  }
  if (!event.campaign_input_hash) {
    const added = dmy(event.created_at);
    return {
      missing: `האירוע תקין לפיד - חסרה רק תמונת הקמפיין, כי מחולל הקריאייטיב עוד לא הגיע אליו${added ? ` (נוסף ב-${added})` : ""}`,
      fix: `ייכנס לבד: ה-cron רץ כל 4 שעות ומטפל קודם באירועים בלי תמונה. ${PUSH_NOW}`,
      actionable: true,
    };
  }
  return {
    missing: "המחולל בדק את האירוע ולא יצר תמונה, בלי לשמור סיבה",
    fix: `${PUSH_NOW} - הכפתור יגיד למה`,
    actionable: true,
  };
}
