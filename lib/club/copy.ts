// MEGA CLUB - every customer-facing word of the club (spec §5, look = mockup version C, D11).
// The consent text is the exact sentence the visitor ticks; it is stored with every join (club_log.consent_text),
// so a change here is a new CLUB_CONSENT_VERSION.

export const CLUB_CONSENT_TEXT =
  "אני רוצה לקבל ממגה איבנטס עדכונים ומבצעים במייל, ב-SMS ובוואטסאפ. אפשר להסיר בכל רגע.";
export const CLUB_CONSENT_VERSION = "club-2026-11-09-v1";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const CLUB_COPY = {
  brand: "MEGA CLUB",
  title: "הצטרפו ל-MEGA CLUB",
  sub: "מועדון החברים של מגה איבנטס. ההצטרפות בחינם.",
  perks: [
    "ראשונים לשמוע על אירועים חדשים",
    "מבצעים לחברים בלבד",
    "מחיר חבר על ההזמנה הזאת ועל כל הזמנה הבאה",
  ],
  emailLabel: "מייל",
  phoneLabel: "טלפון נייד",
  cta: "הצטרפות למועדון",
  already: "כבר חברי MEGA CLUB? היכנסו עם המייל",
  memberTitle: "כבר חברי MEGA CLUB?",
  memberSub: "הזינו את המייל שאיתו הצטרפתם, ונפעיל את מחיר החבר על ההזמנה.",
  memberCta: "הפעלת מחיר חבר",
  joinInstead: "עדיין לא חברים? הצטרפו עכשיו",
  welcome: "ברוכים הבאים ל-MEGA CLUB",
  welcomeBack: "ברוכים השבים",
  memberTag: "מס׳ חבר",
  since: "מאז",
  appliedLine: (savedUsd: number) => `מחיר חבר הופעל: ${usd(savedUsd)} פחות על ההזמנה הזאת`,
  everyOrder: (perTicketUsd: number) => `${usd(perTicketUsd)} לכל נוסע, ככה בכל הזמנה שלכם`,
  /** "שלחנו ל-<email> מייל עם קוד החבר" - the address is printed between the two, isolated (bdi). */
  mailSentBefore: "שלחנו ל-",
  mailSentAfter: " מייל עם קוד החבר",
  backToOrder: "חזרה להזמנה",
  /** D14: the popup came on the way to payment - these carry the interrupted click on. */
  continuePay: "המשך לתשלום מאובטח",
  continueOrder: "המשך להזמנה",
  later: "פעם הבאה",
  pageApplied: "מחיר החבר יופעל לבד בהזמנה הבאה שלכם במכשיר הזה.",
  pageCta: "לאירועים באתר",
  pagePerks: ["ראשונים לשמוע על אירועים חדשים", "מבצעים לחברים בלבד", "מחיר חבר על כל הזמנה של חבילה, בכל פעם"],
  pageFormTitle: "הצטרפות בחינם",
  pageKnown: "אתם כבר חברי MEGA CLUB. מחיר החבר מופעל לבד בהזמנה במכשיר הזה.",
  pageCode: "קוד החבר:",
  pageOther: "לא אתם? כניסה עם מייל אחר",
  pageClosed: "ההצטרפות למועדון סגורה כרגע.",
  menu: "הצטרפות למועדון",
  rowTitle: "MEGA CLUB",
  rowSub: "חברים מקבלים מחיר חבר",
  rowJoin: "הצטרפות",
  rowMember: "כבר חברים",
  applied: "מחיר חבר הופעל",
  appliedFor: (name: string) => `מחיר חבר הופעל, ${name}`,
  swap: "להחליף למחיר חבר",
  keptBetter: "הקופון שכבר הפעלתם שווה יותר, אז הוא נשאר. מחיר החבר יחכה לכם בהזמנה הבאה.",
  appliedTotal: (savedUsd: number) => `מחיר חבר הופעל - ${usd(savedUsd)} פחות`,
  ticketOnly: "מחיר חבר תקף בהזמנת חבילה עם טיסה",
  notFound: "לא מצאנו את המייל הזה במועדון",
  error: "משהו השתבש, נסו שוב",
  invalid: "בדקו את המייל ואת מספר הטלפון",
  rateLimited: "יותר מדי ניסיונות. נסו שוב בעוד שעה",
  close: "סגירה",
} as const;

/** The unsubscribe page and its answer (spec §8). */
export const CLUB_UNSUBSCRIBE_COPY = {
  title: "הסרה מהעדכונים של MEGA CLUB",
  /** "העדכונים והמבצעים נשלחים ל-<masked>." - the address is printed after it, isolated (bdi). */
  leadBefore: "העדכונים והמבצעים נשלחים ל-",
  button: "הסרה מהעדכונים",
  stayNote: "תישארו חברי MEGA CLUB, ומחיר החבר נשאר שלכם.",
  done: "הוסרת מהעדכונים. מחיר החבר נשאר שלך.",
  leaveIntro: "רוצים לעזוב את המועדון לגמרי?",
  leaveLink: "עזיבת המועדון",
  leaveWarn: "עזיבה מבטלת את מחיר החבר בכל ההזמנות הבאות, וגם את העדכונים.",
  leaveConfirm: "כן, לעזוב את המועדון",
  leaveCancel: "ביטול",
  leftDone: "עזבת את MEGA CLUB ומחיר החבר בוטל. אפשר להצטרף שוב בכל הזמנה.",
  notFound: "הקישור הזה כבר לא פעיל.",
  error: "משהו השתבש, נסו שוב",
} as const;
