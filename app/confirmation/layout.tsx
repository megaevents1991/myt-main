import { ReactNode } from "react";
import type { Metadata } from "next";

// One customer's order confirmation: never in a search index. The page itself
// is a client component, so the metadata lives here.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ConfirmationLayout({ children }: { children: ReactNode }) {
  return children;
}
