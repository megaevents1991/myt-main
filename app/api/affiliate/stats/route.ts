import { NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { supabase } from "@/lib/supabase";

export async function GET() {
  // This is mock data - replace with actual database calls
  const mockTracking = [
    {
      id: 1,
      timestamp: new Date(),
      stage: 'visit',
      data: { page: 'homepage' }
    },
    {
      id: 2,
      timestamp: new Date(),
      stage: 'booking',
      data: { amount: 299.99 }
    }
  ];

  const mockStats = {
    visits: 150,
    ticketsSelected: 45,
    flightsSelected: 30,
    hotelsSelected: 25,
    confirmed: 20,
    totalRevenue: 5999.99
  };

  return NextResponse.json({
    tracking: mockTracking,
    stats: mockStats
  });
}
