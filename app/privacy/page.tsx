import { StructuredData } from "@/components/StructuredData";
import { getCachedEvents } from "@/lib/eventsData";
import { Metadata } from "next";

// Force static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: "מדיניות פרטיות - MegaEvents | הגנת הפרטיות והמידע האישי",
  description:
    "מדיניות הפרטיות של MegaEvents - הגנת המידע האישי, זכויות המשתמשים, ועמידה בחוק הגנת הפרטיות הישראלי תיקון 13.",
  keywords: [
    "מדיניות פרטיות",
    "הגנת הפרטיות",
    "מידע אישי",
    "חוק הגנת הפרטיות",
    "תיקון 13",
    "MegaEvents",
    "מגה איבנטס",
    "זכויות משתמשים",
    "אבטחת מידע",
    "GDPR",
    "cookies",
    "אנליטיקה",
  ],
  openGraph: {
    title: "מדיניות פרטיות - MegaEvents",
    description:
      "מדיניות הפרטיות של MegaEvents - הגנת המידע האישי, זכויות המשתמשים, ועמידה בחוק הגנת הפרטיות הישראלי.",
    url: "https://mega-events.co.il/privacy",
    siteName: "מגה איבנטס",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
        width: 306,
        height: 200,
        alt: "מגה איבנטס - מדיניות פרטיות",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "מדיניות פרטיות - MegaEvents",
    description:
      "מדיניות הפרטיות של MegaEvents - הגנת המידע האישי וזכויות המשתמשים.",
    images: [
      "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
    ],
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://mega-events.co.il/privacy",
  },
};

async function getEventsForStructuredData() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error(
      "Privacy Page: Failed to get events for structured data:",
      error
    );
    return { events: [] };
  }
}

