import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; promoCode: string; result: string }> }
) {
  try {
    const { orderId, promoCode, result } = await params;
    
    // Extract form data from the request payload
    const formData = await request.formData();
    
    // Convert form data to a regular object for easier handling
    const paymentData: Record<string, string> = {};
    formData.forEach((value, key) => {
      paymentData[key] = value.toString();
    });

    // Construct the redirect URL to your existing confirmation page
    // Convert form data to query parameters for the redirect
    const queryParams = new URLSearchParams(paymentData);
    const redirectUrl = new URL(
      `/confirmation/${orderId}/${promoCode}/${result}${
        queryParams.toString() ? `?${queryParams.toString()}` : ""
      }`,
      request.url
    );

    // Log the payment callback for debugging/tracking
    console.log("Payment callback received:", {
      orderId,
      promoCode,
      result,
      formData: paymentData,
      timestamp: new Date().toISOString(),
    });

    // Optional: You can add any server-side processing here before redirecting
    // For example: logging, analytics, webhook calls, etc.

    // Redirect to your existing confirmation page with all form data as query parameters
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing payment callback:", error);

    let orderIdForError = 'unknown';
    let promoCodeForError = 'unknown';
    try {
        const resolvedParams = await params;
        orderIdForError = resolvedParams.orderId;
        promoCodeForError = resolvedParams.promoCode;
    } catch (paramError) {
        console.error("Error resolving params in error handler:", paramError);
    }

    // Redirect to error page
    const errorUrl = new URL(
      `/confirmation/${orderIdForError}/${promoCodeForError}/error`,
      request.url
    );

    return NextResponse.redirect(errorUrl);
  }
}

