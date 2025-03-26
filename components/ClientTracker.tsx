"use client";

import { useEffect } from "react";
import { orderStage } from "../app/hooks/Affiliate";
import { usePathname } from "next/navigation";

export default function ClientTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Run after paint to avoid blocking rendering
    const timer = setTimeout(() => {
      orderStage("VISIT", { path: pathname });
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return null; // No DOM output
}
