"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { v4 } from "uuid";

export type TrackingStage =
  | "VISIT"
  | "EVENT_SELECTED"
  | "TICKET_SELECTED"
  | "FLIGHT_SELECTED"
  | "HOTEL_SELECTED"
  | "CONFIRMED";

const visitor = async (
  stage: TrackingStage,
  data: object,
  userId: string,
  affiliateId: string
) => {
  if (!affiliateId) return;

  try {
    await fetch("/api/affiliate/aff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        affId: affiliateId,
        userId,
        stage,
        data,
      }),
    });
  } catch (e) {
    console.error(e);
  }
};

export const orderStage = async (stage: TrackingStage, data: object) => {
  // Get affiliate data
  const affParam =
    new URLSearchParams(window.location.search).get("utm_source") || new URLSearchParams(window.location.search).get("aff") || null;
  let storedData;
  try {
    storedData = localStorage.getItem("mytData");
  } catch (error) {
    console.error("localStorage access error:", error);
    // add statsig event
  }

  // Early return if no affiliate context exists and no URL param
  if (!affParam && !storedData) {
    return;
  }

  // Parse stored data or initialize empty object (corrupt JSON → start fresh)
  let affiliateData: { userId?: string; affiliateId?: string | null } = {};
  if (storedData) {
    try {
      affiliateData = JSON.parse(storedData);
    } catch (error) {
      console.error("Corrupt mytData in localStorage:", error);
    }
  }
  let flagSave = !!affParam;

  // Assign userId if not exists
  if (!affiliateData.userId) {
    affiliateData.userId = v4();
    flagSave = true;
  }

  // Set affiliateId from stored data or URL param
  if (
    (!affiliateData.affiliateId && affParam) ||
    affiliateData.affiliateId !== affParam
  ) {
    affiliateData.affiliateId = affParam;
  }

  // Save data if we have either userId or affiliateId
  if (flagSave) {
    try {
      localStorage.setItem("mytData", JSON.stringify(affiliateData));
    } catch (error) {
      console.error("localStorage access error:", error);
      // add statsig event
    }
  }

  // Send event if we have both userId and affiliateId
  if (affiliateData.userId && affiliateData.affiliateId) {
    visitor(stage, data, affiliateData.userId, affiliateData.affiliateId);
  }
};

export function useAffiliate() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    orderStage("VISIT", { path: pathname });
  }, [searchParams, pathname]);
}
