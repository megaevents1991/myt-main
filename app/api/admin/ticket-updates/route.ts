import { NextResponse, NextRequest } from "next/server";
import { ticketUpdateService } from "@/lib/ticketUpdateService";

// Admin endpoint to manually trigger dynamic ticket updates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await ticketUpdateService.forceUpdate();
    
    const successful = results.filter(result => result.success);
    const failed = results.filter(result => !result.success);
    
    return NextResponse.json({
      success: true,
      message: 'Dynamic ticket updates completed',
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: results
    });
  } catch (error) {
    console.error("Error forcing ticket updates:", error);
    return NextResponse.json(
      { error: "Failed to update dynamic tickets" },
      { status: 500 }
    );
  }
}
