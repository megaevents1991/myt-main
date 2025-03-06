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
  commission: number;
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

    if (error) throw error;

    const { data: partner, error: error2 } = await supabase
      .from('partners')
      .select('commission')
      .eq('partner_tracking_code', affiliateId)
      .limit(1);

    if (error2) throw error2;

    const commission = partner[0]?.commission || 0;

    // Calculate stats from tracking data
    // Get the highest numOfTickets for each confirmed user
    // TODO: In the future, once we have instant charge, we should remove this and just count the number of confirmed tickets
    const confirmedUsersMap = new Map();
    tracking
      .filter(t => t.stage === 'CONFIRMED')
      .forEach(t => {
      const userId = t.user_id;
      const numOfTickets = t.data?.numOfTicket || 0;
      
      if (!confirmedUsersMap.has(userId) || numOfTickets > confirmedUsersMap.get(userId)) {
        confirmedUsersMap.set(userId, numOfTickets);
      }
      });
    
    // Calculate total confirmed tickets
    const totalConfirmedTickets = Array.from(confirmedUsersMap.values()).reduce((sum, count) => sum + count, 0);
    
    const stats: AffiliateStats = {
      visits: new Set(tracking.map(t => t.user_id)).size,
      eventsSelected: new Set(tracking.filter(t => t.stage === 'EVENT_SELECTED').map(t => t.user_id)).size,
      ticketsSelected: new Set(tracking.filter(t => t.stage === 'TICKET_SELECTED').map(t => t.user_id)).size,
      flightsSelected: new Set(tracking.filter(t => t.stage === 'FLIGHT_SELECTED').map(t => t.user_id)).size,
      hotelsSelected: new Set(tracking.filter(t => t.stage === 'HOTEL_SELECTED').map(t => t.user_id)).size,
      confirmed: totalConfirmedTickets,
      commission: commission,
      totalRevenue: totalConfirmedTickets * commission
    };

    const trackingData = tracking.slice(0, 1000).map(entry => ({
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