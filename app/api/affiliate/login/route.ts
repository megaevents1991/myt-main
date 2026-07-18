import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { user, pass } = await request.json();

  try {
    const { data, error } = await supabase
      .from('partners')
      .select("*")
      .eq('email', user)
      .eq('password', pass)
      .single();
    if (error) throw error;
    // Disabled affiliate — login rejected (only an explicit false blocks).
    if (data?.is_active === false)
      return NextResponse.json({ success: false });
    if (data && data?.email === user)
      return NextResponse.json({
        success: true,
        affiliateId: data.partner_tracking_code,
      });
    return NextResponse.json({ success: false });
  } catch (e) {
    console.log("Failed to login:", e);
    return NextResponse.json({ success: false });
  }
}