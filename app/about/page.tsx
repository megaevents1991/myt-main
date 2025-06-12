import MegaEventsSection from "@/components/ui/aboutUsMega";
import { StructuredData } from "@/components/StructuredData";
import { getCachedEvents } from "../api/eventsData";
import { Metadata } from "next";

// Force static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: "אודותינו - מגה איבנטס | 30 שנות ניסיון בתיירות ואירועים",
  description:
    "הכירו את מגה איבנטס מבית מגה תיירות - 30 שנות ניסיון בתחום התיירות והאירועים. חבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם עם גמישות מלאה.",
  keywords: [
    "מגה איבנטס",
    "מגה תיירות",
    "אודותינו",
    "30 שנות ניסיון",
    "תיירות",
    "אירועים",
    "חבילות מותאמות אישית",
    "אירועי מוזיקה",
    "אירועי ספורט",
    "כרטיסים רשמיים",
    "טיסות",
    "מלונות",
    "חוויות נסיעה",
    "שירות מקצועי",
    "אחריות מלאה",
    "צוות מומחים",
  ],
  openGraph: {
    title: "אודותינו - מגה איבנטס",
    description:
      "הכירו את מגה איבנטס מבית מגה תיירות - 30 שנות ניסיון בתחום התיירות והאירועים. חבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם.",
    url: "https://mega-events.co.il/about",
    siteName: "מגה איבנטס",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
        width: 306,
        height: 200,
        alt: "מגה איבנטס - אודותינו",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "אודותינו - מגה איבנטס",
    description:
      "הכירו את מגה איבנטס מבית מגה תיירות - 30 שנות ניסיון בתחום התיירות והאירועים.",
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
    canonical: "https://mega-events.co.il/about",
  },
};

async function getEventsForStructuredData() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error(
      "About Page: Failed to get events for structured data:",
      error
    );
    return { events: [] };
  }
}

export default async function AboutPage() {
  const events = await getEventsForStructuredData();

  return (
    <main>
      {/* Structured Data for enhanced SEO */}
      <StructuredData events={events.events} />

      {/* Page Header */}
      <header className="w-full py-8 px-4 text-white bg-main" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
            אודות מגה איבנטס
          </h1>
          <p className="text-lg max-w-2xl mx-auto">
            30 שנות ניסיון בתחום התיירות והאירועים - מבית מגה תיירות
          </p>
        </div>
      </header>

      {/* Main About Content */}
      <MegaEventsSection />

      {/* Additional Company Information */}
      <section className="w-full py-12 bg-white" dir="rtl">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-2xl font-bold text-main text-center mb-8">
            המחויבות שלנו אליכם
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                🎯 התאמה אישית מלאה
              </h3>
              <p className="text-gray-700">
                כל חבילה מותאמת במיוחד עבורכם - בחרו את הטיסות שמתאימות ללוח
                הזמנים שלכם, המלונות שמתאימים לתקציב ולסגנון שלכם, והרכיבו את
                החוויה המושלמת.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                ✅ אחריות מלאה
              </h3>
              <p className="text-gray-700">
                אנו מתחייבים לכרטיסים רשמיים בלבד ונושאים באחריות מלאה על כל
                ההזמנות. הצוות המקצועי שלנו מלווה אתכם לאורך כל הדרך.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                🌟 ניסיון של עשרות שנים
              </h3>
              <p className="text-gray-700">
                מגה תיירות פועלת במשך 31 שנה ויש לנו ניסיון עשיר בארגון נסיעות
                ואירועים. אלפי לקוחות מרוצים בחרו בנו לחוויות הבלתי נשכחות שלהם.
              </p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                📞 תמיכה 24/7
              </h3>{" "}
              <p className="text-gray-700">
                הצוות שלנו זמין עבורכם גם כשאתם בחו&quot;ל. אנחנו כאן לעזור בכל
                שאלה או בעיה שעלולה להתעורר במהלך הנסיעה שלכם.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-12 bg-main text-white" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 className="text-2xl font-bold mb-4">
            מוכנים להתחיל לתכנן את החוויה הבאה שלכם?
          </h2>
          <p className="text-lg mb-6">
            צרו איתנו קשר היום ותנו לנו לעזור לכם ליצור זיכרונות בלתי נשכחים
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://wa.me/972542002722"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-600 transition-colors"
            >
              התחילו איתנו שיחה ב- WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
