import MegaEventsSection from "@/components/ui/aboutUsMega";
import { StructuredData } from "@/components/StructuredData";
import { getCachedEvents } from "@/lib/eventsData";
import { Metadata } from "next";
import Link from "next/link";

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
    url: "https://www.mega-events.co.il/about",
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
    canonical: "https://www.mega-events.co.il/about",
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
      <section className="w-full py-12 bg-white" dir="rtl" aria-labelledby="commitments-heading">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 id="commitments-heading" className="text-2xl font-bold text-main text-center mb-8">
            המחויבות שלנו אליכם
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Custom service card */}
            <article className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                <span aria-hidden="true">🎯</span> התאמה אישית מלאה
              </h3>
              <p className="text-gray-700">
                כל חבילה מותאמת במיוחד עבורכם - בחרו את הטיסות שמתאימות ללוח
                הזמנים שלכם, המלונות שמתאימים לתקציב ולסגנון שלכם, והרכיבו את
                החוויה המושלמת.
              </p>
            </article>
            {/* Warranty card */}
            <article className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                <span aria-hidden="true">✅</span> אחריות מלאה
              </h3>
              <p className="text-gray-700">
                אנו מתחייבים לכרטיסים רשמיים בלבד ונושאים באחריות מלאה על כל
                ההזמנות. הצוות המקצועי שלנו מלווה אתכם לאורך כל הדרך.
              </p>
            </article>
            {/* Experience card */}
            <article className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                <span aria-hidden="true">🌟</span> ניסיון של עשרות שנים
              </h3>
              <p className="text-gray-700">
                מגה תיירות פועלת במשך 31 שנה ויש לנו ניסיון עשיר בארגון נסיעות
                ואירועים. אלפי לקוחות מרוצים בחרו בנו לחוויות הבלתי נשכחות שלהם.
              </p>
            </article>
            {/* Support card */}
            <article className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-bold text-main mb-4">
                <span aria-hidden="true">📞</span> תמיכה 24/7
              </h3>
              <p className="text-gray-700">
                הצוות שלנו זמין עבורכם גם כשאתם בחו&quot;ל. אנחנו כאן לעזור בכל
                שאלה או בעיה שעלולה להתעורר במהלך הנסיעה שלכם.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="w-full py-12 bg-main text-white" dir="rtl" aria-labelledby="cta-heading">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 id="cta-heading" className="text-2xl font-bold mb-10">
            מוכנים להתחיל לתכנן את החוויה הבאה שלכם?
          </h2>
          <Link
            href="/"
            className="bg-secondary text-secondary-foreground px-16 py-3 rounded-lg font-bold hover:bg-secondary/80 transition-colors inline-block focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-secondary"
            aria-label="עברו לעמוד הראשי להזמנת אירועים"
          >
            הזמינו עכשיו!
          </Link>
        </div>
      </section>
    </main>
  );
}
