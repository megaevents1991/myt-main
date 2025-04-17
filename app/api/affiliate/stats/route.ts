import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const affiliateId = searchParams.get('affiliateId');
  console.log('Affiliate ID:', affiliateId);
  
  try {
    // Get tracking data from Supabase
    const pageSize = 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allRows: any[] = [];
    let from = 0;
    let to = pageSize - 1;
    let done = false;
    
    while (!done) {
      const { data, error } = await supabase
        .from('affiliates_tracking')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false })
        .range(from, to);
    
      if (error) {
        console.error('Error fetching data:', error);
        break;
      }
    
      allRows = allRows.concat(data);
    
      if (data.length < pageSize) {
        done = true;
      } else {
        from += pageSize;
        to += pageSize;
      }
    }
    

    const { data: reservations } = await supabase
      .from('reservations')
      .select('*')
      .eq('aff_partner_tracking_code', affiliateId)
      .eq('status', 'Paid')
      .order('created_at', { ascending: false });

    const { data: partner, error: error2 } = await supabase
      .from('partners')
      .select('commission')
      .eq('partner_tracking_code', affiliateId)
      .limit(1);

    if (error2) throw error2;

    const commission = partner[0]?.commission || 0;

    // Get the current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Filter tracking and reservations for the current month
    const trackingThisMonth = allRows.filter(t => {
      const createdAt = new Date(t.created_at);
      return createdAt >= startOfMonth && createdAt <= endOfMonth;
    });

    const reservationsThisMonth = reservations?.filter(r => {
      const createdAt = new Date(r.created_at);
      return createdAt >= startOfMonth && createdAt <= endOfMonth;
    }) || [];

    // Helper function to calculate stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculateStats = (trackingData: any[], reservationsData: any[]) => {
      const confirmedUsersMap = new Map();
      trackingData
        .filter(t => t.stage === 'CONFIRMED')
        .forEach(t => {
          const userId = t.user_id;
          const numOfTickets = t.data?.data?.numOfTicket || 0;

          if (!confirmedUsersMap.has(userId) || numOfTickets > confirmedUsersMap.get(userId)) {
            confirmedUsersMap.set(userId, numOfTickets);
          }
        });

      const totalConfirmedTickets = Array.from(confirmedUsersMap.values()).reduce((sum, count) => sum + count, 0);
      const totalPaidTickets = reservationsData.reduce((sum, reservation) => {
        const numOfTickets = reservation.event_order_info?.number_of_ticket || 0;
        return sum + numOfTickets;
      }, 0);

      return {
        visits: new Set(trackingData.map(t => t.user_id)).size,
        eventsSelected: new Set(trackingData.filter(t => t.stage === 'EVENT_SELECTED').map(t => t.user_id)).size,
        ticketsSelected: new Set(trackingData.filter(t => t.stage === 'TICKET_SELECTED').map(t => t.user_id)).size,
        flightsSelected: new Set(trackingData.filter(t => t.stage === 'FLIGHT_SELECTED').map(t => t.user_id)).size,
        hotelsSelected: new Set(trackingData.filter(t => t.stage === 'HOTEL_SELECTED').map(t => t.user_id)).size,
        confirmed: totalConfirmedTickets,
        paid: totalPaidTickets,
        commission: commission,
        totalRevenue: totalPaidTickets * commission
      };
    };

    // Calculate stats for this month and all-time
    const statsThisMonth = calculateStats(trackingThisMonth, reservationsThisMonth);
    const statsAllTime = calculateStats(allRows, reservations || []);

    const trackingData = allRows.slice(0, 1000).map(entry => ({
      id: entry.id,
      user_id: entry.user_id,
      stage: entry.stage,
      data: entry.data.data,
      timestamp: entry.created_at
    }));

    return NextResponse.json({ trackingData, stats: { thisMonth: statsThisMonth, allTime: statsAllTime } });

  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch affiliate statistics' },
      { status: 500 }
    );
  }
}