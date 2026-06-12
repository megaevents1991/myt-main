import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Assistant, Rubik } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import { Suspense, ReactNode } from "react";
import Script from "next/script";
import {
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";
import Link from "next/link";
import { AuthProvider } from "./hooks/AuthContext";
import MixpanelProvider from "./hooks/Mixpanel";
import { Header } from "@/components/Header";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { FooterMarquee } from "@/components/ui/FooterMarquee";

// Body face. Assistant mirrors the Figma body (Inter) feel while rendering Hebrew
// RTL correctly — free Google substitute for the brand-book body font.
const fontSans = Assistant({
  weight: ["400", "500", "600", "700"],
  style: "normal",
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-sans",
});

// Display face for headings + logo wordmark. Rubik is a warm geometric sans with
// strong Hebrew + Latin coverage — free substitute for the proprietary Fedra Sans.
const fontDisplay = Rubik({
  weight: ["600", "700", "800"],
  style: "normal",
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-display",
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
  metadataBase: new URL("https://www.mega-events.co.il"),
  alternates: {
    canonical: "https://www.mega-events.co.il",
    languages: {
      "he-IL": "https://www.mega-events.co.il",
    },
  },
  openGraph: {
    title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
    description:
      "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם. 32 שנות ניסיון, כרטיסים רשמיים בלבד.",
    url: "https://www.mega-events.co.il",
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
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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

// MegaEvents 2.0 pulse-mint (#5BFF95) — tonal ramp so Mantine components match
// the brand-book primary. Shade 4 is the exact brand neon.
const myColor: MantineColorsTuple = [
  "#E6FFEF",
  "#C2FFD8",
  "#99FFBE",
  "#70FFA4",
  "#5BFF95",
  "#2EE875",
  "#15C95C",
  "#0FA049",
  "#0A7637",
  "#064D24",
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: "myColor",
  primaryShade: 4,
});

const GTM_TAG = process.env.NEXT_PUBLIC_GTM || undefined;
const GTM_URL = `https://www.googletagmanager.com/ns.html?id=${GTM_TAG}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
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
        <meta name="google-site-verification" content="fMs3lMOpEKejbkM0B1uDbcQJf0bdo-OfRl0wUoWfJAM" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`
          try {
            var t = localStorage.getItem('myt-theme');
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            if (t === 'dark') document.documentElement.classList.add('dark');
          } catch (e) {}
          `}
        </Script>
      </head>
      <body className="font-sans">
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
        {/* w-full (not w-screen — 100vw overflows past the scrollbar) + clip
            so decorative overflow never causes sideways scrolling on mobile */}
        <div className="w-full relative min-h-screen overflow-x-clip">
          <MixpanelProvider />
          <AuthProvider>
            <Suspense>
              <MantineProvider theme={theme}>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-2 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
                >
                  דלג לתוכן הראשי
                </a>
                <Header />
                <main id="main-content">{children}</main>
                <footer className="w-full border-t border-main-foreground/10 bg-main px-4 pb-12 pt-8 text-main-foreground md:px-6">
                  <FooterMarquee />
                  <div className="container mx-auto">
                    <p className="mb-6 text-sm text-main-foreground/80">
                      לידיעתך, באתר זה נעשה שימוש בקבצי Cookies. המשך גלישה באתר
                      מהווה הסכמה לשימוש זה. למידע נוסף ניתן לעיין במדיניות
                      הפרטיות של האתר.
                    </p>
                    <div className="flex flex-col items-center gap-y-6 sm:flex-row sm:justify-between sm:gap-0">
                      <nav
                        aria-label="ניווט תחתון"
                        className="flex flex-wrap justify-center gap-x-4 gap-y-3 font-bold sm:justify-start sm:gap-x-6"
                      >
                        {[
                          { href: "/about", label: "אודותינו" },
                          { href: "/faq", label: "שאלות נפוצות" },
                          { href: "/artists", label: "האומנים שלנו" },
                          { href: "/blog", label: "הבלוגים שלנו" },
                          { href: "/football", label: "הקבוצות שלנו" },
                          { href: "/terms", label: "תנאי שימוש" },
                          { href: "/privacy", label: "מדיניות פרטיות" },
                          { href: "/accessibility", label: "הצהרת נגישות" },
                          { href: "/cancellation", label: "ביטול הזמנה" },
                        ].map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="whitespace-nowrap text-xs underline-offset-4 hover:underline sm:text-sm"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </nav>
                      <div className="flex flex-col items-center gap-4 sm:flex-row">
                        <SocialLinks />
                        <p className="text-center text-xs sm:text-start sm:text-sm">
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
