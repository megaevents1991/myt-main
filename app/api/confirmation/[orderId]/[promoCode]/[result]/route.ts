import { NextRequest, NextResponse } from "next/server";
import { validateAndRecordPayment } from "@/app/api/payment/validateAndRecord";

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

    // Record the payment outcome SERVER-SIDE, before the browser redirect.
    // The confirmation page re-validates too (idempotent), but this is the
    // reliable write: it runs even when the customer closes the tab / loses
    // network after paying — previously those paid orders stayed Pending and
    // the backoffice flagged them Lost. Failure here must not break the
    // redirect: the page's own validation is the fallback.
    if (paymentData.txId) {
      try {
        await validateAndRecordPayment({
          orderId,
          txId: paymentData.txId,
          promoCode,
        });
      } catch (validationError) {
        console.error(
          "Server-side payment recording failed (page will retry):",
          JSON.stringify({ orderId, error: String(validationError) }),
        );
      }
    }

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

