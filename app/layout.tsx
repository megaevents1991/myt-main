import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans_Hebrew } from "next/font/google";
import "@mantine/core/styles.css";
import { Suspense, ReactNode } from "react";
import {
  Container,
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";
import Link from "next/link";
import { MYT } from "@/components/ui/myt";
import { AuthProvider } from "./hooks/AuthContext";
import MyStatsig from "./hooks/MyStatsig";

const inter = IBM_Plex_Sans_Hebrew({
  weight: "300",
  style: "normal",
  subsets: ["hebrew"],
});

export const metadata: Metadata = {
  title: "MYT Event Booking",
  description:
    "Book tickets, flights, and hotels for the hottest sports and music events.",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he">
      <body className={inter.className}>
        <MyStatsig>
          <div className="w-screen relative min-h-screen">
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
                  <footer className="py-6 w-full px-4 md:px-6 border-t">
                    <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center h-[2vh]">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
                        © 2023 MYT Events. All rights reserved.
                      </p>
                      <nav className="flex gap-4 sm:gap-6">
                        <Link
                          className="text-xs hover:underline underline-offset-4"
                          href="artists"
                        >
                          Our Artists
                        </Link>
                        <Link
                          className="text-xs hover:underline underline-offset-4"
                          href="#"
                        >
                          Terms of Service
                        </Link>
                        <Link
                          className="text-xs hover:underline underline-offset-4"
                          href="#"
                        >
                          Privacy
                        </Link>
                      </nav>
                    </div>
                  </footer>
                </MantineProvider>
              </Suspense>
            </AuthProvider>
          </div>
        </MyStatsig>
      </body>
    </html>
  );
}
