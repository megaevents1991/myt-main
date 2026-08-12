/**
 * The booking funnel this app itself records in `affiliates_tracking` (see
 * app/api/affiliate/aff/route.ts's VALID_STAGES - must match exactly).
 * Ported from myt-backoffice's lib/partner-funnel.ts.
 */

export const FUNNEL_STAGES = [
  "VISIT",
  "EVENT_SELECTED",
  "TICKET_SELECTED",
  "FLIGHT_SELECTED",
  "HOTEL_SELECTED",
  "CONFIRMED",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_LABELS_HE: Record<FunnelStage, string> = {
  VISIT: "נכנסו לאתר",
  EVENT_SELECTED: "בחרו אירוע",
  TICKET_SELECTED: "בחרו כרטיסים",
  FLIGHT_SELECTED: "בחרו טיסה",
  HOTEL_SELECTED: "בחרו מלון",
  CONFIRMED: "הגיעו לתשלום",
};

export interface PartnerTraffic {
  /**
   * Distinct visitors who reached each stage at least once. A visitor who
   * confirms is counted in every stage they passed through, so the list reads
   * as a funnel rather than a breakdown.
   */
  byStage: { stage: FunnelStage; label: string; visitors: number }[];
  totalVisitors: number;
  /** False when nothing has ever been recorded for this partner. */
  hasData: boolean;
}

export function emptyTraffic(): PartnerTraffic {
  return {
    byStage: FUNNEL_STAGES.map((stage) => ({
      stage,
      label: FUNNEL_STAGE_LABELS_HE[stage],
      visitors: 0,
    })),
    totalVisitors: 0,
    hasData: false,
  };
}
