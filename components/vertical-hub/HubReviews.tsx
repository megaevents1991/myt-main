"use client";

import { ElfsightWidget } from "@/components/ui/elfReviews";

/**
 * "לקוחות משתפים" - the same Elfsight Google-reviews widget as the homepage.
 * Client wrapper because `next/dynamic` with `ssr: false` (inside elfReviews)
 * may not be imported directly from a Server Component.
 */
export const HubReviews = () => (
  <ElfsightWidget widgetId="58ddc878-9ffa-4f89-b892-04ed7ec54eb7" lazy="first-activity" />
);
