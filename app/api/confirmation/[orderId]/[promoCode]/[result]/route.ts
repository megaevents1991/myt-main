import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; promoCode: string; result: string }> } // <-- Type params as a Promise
) {
  try {
    const { orderId, promoCode, result } = await params; // <-- Await params here
    const { searchParams } = new URL(request.url);

    // Get all query parameters from CreditGuard
    const queryString = searchParams.toString();

    // Construct the redirect URL to your existing confirmation page
    // This preserves all the query parameters
    const redirectUrl = new URL(
      `/confirmation/${orderId}/${promoCode}/${result}${
        queryString ? `?${queryString}` : ""
      }`,
      request.url
    );

    // Optional: Log the payment callback for debugging/tracking
    console.log("Payment callback received:", {
      orderId,
      promoCode,
      queryParams: Object.fromEntries(searchParams.entries()),
      timestamp: new Date().toISOString(),
    });

    // Optional: You can add any server-side processing here before redirecting
    // For example: logging, analytics, webhook calls, etc.

    // Redirect to your existing confirmation page with all query parameters intact
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing payment callback:", error);

    // You also need to await params here if you access them after the initial await
    // Or, better, if params might be the cause of the error, handle it gracefully.
    // For simplicity, let's assume params are available from the try block if no error occurred in awaiting them.
    let orderIdForError = 'unknown';
    let promoCodeForError = 'unknown';
    try {
        const resolvedParams = await params;
        orderIdForError = resolvedParams.orderId;
        promoCodeForError = resolvedParams.promoCode;
    } catch (paramError) {
        console.error("Error resolving params in error handler:", paramError);
    }


    // Redirect to error page or back to confirmation with error status
    const errorUrl = new URL(
      `/confirmation/${orderIdForError}/${promoCodeForError}/error`,
      request.url
    );

    return NextResponse.redirect(errorUrl);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; promoCode: string; result: string }> } // <-- Type params as a Promise
) {
  try {
    const { orderId, promoCode, result } = await params; // <-- Await params here
    const { searchParams } = new URL(request.url);

    // Get all query parameters from CreditGuard
    const queryString = searchParams.toString();

    // Construct the redirect URL to your existing confirmation page
    // This preserves all the query parameters
    const redirectUrl = new URL(
      `/confirmation/${orderId}/${promoCode}/${result}${
        queryString ? `?${queryString}` : ""
      }`,
      request.url
    );

    // Optional: Log the payment callback for debugging/tracking
    console.log("Payment callback received:", {
      orderId,
      promoCode,
      queryParams: Object.fromEntries(searchParams.entries()),
      timestamp: new Date().toISOString(),
    });

    // Optional: You can add any server-side processing here before redirecting
    // For example: logging, analytics, webhook calls, etc.

    // Redirect to your existing confirmation page with all query parameters intact
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing payment callback:", error);

    // You also need to await params here if you access them after the initial await
    // Or, better, if params might be the cause of the error, handle it gracefully.
    // For simplicity, let's assume params are available from the try block if no error occurred in awaiting them.
    let orderIdForError = 'unknown';
    let promoCodeForError = 'unknown';
    try {
        const resolvedParams = await params;
        orderIdForError = resolvedParams.orderId;
        promoCodeForError = resolvedParams.promoCode;
    } catch (paramError) {
        console.error("Error resolving params in error handler:", paramError);
    }


    // Redirect to error page or back to confirmation with error status
    const errorUrl = new URL(
      `/confirmation/${orderIdForError}/${promoCodeForError}/error`,
      request.url
    );

    return NextResponse.redirect(errorUrl);
  }
}

