"use server";

import { requirePartner } from "@/lib/partner-auth";
import { supabase } from "@/lib/supabase";

/**
 * Coupons for the agent/influencer area - ported from the backoffice partner
 * portal (`getPortalCoupons` in lib/actions/portal-actions.ts there). Pure
 * read-only passthrough of the partner's own coupons, same shared `coupons`
 * table, no business-logic transforms.
 */

export interface PortalCoupon {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number | null;
  times_paid: number | null;
  is_active: boolean;
  event_id: number | null;
}

// Shown to both agents and influencers - requirePartner() is the only guard
// (no role check), matching getPortalCoupons's own guard in the backoffice.
export async function getPortalCoupons(): Promise<PortalCoupon[]> {
  const session = await requirePartner();
  const { data, error } = await supabase
    .from("coupons")
    .select(
      "id,code,discount_type,discount_value,valid_until,max_uses,times_used,times_paid,is_active,event_id",
    )
    .eq("partner_tracking_code", session.partner_code)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getPortalCoupons:", JSON.stringify(error));
    return [];
  }
  return (data as PortalCoupon[]) ?? [];
}