export default async function PrivacyPage() {
  const events = await getEventsForStructuredData();

  return (
    <main>
      {/* Structured Data for enhanced SEO */}
      <StructuredData events={events.events} />

      {/* Page Header */}
      <header className="w-full py-8 px-4 text-white bg-main" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
            מדיניות פרטיות - MegaEvents
          </h1>
          <p className="text-lg max-w-2xl mx-auto">
            עדכון אחרון: 10.08.2025
          </p>
        </div>
      </header>

      {/* Main Privacy Content */}
      <section className="w-full py-12 bg-white" dir="rtl">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-8 text-lg leading-relaxed">
              ב-MegaEvents אנו מחויבים להגן על הפרטיות של המשתמשים שלנו ולעמוד בדרישות החוק הישראלי, כולל תיקון 13 לחוק הגנת הפרטיות. מדיניות פרטיות זו מסבירה איזה מידע אנו אוספים, כיצד אנו משתמשים בו, זכויות המשתמשים שלך ואמצעי האבטחה שלנו.
            </p>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                1. מידע אישי שנאסף
              </h2>
              <p className="text-gray-700 mb-4">
                בעת השימוש באתר אנו עשויים לאסוף את המידע הבא:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
                <li>שם מלא</li>
                <li>כתובת אימייל</li>
                <li>מספר טלפון</li>
                <li>מידע על הזמנות שבוצעו (אירועים, טיסות, מלונות)</li>
              </ul>
              <div className="bg-blue-50 border-r-4 border-blue-400 p-4 mb-6">
                <p className="text-gray-700">
                  <strong>שימו לב:</strong> פרטי התשלום עוברים ישירות לסולק אשראי PCI compliant ואינם נשמרים אצלנו.
                </p>
              </div>
              <p className="text-gray-700 mb-4">
                בנוסף, האתר אוסף מידע באופן אוטומטי באמצעות:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Google Analytics</li>
                <li>Mixpanel</li>
                <li>Facebook Pixel</li>
              </ul>
              <p className="text-gray-700 mt-4">
                לצורך ניתוח סטטיסטי ושיפור חוויית המשתמש.
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                2. מטרות השימוש במידע
              </h2>
              <p className="text-gray-700 mb-4">
                אנו משתמשים במידע האישי שלך אך ורק לצרכים הבאים:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>מתן השירותים שהזמנת - רכישת חבילות תיירות, לינה, טיסות ואירועים.</li>
                <li>שיווק והצעות מותאמות אישית - אך רק אם נתת הסכמה מראש (double opt-in).</li>
                <li>ניתוח סטטיסטי לשיפור חוויית המשתמש באתר ובשירותים.</li>
              </ol>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                3. שיתוף מידע עם צדדים שלישיים
              </h2>
              <p className="text-gray-700 mb-4">
                מידע אישי עשוי להיות משותף עם:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-6">
                <li>ספקי תשלום (PCI compliant) - אין לנו גישה למידע הפיננסי.</li>
                <li>ספקי שירותי אנליטיקה (Google Analytics, Mixpanel).</li>
                <li>ספקי שירותי שיווק - רק אם תסכים לקבל דיוור שיווקי בעתיד.</li>
              </ul>
              <p className="text-gray-700">
                אנו מתחייבים לא לשתף את המידע שלך עם צדדים אחרים ללא הסכמתך, למעט דרישות חוקיות.
              </p>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                4. זכויות המשתמשים
              </h2>
              <p className="text-gray-700 mb-4">
                לפי חוק הגנת הפרטיות, יש לך את הזכויות הבאות:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-gray-700 mb-6">
                <li><strong>זכות העיון</strong> - לבקש לדעת איזה מידע אישי נשמר עליך.</li>
                <li><strong>זכות התיקון</strong> - לבקש לתקן מידע אישי שגוי או לא מדויק.</li>
                <li><strong>זכות המחיקה</strong> - לבקש למחוק את המידע האישי שלך, למעט מידע הכרחי לעמידה בחובות חוקיות (למשל חיוב כספי או שמירה על ספרי חשבונות).</li>
                <li><strong>זכות ההתנגדות</strong> - להתנגד לשימוש במידע שלך לצרכים שאינם חיוניים, כגון שיווק ישיר.</li>
              </ol>
              <div className="bg-green-50 border-r-4 border-green-400 p-4">
                <p className="text-gray-700">
                  <strong>כיצד לממש זכויות אלו:</strong><br />
                  ניתן לשלוח בקשה לכתובת: <a href="mailto:privacy@mega-events.co.il" className="text-blue-600 hover:underline">privacy@mega-events.co.il</a>.
                </p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                5. Cookies ומעקב
              </h2>
              <p className="text-gray-700 mb-4">
                האתר משתמש בקבצי Cookies למטרות שונות:
              </p>
              <ul className="list-disc list-inside space-y-3 text-gray-700 mb-6">
                <li><strong>פונקציונליים:</strong> הכרחיים להפעלת האתר (שמירת סשן, סל קניות וכו&apos;).</li>
                <li><strong>אנליטיים:</strong> לאיסוף מידע סטטיסטי על השימוש באתר.</li>
                <li><strong>שיווקיים:</strong> למעקב והצגת פרסומות מותאמות אישית.</li>
              </ul>
              <p className="text-gray-700">
                ניתן לשלוט בהגדרות ה-Cookies דרך דפדפן האינטרנט שלך.
                בעתיד, אם תחליט לקבל דיוור שיווקי - יופיע <strong>checkbox הסכמה</strong> וניתן יהיה להסיר את עצמך מהדיוור בכל עת.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                6. אבטחת מידע
              </h2>
              <p className="text-gray-700 mb-4">
                אנו נוקטים באמצעי אבטחה מתקדמים כדי להגן על המידע האישי שלך:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>חיבור מאובטח באמצעות HTTPS</li>
                <li>הצפנת מידע רגיש, מסד הנתונים מאובטח בגישה ומנוחה (at rest)</li>
                <li>הרשאות גישה חיוניות בלבד ומוגבלות למידע</li>
                <li>הגנת סייבר מתקדמת באמצעות כלים מתקדמים וטכנולוגיות ענן מובילות</li>
                <li>גיבויים סדירים</li>
              </ul>
            </div>

            {/* Section 7 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                7. עדכונים ושינויים במדיניות
              </h2>
              <p className="text-gray-700">
                אנו רשאים לעדכן מדיניות פרטיות זו מעת לעת. עדכונים יפורסמו באתר ותאריך העדכון יעדכן בחלק העליון של הדף.
              </p>
            </div>

            {/* Section 8 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                8. יצירת קשר
              </h2>
              <p className="text-gray-700">
                לכל שאלה או פנייה בנוגע לפרטיות:<br />
                <strong>דואר אלקטרוני:</strong> <a href="mailto:privacy@mega-events.co.il" className="text-blue-600 hover:underline">privacy@mega-events.co.il</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-12 bg-main text-white" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 className="text-2xl font-bold mb-6">
            שאלות נוספות על מדיניות הפרטיות?
          </h2>
          <p className="mb-8 text-lg">
            צוות השירות שלנו כאן כדי לעזור לכם להבין את זכויותיכם והגנת הפרטיות שלכם
          </p>
          <a
            href="mailto:privacy@mega-events.co.il"
            className="bg-secondary text-white px-8 py-3 rounded-lg font-bold hover:bg-secondary/80 transition-colors inline-block"
          >
            צרו קשר בנושא פרטיות
          </a>
        </div>
      </section>
    </main>
  );
}
