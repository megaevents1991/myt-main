"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { v4 } from 'uuid';

export type TrackingStage = 
  | "VISIT" 
  | "EVENT_SELECTED"
  | "TICKET_SELECTED" 
  | "FLIGHT_SELECTED" 
  | "HOTEL_SELECTED" 
  | "CONFIRMED";

const visitor = async (stage: TrackingStage, data: object, userId: string, affiliateId: string) => {
  if (!affiliateId) return;

  try {
    await fetch("/api/affiliate/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        affId: affiliateId,
        userId,
        stage,
        data
      }),
    });
  } catch (error) {
    console.error("Failed to track affiliate stage:", error);
  }
};

export const orderStage = async (stage: TrackingStage, data: object) => {
  // Get affiliate data
  const affParam = new URLSearchParams(window.location.search).get("aff") || null;
  const storedData = localStorage.getItem('mytData');

  // Early return if no affiliate context exists and no URL param
  if (!affParam && !storedData) {
    return;
  }

  // Parse stored data or initialize empty object
  const affiliateData = storedData ? JSON.parse(storedData) : {};
  let flagSave = false;

  // Assign userId if not exists
  if (!affiliateData.userId) {
    affiliateData.userId = v4();
    flagSave = true;
  }

  // Set affiliateId from stored data or URL param
  if (!affiliateData.affiliateId && affParam) {
    affiliateData.affiliateId = affParam;
  }

  // Save data if we have either userId or affiliateId
  if (flagSave) {
    localStorage.setItem('mytData', JSON.stringify(affiliateData));
  }

  // Send event if we have both userId and affiliateId
  if (affiliateData.userId && affiliateData.affiliateId) {
    visitor(stage, data, affiliateData.userId, affiliateData.affiliateId);
  }
};

export function useAffiliate() {
  const searchParams = useSearchParams();

  useEffect(() => {

    orderStage("VISIT", {});
  
  }, [searchParams]);
}
