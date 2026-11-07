import { ReactNode } from "react";
import type { Metadata } from "next";

// /partner and /partner/login only redirect to /agent: keep them out of the index.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return children;
}
