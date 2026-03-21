import "./globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Hebrew } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import { Suspense, ReactNode } from "react";
import Script from "next/script";
import {
  Container,
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";
import Link from "next/link";
import { MYT } from "@/components/ui/myt";
import { AuthProvider } from "./hooks/AuthContext";
import MixpanelProvider from "./hooks/Mixpanel";
import { ContactUs } from "@/components/ui/ContactUs";

const inter = IBM_Plex_Sans_Hebrew({
  weight: "300",
  style: "normal",
  subsets: ["hebrew"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
  description:
    "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם. 30 שנות ניסיון, כרטיסים רשמיים, טיסות גמישות ומלונות איכותיים.",
  keywords: [
    "אירועים בחו״ל",
    "כרטיסים להופעות",
    "חבילות ספורט",
    "מגה איבנטס",
    "מבית מגה תיירות",
    "טיסות לאירועים",
    "מלונות לאירועים",
    "כרטיסים רשמיים",
    'הופעות בחו"ל',
    "משחקי כדורגל",
    "קונצרטים",
    "אירועי ספורט",
  ],
  authors: [{ name: "מגה תיירות" }],
  creator: "מגה תיירות",
  publisher: "מגה איבנטס",
  applicationName: "Mega Events",
  generator: "Next.js",
  category: "Travel & Events",
  classification: "Travel Agency, Event Tickets, Tourism",
  metadataBase: new URL("https://mega-events.co.il"),
  alternates: {
    canonical: "https://mega-events.co.il",
    languages: {
      "he-IL": "https://mega-events.co.il",
    },
  },
  openGraph: {
    title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
    description:
      "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם. 32 שנות ניסיון, כרטיסים רשמיים בלבד.",
    url: "https://mega-events.co.il",
    siteName: "Mega Events",
    type: "website",
    locale: "he_IL",
    images: [
      {
        url: "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
        width: 306,
        height: 200,
        alt: "Mega Events - אתר להזמנת חבילות לאירועים בחו״ל",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
    description:
      "מגה איבנטס מבית מגה תיירות - חבילות מותאמות אישית לאירועי מוזיקה וספורט בעולם. 30 שנות ניסיון, כרטיסים רשמיים בלבד.",
    images: [
      "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
    ],
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_CODE", // Replace with actual verification code
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "format-detection": "telephone=no", // Prevents automatic phone number detection
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

const myColor: MantineColorsTuple = [
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: "myColor",
});

const GTM_TAG = process.env.NEXT_PUBLIC_GTM || undefined;
const GTM_URL = `https://www.googletagmanager.com/ns.html?id=${GTM_TAG}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" className="bg-white text-black" suppressHydrationWarning>
      <head>
        <Script id="pagesense" strategy="beforeInteractive">
          {`(function(w,s){var e=document.createElement("script");e.type="text/javascript";e.async=true;e.src="https://cdn.pagesense.io/js/906625420/996fdfc7919046dcb07dd85276671038.js";var x=document.getElementsByTagName("script")[0];x.parentNode.insertBefore(e,x);})(window,"script");`}
        </Script>
        <Script id="scroll-restoration" strategy="beforeInteractive">
          {`
          if (typeof window !== 'undefined') {
            // Disable automatic scroll restoration
            if ('scrollRestoration' in history) {
              history.scrollRestoration = 'manual';
            }
            // Ensure page starts at top on load
            window.addEventListener('load', function() {
              setTimeout(() => {
                window.scrollTo(0, 0);
              }, 0);
            });
          }
          `}
        </Script>
        {GTM_TAG && (
          <Script id="gtm-head" strategy="afterInteractive">
            {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_TAG}');
          `}
          </Script>
        )}
      </head>
      <body className={`${inter.className} text-black`}>
        {GTM_TAG && (
          <noscript>
            <iframe
              src={GTM_URL}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            ></iframe>
          </noscript>
        )}
        <div className="w-screen relative min-h-screen">
          <MixpanelProvider />
          <AuthProvider>
            <Suspense>
              <MantineProvider theme={theme}>
                <Container className="py-2 lg:py-4" fluid bg={"#05203C"}>
                  <div className="flex justify-center sm:justify-between">
                    <div className="flex">
                      <ContactUs />
                    </div>
                    <Link href="/">
                      <MYT className="scale-[0.85] md:scale-100" />
                    </Link>
                  </div>
                </Container>
                {children}
                <footer
                  className="pt-6 pb-12 w-full px-4 md:px-6 border-t bg-[#05203C]"
                  dir="rtl"
                >
                  <p className="container mx-auto mb-4 text-white">
                    לידיעתך, באתר זה נעשה שימוש בקבצי Cookies. המשך גלישה באתר
                    מהווה הסכמה לשימוש זה. למידע נוסף ניתן לעיין במדיניות
                    הפרטיות של האתר.
                  </p>{" "}
                  <div className="container mx-auto text-white mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-y-4 sm:gap-0">
                      <nav className="flex flex-wrap gap-x-4 gap-y-3 sm:gap-x-6 sm:gap-y-4 font-bold justify-center sm:justify-start">
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/about"
                        >
                          אודותינו
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/faq"
                        >
                          שאלות נפוצות
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/artists"
                        >
                          האומנים שלנו
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/football"
                        >
                          הקבוצות שלנו
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/terms"
                        >
                          תנאי שימוש
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/privacy"
                        >
                          מדיניות פרטיות
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/accessibility"
                        >
                          הצהרת נגישות
                        </Link>
                        <Link
                          className="text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
                          href="/cancellation"
                        >
                          ביטול הזמנה
                        </Link>
                      </nav>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                      {" "}
                      {/* Social Media Links */}
                      <div className="flex gap-4">
                        <Link
                          href="https://www.facebook.com/megatravelil"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group transition-all duration-300 hover:scale-110 hover:drop-shadow-lg"
                          aria-label="עקבו אחרינו בפייסבוק"
                        >
                          {" "}
                          <div className="w-6 h-6 bg-[#1877F2] rounded-lg flex items-center justify-center group-hover:bg-[#166FE5] transition-all duration-300 shadow-md">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                          </div>
                        </Link>
                        <Link
                          href="https://www.instagram.com/mega_events_il"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group transition-all duration-300 hover:scale-110 hover:drop-shadow-lg"
                          aria-label="עקבו אחרינו באינסטגרם"
                        >
                          {" "}
                          <div className="w-6 h-6 bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] rounded-lg flex items-center justify-center group-hover:shadow-xl transition-all duration-300 shadow-md relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] opacity-100 group-hover:opacity-90 transition-opacity duration-300"></div>
                            <svg
                              className="w-3 h-3 text-white relative z-10"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                          </div>
                        </Link>
                      </div>
                      <p className="text-xs sm:text-sm text-center sm:text-left">
                        © 2025 מגה איבנטס מבית מגה תיירות. כל הזכויות שמורות.
                      </p>
                      </div>
                    </div>
                  </div>
                </footer>
              </MantineProvider>
            </Suspense>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
