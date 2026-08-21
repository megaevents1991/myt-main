import type { CategoryStadium } from "@/lib/taxonomy.types";

/**
 * Team-page extras (redesign spec: ROAD MAP V1 → כדורגל → עמוד קבוצה):
 * stadium info, city info, matchday tips (מסעדות / דרכי הגעה / חניה), and
 * honours - "לתת נופח לעמוד".
 *
 * Keyed by normalizeName(nameDBenglish) of the CMS team card. Seeded for the
 * top-visited teams; the rest are listed in MISSING-CONTENT.md for the
 * marketing team. Migrates into backoffice-managed data with the rest of the
 * page_content plan.
 */

export type MatchdayTip = { title: string; text: string };

export type TeamExtras = {
  stadium?: CategoryStadium;
  city?: { title: string; text: string };
  matchday?: MatchdayTip[];
  /** Honour chips, e.g. "20 אליפויות אנגליה". */
  honours?: string[];
};

export const TEAM_EXTRAS: Record<string, TeamExtras> = {
  "tottenham hotspur fc": {
    stadium: {
      name: "אצטדיון טוטנהאם הוטספר",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/stadium-3-1787320394098.jpg",
      city: "לונדון, אנגליה",
      capacity: "כ-62,000 מקומות",
      description:
        "האצטדיון המודרני באנגליה - נפתח ב-2019 עם יציע דרומי חד-שכבתי ענק, מסעדות ומבשלת בירה בתוך האצטדיון. נוח במיוחד למשפחות.",
    },
    city: {
      title: "לונדון",
      text: "שבע קבוצות פרמייר ליג בעיר אחת, מחזות זמר בווסט אנד, מוזיאונים חינמיים וקניות באוקספורד סטריט - סופ״ש הכדורגל האולטימטיבי.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "רכבת Overground ל-White Hart Lane (דקה הליכה) או קו Victoria ל-Seven Sisters והליכה של 25 דקות. אין חניה ציבורית באזור ביום משחק.",
      },
    ],
    honours: ["2 אליפויות אנגליה", "8 גביעים אנגליים", "גביע ליגת אירופה 2025"],
  },
  arsenal: {
    stadium: {
      name: "אצטדיון האמירויות",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/stadium-2-1787319817469.jpg",
      city: "לונדון, אנגליה",
      capacity: "כ-60,000 מקומות",
      description:
        "הבית של ארסנל מאז 2006 - אצטדיון מודרני ומרשים בצפון לונדון, במרחק הליכה מהייברי ההיסטורי. סיורי אצטדיון ומוזיאון המועדון פועלים כל השבוע.",
    },
    city: {
      title: "לונדון",
      text: "שבע קבוצות פרמייר ליג בעיר אחת, מחזות זמר בווסט אנד, מוזיאונים חינמיים וקניות באוקספורד סטריט - סופ״ש הכדורגל האולטימטיבי.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "קו Piccadilly לתחנת Arsenal - חמש דקות הליכה ליציעים. ביום משחק התחנה עמוסה אחרי השריקה - שקלו לצאת מ-Finsbury Park.",
      },
    ],
    honours: ["13 אליפויות אנגליה", "14 גביעים אנגליים - שיא"],
  },
  chelsea: {
    stadium: {
      name: "סטמפורד ברידג'",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/stamford-bridge-1787323254567.jpg",
      city: "לונדון, אנגליה",
      capacity: "כ-40,000 מקומות",
      description:
        "הבית של צ'לסי מאז 1905, בלב מערב לונדון האופנתי - אצטדיון קומפקטי שבו היציעים ממש על הדשא. מוזיאון וסיורים כל השבוע.",
    },
    city: {
      title: "לונדון",
      text: "פולהאם רוד מוקפת פאבים, מסעדות וקינגס רואד האופנתית - מהאצטדיונים הבודדים שנמצאים ממש בתוך העיר.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "קו District לתחנת Fulham Broadway - שתי דקות הליכה. אין חניה ציבורית - תחבורה ציבורית בלבד.",
      },
    ],
    honours: ["6 אליפויות אנגליה", "2 גביעי אלופות", "אלופת העולם 2025"],
  },
  barcelona: {
    stadium: {
      name: "ספוטיפיי קאמפ נואו",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/camp-nou-1787323256587.jpg",
      city: "ברצלונה, ספרד",
      capacity: "כ-105,000 מקומות (בסיום השיפוץ)",
      description:
        "האצטדיון הגדול באירופה חוזר לחיים אחרי שיפוץ ענק - קתדרלת הכדורגל של ברצלונה. חלק מהמשחקים עשויים להתקיים באולימפיקו מונז'ואיק - הכרטיס שלכם תמיד לאצטדיון שבו המשחק בפועל.",
    },
    city: {
      title: "ברצלונה",
      text: "גאודי, הרמבלס, חוף הברצלונטה וטאפאס עד הלילה - העיר שהיא חופשה מושלמת גם בלי כדורגל. עם משחק של ברסה - חוויה שלמה.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "מטרו L3 ל-Palau Reial או L5 ל-Collblanc. בימי משחק גדולים הרכבות עמוסות - צאו מוקדם.",
      },
    ],
    honours: ["28 אליפויות ספרד", "5 גביעי אלופות", "32 גביעי המלך - שיא"],
  },
  "real madrid": {
    stadium: {
      name: "סנטיאגו ברנבאו",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/stadium-4-1787319821686.jpg",
      city: "מדריד, ספרד",
      capacity: "כ-80,000 מקומות",
      description:
        "אחרי שיפוץ ענק - גג נסגר, מסך היקפי ומוזיאון גביעי האלופות. ספינת הדגל של הכדורגל העולמי.",
    },
    city: {
      title: "מדריד",
      text: "בירת ספרד - הפראדו, שוק סן מיגל וטאפאס עד השעות הקטנות. האצטדיון יושב על שדרת הקסטיאנה במרחק מטרו קצר מכל מקום בעיר.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "מטרו קו 10 לתחנת Santiago Bernabéu - היציאה ממש מול האצטדיון. הגיעו שעה לפני - בידוק הביטחון בערבי ליגת האלופות איטי.",
      },
    ],
    honours: ["36 אליפויות ספרד", "15 גביעי אלופות - שיא כל הזמנים"],
  },
  "fc bayern munich": {
    stadium: {
      name: "אליאנץ ארנה",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/stadium-5-1787319823190.jpg",
      city: "מינכן, גרמניה",
      capacity: "כ-75,000 מקומות",
      description:
        "המעטפת המוארת שמחליפה צבעים לאדום בערבי משחק ונראית מכל העיר. סדר גרמני, נגישות מצוינת ובירה ביציע.",
    },
    city: {
      title: "מינכן",
      text: "בירת בוואריה - מרינפלאץ, גני האנגלישר גארטן ובתי הבירה הגדולים בעולם. בספטמבר-אוקטובר מתווסף האוקטוברפסט - תיאום ציפיות: מחירי מלונות מזנקים.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "U-Bahn קו U6 ל-Fröttmaning - 15 דקות ממרכז העיר, והכרטיס למשחק מקנה נסיעה חינם בתחבורה הציבורית ביום המשחק.",
      },
    ],
    honours: ["33 אליפויות גרמניה", "6 גביעי אלופות"],
  },
  "inter milan": {
    stadium: {
      name: "סן סירו",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/san-siro-1787323248210.jpg",
      city: "מילאנו, איטליה",
      capacity: "כ-75,000 מקומות",
      description:
        "הקתדרלה של הכדורגל האיטלקי - המגדלים הסובבים והיציעים התלולים יוצרים אווירה דרמטית, במיוחד בדרבי דלה מדונינה.",
    },
    city: {
      title: "מילאנו",
      text: "בירת האופנה והעסקים של איטליה - הדואומו, גלריית ויטוריו עמנואלה והנאוויליי בערב. האצטדיון במרחק מטרו קצר מהמרכז.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "מטרו קו M5 (הסגול) לתחנת San Siro Stadio - היציאה מול האצטדיון. בדרבי הגיעו 90 דקות לפני - הכניסות עמוסות.",
      },
    ],
    honours: ["20 אליפויות איטליה", "3 גביעי אלופות"],
  },
  "ac milan": {
    stadium: {
      name: "סן סירו",
      image_url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/templates/stadiums/san-siro-1787323248210.jpg",
      city: "מילאנו, איטליה",
      capacity: "כ-75,000 מקומות",
      description:
        "הקתדרלה של הכדורגל האיטלקי - הבית המשותף של מילאן ואינטר. היציעים התלולים והמגדלים הסובבים הם חוויה בפני עצמה.",
    },
    city: {
      title: "מילאנו",
      text: "בירת האופנה והעסקים של איטליה - הדואומו, גלריית ויטוריו עמנואלה והנאוויליי בערב. האצטדיון במרחק מטרו קצר מהמרכז.",
    },
    matchday: [
      {
        title: "דרכי הגעה",
        text: "מטרו קו M5 (הסגול) לתחנת San Siro Stadio - היציאה מול האצטדיון. בדרבי הגיעו 90 דקות לפני - הכניסות עמוסות.",
      },
    ],
    honours: ["19 אליפויות איטליה", "7 גביעי אלופות"],
  },
};
