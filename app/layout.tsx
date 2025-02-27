import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans_Hebrew } from "next/font/google";
import "@mantine/core/styles.css";
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

const inter = IBM_Plex_Sans_Hebrew({
  weight: "300",
  style: "normal",
  subsets: ["hebrew"],
});

export const metadata: Metadata = {
  title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
  description:
    "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם.",
  keywords: ["אירועים בחו״ל", "כרטיסים להופעות", "חבילות ספורט", "מגה איבנטס"], // Helps SEO
  applicationName: "Mega Events",
  generator: "Next.js",
  metadataBase: new URL("https://mega-events.co.il"), // Base URL for relative links
  alternates: {
    canonical: "https://mega-events.co.il",
  },
  openGraph: {
    title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
    description:
      "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם.",
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
    card: "summary", //TODO: summary_large_image with 1200x630px image
    title: "מגה איבנטס. כל האירועים השווים בחו״ל במקום אחד",
    description:
      "מגה איבנטס מבית מגה תיירות, האתר היחיד בישראל בו אתם בונים לעצמכם את החבילה המשתלמת ביותר לכל אירועי המוזיקה והספורט השווים בעולם.",
    images: [
      "https://fandqafngybfdyslofmr.supabase.co/storage/v1/object/public/public_resources//logo200_300.png",
    ], // Same as Open Graph image
    //creator: "@your_twitter_handle", // Optional, if you have a Twitter account
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "google-site-verification": "YOUR_GOOGLE_VERIFICATION_CODE", // Optional for Google Search Console
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
    <html lang="he">
      {GTM_TAG && (
        <head>
          <Script id="gtm-head" strategy="afterInteractive">
            {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_TAG}');
          `}
          </Script>
        </head>
      )}
      <body className={inter.className}>
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
                <Container className="pt-4 min-h-200" fluid bg={"#05203C"}>
                  <div className="flex scale-25 justify-center md:justify-end">
                    <Link href="/">
                      <MYT className="scale-75 md:scale-100" />
                    </Link>
                  </div>
                </Container>
                {children}
                <footer className="py-6 w-full px-4 md:px-6 border-t" dir="rtl">
                  <p className="container mx-auto mb-4 text-gray-500 dark:text-gray-400">
                    לידיעתך, באתר זה נעשה שימוש בקבצי Cookies. המשך גלישה באתר
                    מהווה הסכמה לשימוש זה.למידע נוסף ניתן לעיין במדיניות הפרטיות
                    של האתר.
                  </p>
                  <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center h-[2vh]">
                    <nav className="flex gap-4 sm:gap-6">
                      <Link
                        className="text-sm hover:underline underline-offset-4"
                        href="/artists"
                      >
                        האומנים שלנו
                      </Link>
                      <Link
                        className="text-sm hover:underline underline-offset-4"
                        href="/football"
                      >
                        הקבוצות שלנו
                      </Link>
                      <Link
                        className="text-sm hover:underline underline-offset-4"
                        href="/terms"
                      >
                        תנאי שימוש
                      </Link>
                      <Link
                        className="text-sm hover:underline underline-offset-4"
                        href="/cancellation"
                      >
                        ביטול הזמנה
                      </Link>
                    </nav>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
                      © 2025 Megaevents. כל הזכויות שמורות.
                    </p>
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
