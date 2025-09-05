import { StructuredData } from "@/components/StructuredData";
import { getCachedEvents } from "@/lib/eventsData";
import { Metadata } from "next";

// Force static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: "הצהרת נגישות - MegaEvents | נגישות דיגיטלית ושוויון הזדמנויות",
  description:
    "הצהרת הנגישות של MegaEvents - מחויבות לנגישות דיגיטלית, עמידה בתקן הישראלי 5568 ותקן WCAG 2.0 ברמה AA לאנשים עם מוגבלות.",
  keywords: [
    "הצהרת נגישות",
    "נגישות דיגיטלית",
    "תקן ישראלי 5568",
    "WCAG 2.0",
    "WCAG 2.1",
    "נגישות אתרים",
    "MegaEvents",
    "מגה איבנטס",
    "אנשים עם מוגבלות",
    "שוויון הזדמנויות",
    "קוראי מסך",
    "נגישות מקלדת",
  ],
  openGraph: {
    title: "הצהרת נגישות - MegaEvents",
    description:
      "הצהרת הנגישות של MegaEvents - מחויבות לנגישות דיגיטלית ועמידה בתקנות הנגישות הישראליות.",
    url: "https://mega-events.co.il/accessibility",
    siteName: "מגה איבנטס",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
        width: 306,
        height: 200,
        alt: "מגה איבנטס - הצהרת נגישות",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "הצהרת נגישות - MegaEvents",
    description:
      "הצהרת הנגישות של MegaEvents - מחויבות לנגישות דיגיטלית ועמידה בתקנות הנגישות.",
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
    canonical: "https://mega-events.co.il/accessibility",
  },
};

async function getEventsForStructuredData() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error(
      "Accessibility Page: Failed to get events for structured data:",
      error
    );
    return { events: [] };
  }
}

export default async function AccessibilityPage() {
  const events = await getEventsForStructuredData();

  return (
    <main>
      {/* Structured Data for enhanced SEO */}
      <StructuredData events={events.events} />

      {/* Page Header */}
      <header className="w-full py-8 px-4 text-white bg-main" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
            הצהרת נגישות
          </h1>
          <p className="text-lg max-w-2xl mx-auto">
            עדכון אחרון: 10.08.2025
          </p>
        </div>
      </header>

      {/* Main Accessibility Content */}
      <section className="w-full py-12 bg-white" dir="rtl">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-8 text-lg leading-relaxed">
              אנו ב<strong>מגה איבנטס</strong> רואים חשיבות רבה במתן שירות שוויוני לכלל הציבור ובשיפור הנגישות באתר ובשירותים הדיגיטליים שלנו, מתוך מטרה לאפשר לאנשים עם מוגבלות להשתמש בשירותי האתר באופן שוויוני, נגיש ונוח ככל האפשר.
            </p>

            <p className="text-gray-700 mb-12 text-lg leading-relaxed">
              האתר פותח בהתאם להנחיות הנגישות בתקן הישראלי 5568 לנגישות אתרי אינטרנט, אשר מבוסס על תקן בינלאומי <strong>WCAG 2.0 ברמה AA</strong>. כמו כן, הוטמעו באתר התאמות נוספות לפי ההנחיות העדכניות של WCAG 2.1.
            </p>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                התאמות נגישות שבוצעו באתר
              </h2>
              <ul className="list-disc list-inside space-y-3 text-gray-700">
                <li>התאמות לניווט מלא באמצעות מקלדת בלבד.</li>
                <li>שימוש במבנה סמנטי תקין וכותרות היררכיות.</li>
                <li>הוספת תגיות ARIA ותיאורים קוליים לרכיבים אינטראקטיביים.</li>
                <li>אפשרות לדלג לתוכן העיקרי (&ldquo;Skip Link&rdquo;).</li>
                <li>טפסים עם תוויות ותיאורים נגישים.</li>
                <li>הודעות שגיאה וסטטוס קריאים לקוראי מסך.</li>
                <li>התאמת צבעים ויחסי ניגוד כנדרש בתקנות.</li>
                <li>הוספת טקסט חלופי (alt) לתמונות ולמדיה.</li>
                <li>מודלים, קרוסלות ורכיבים דינמיים עם ניהול פוקוס ונגישות לקוראי מסך.</li>
              </ul>
            </div>

            {/* Section 2 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                תאימות דפדפנים ועזרים
              </h2>
              <p className="text-gray-700 mb-4">
                האתר מותאם לצפייה בדפדפנים: Chrome, Firefox, Safari, Edge.
              </p>
              <p className="text-gray-700">
                האתר נבדק עם קוראי מסך נפוצים (NVDA, JAWS, VoiceOver).
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                מסמכים ותכנים חיצוניים
              </h2>
              <p className="text-gray-700">
                באתר עשויים להופיע מסמכים להורדה (כגון PDF). אנו פועלים לוודא כי מסמכים אלו יהיו נגישים ככל האפשר. במידה שנתקלתם במסמך שאינו נגיש - נשמח לסייע ולהעמיד עבורכם גרסה נגישה.
              </p>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                פטורים והקלות
              </h2>
              <p className="text-gray-700">
                ייתכנו חלקים באתר או מערכות חיצוניות (תוכן צד ג&apos;) שאינם בשליטתנו ואינם נגישים במלואם.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-main mb-6">
                לשאלות בנושא נגישות
              </h2>
              <div className="bg-blue-50 border-r-4 border-blue-400 p-6">
                <p className="text-gray-700 mb-4">
                  <strong>ניתן לפנות בטלפון:</strong> <a href="tel:054-200-2722" className="text-blue-600 hover:underline font-bold">054-200-2722</a>
                </p>
                <p className="text-gray-700">
                  <strong>דוא״ל:</strong> <a href="mailto:accessibility@mega-events.co.il" className="text-blue-600 hover:underline">accessibility@mega-events.co.il</a>
                </p>
                <p className="text-gray-700 mt-4">
                  רכז/ת הנגישות ישמח/תשמח לעמוד לרשותכם בכל שאלה, בקשה לקבלת מידע או הצעת שיפור בנושא נגישות.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-12 bg-main text-white" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 className="text-2xl font-bold mb-6">
            שאלות נוספות על נגישות האתר?
          </h2>
          <p className="mb-8 text-lg">
            אנו מחויבים לשפר ללא הרף את נגישות האתר ולספק חוויה שוויונית לכל המשתמשים
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="tel:054-200-2722"
              className="bg-secondary text-white px-8 py-3 rounded-lg font-bold hover:bg-secondary/80 transition-colors inline-block"
            >
              התקשרו: 054-200-2722
            </a>
            <a
              href="mailto:accessibility@mega-events.co.il"
              className="bg-white text-main px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors inline-block"
            >
              שלחו מייל
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
