// The site's TixStock booking client. The site books in the SANDBOX only - the hidden test checkout of TixStock's
// health check. A real order's ticket is booked from the backoffice, never from here, so there is no production
// branch in this file.
//
//   NEXT_SECRET_TIXSTOCK_SANDBOX_URL    https://sandbox-pf.tixstock.com/v1
//   NEXT_SECRET_TIXSTOCK_SANDBOX_TOKEN  the sandbox Bearer token
//
// The feed's NEXT_SECRET_TIXSTOCK_API_URL / NEXT_SECRET_TIXSTOCK_TOKEN are never read here: the ticket step of
// every real event keeps them to itself. Server only (NEXT_SECRET_*).
import { createTixstockClient, type TixstockClient } from "@/lib/tixstock-booking/client";

/** null when either sandbox variable is missing, or the URL is not a sandbox host. Reads the env at call time. */
export function sandboxClient(): TixstockClient | null {
  const baseUrl = process.env.NEXT_SECRET_TIXSTOCK_SANDBOX_URL?.trim();
  const token = process.env.NEXT_SECRET_TIXSTOCK_SANDBOX_TOKEN?.trim();
  // A test booking must never reach the production host, whatever was pasted into the sandbox variable.
  if (!baseUrl || !token || !/sandbox/i.test(baseUrl)) return null;
  return createTixstockClient({ baseUrl, token });
}
