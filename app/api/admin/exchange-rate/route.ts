import { NextResponse, NextRequest } from "next/server";
import { exchangeRateService } from "@/lib/exchangeRateService";

// Admin endpoint to manually trigger exchange rate update
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.NEXT_SECRET_REVALIDATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await exchangeRateService.forceUpdate();
    const allRates = exchangeRateService.getAllRates();
    
    return NextResponse.json({
      success: true,
      message: 'Exchange rates updated manually',
      rates: allRates
    });
  } catch (error) {
    console.error("Error forcing exchange rate update:", error);
    return NextResponse.json(
      { error: "Failed to update exchange rate" },
      { status: 500 }
    );
  }
}

// Get current exchange rate status
export async function GET() {
  try {
    const allRates = exchangeRateService.getAllRates();
    
    return NextResponse.json({
      success: true,
      rates: allRates
    });
  } catch (error) {
    console.error("Error getting exchange rate info:", error);
    return NextResponse.json(
      { error: "Failed to get exchange rate info" },
      { status: 500 }
    );
  }
}
