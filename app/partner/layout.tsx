import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
