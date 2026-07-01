import { faqItems } from "@/components/ui/FAQ";
import { StructuredData } from "@/components/StructuredData";
import { FAQStructuredData } from "@/components/FAQStructuredData";
import { getCachedEvents } from "@/lib/eventsData";
import FAQAccordion from "@/components/ui/FAQAccordion";
import { Metadata } from "next";

// Force static generation
export const dynamic = "force-static";
export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: "שאלות נפוצות - מגה איבנטס | כל מה שרציתם לדעת על הזמנת אירועים",
  description:
    "שאלות ותשובות על הזמנת כרטיסים לאירועים, טיסות, מלונות, תנאי ביטול, והכל על השירות של מגה איבנטס. מענה לכל השאלות שלכם.",
  keywords: [
    "שאלות נפוצות",
    "FAQ",
    "הזמנת כרטיסים",
    "תנאי ביטול",
    "טיסות לאירועים",
    "מלונות לאירועים",
    "כרטיסי מופעים",
    "מגה איבנטס",
    "שירות לקוחות",
    "אירועי ספורט",
    "אירועי מוזיקה",
    "חבילות נופש",
    "קבוצות",
    "הנחות",
    "ביטוח נסיעות",
    "מזוודות",
    "ארוחת בוקר",
    "ילדים באירועים",
  ],
  openGraph: {
    title: "שאלות נפוצות - מגה איבנטס",
    description:
      "מענה לכל השאלות שלכם על הזמנת אירועים, טיסות ומלונות. תנאי ביטול, מידע על כרטיסים ועוד.",
    url: "https://www.mega-events.co.il/faq",
    siteName: "מגה איבנטס",
    locale: "he_IL",
    type: "website",
    images: [
      {
        url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
        width: 306,
        height: 200,
        alt: "מגה איבנטס - שאלות נפוצות",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "שאלות נפוצות - מגה איבנטס",
    description:
      "מענה לכל השאלות שלכם על הזמנת אירועים, טיסות ומלונות. תנאי ביטול, מידע על כרטיסים ועוד.",
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
    canonical: "https://www.mega-events.co.il/faq",
  },
};

async function getEventsForStructuredData() {
  try {
    const events = await getCachedEvents();
    return events;
  } catch (error) {
    console.error("FAQ Page: Failed to get events for structured data:", error);
    return { events: [] };
  }
}

export default async function FAQPage() {
  const events = await getEventsForStructuredData();

  return (
    <main>
      {/* Structured Data for enhanced SEO */}
      <StructuredData events={events.events} />
      <FAQStructuredData faqItems={faqItems} />

      {/* Page Header */}
      <header className="w-full py-8 px-4 text-white bg-main" dir="rtl">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl md:text-5xl mb-4">
            שאלות נפוצות
          </h1>
          <p className="text-lg max-w-2xl mx-auto">
            כל מה שרציתם לדעת על הזמנת אירועים עם מגה איבנטס
          </p>
        </div>
      </header>

      {/* FAQ Content */}
      <section className="container mx-auto max-w-[80%] py-8 lg:max-w-[40%]" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="sr-only">שאלות ותשובות</h2>
        <div className="space-y-4" dir="rtl">
          <FAQAccordion items={faqItems} />
        </div>
      </section>

      {/* Additional Help Section */}
      <section className="w-full py-12 bg-muted" dir="rtl" aria-labelledby="help-section">
        <div className="container mx-auto max-w-4xl text-center px-4">
          <h2 id="help-section" className="text-2xl font-bold text-main dark:text-foreground mb-4">
            לא מצאתם את התשובה שחיפשתם?
          </h2>
          <p className="text-lg mb-6">
            הצוות שלנו כאן בשבילכם! צרו איתנו קשר ונשמח לעזור בכל שאלה.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://wa.me/972542002722"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="פתחו שיחה באפליקציית וואטסאפ"
            >
              התחילו איתנו שיחה ב- WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
