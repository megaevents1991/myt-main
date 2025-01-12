import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { user, pass } = await request.json();

  try {
    const { data, error } = await supabase
      .from('partners')
      .select("*")
      .eq('email', user)
      .eq('code', pass)
      .single();
    if (error) throw error;    
    if (data && data?.email === user)
      return NextResponse.json({
        success: true,
        affiliateId: data.partner_id,
      });
    return NextResponse.json({ success: false });
  } catch (e) {
    console.log("Failed to login:", e);
    return NextResponse.json({ success: false });
  }
}