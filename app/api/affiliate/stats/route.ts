/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface AffiliateStats {
  visits: number;
  eventsSelected: number;
  ticketsSelected: number;
  flightsSelected: number;
  hotelsSelected: number;
  confirmed: number;
  totalRevenue: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const affiliateId = searchParams.get('affiliateId');
  console.log('Affiliate ID:', affiliateId);
  
  try {
    // Get tracking data from Supabase
    const { data: tracking, error } = await supabase
      .from('affiliates_tracking')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    console.log(tracking);
    

    // Calculate stats from tracking data
    const stats: AffiliateStats = {
      visits: tracking.filter(t => t.stage === 'VISIT').length,
      eventsSelected: tracking.filter(t => t.stage === 'EVENT_SELECTED').length,
      ticketsSelected: tracking.filter(t => t.stage === 'TICKET_SELECTED').length,
      flightsSelected: tracking.filter(t => t.stage === 'FLIGHT_SELECTED').length,
      hotelsSelected: tracking.filter(t => t.stage === 'HOTEL_SELECTED').length,
      confirmed: tracking.filter(t => t.stage === 'CONFIRMED').length,
      totalRevenue: tracking
        .filter(t => t.stage === 'CONFIRMED')
        .reduce((sum, t) => sum + (Number(t.data?.amount) || 0), 0)
    };

    const trackingData = tracking.map(entry => ({
      id: entry.id,
      user_id: entry.user_id,
      stage: entry.stage,
      data: entry.data,
      timestamp: entry.created_at
    }))

    return NextResponse.json({ trackingData, stats });

  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate statistics' },
      { status: 500 }
    );
  }
}