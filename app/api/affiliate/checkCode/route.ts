import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const affiliateId = searchParams.get('affiliateId');

  if (!affiliateId) {
    return NextResponse.json({ });
  }
  
  try {
    const { data, error } = await supabase
      .from('partners')
      .select("partner_tracking_code, user_discount, commission, type")
      .eq('partner_tracking_code', affiliateId)
      .single();
    if (error) throw error;    
    
    // Return data if it has either discount OR commission (for agents)
    if (data && (data?.user_discount || data?.commission))
      return NextResponse.json({
        discount: data.user_discount || 0,
        commission: data.commission || 0,
        type: data.type,
      });
    else
    return NextResponse.json({ });
  } catch (e) {
    console.log("Failed to login:", e);
    return NextResponse.json({ success: false });
  }
}