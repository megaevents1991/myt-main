// Analytics tracking utility for server-side events

export type EventType = 
  | "select_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "generate_lead"
  | "add_shipping_info";

export interface EventData {
  id: number;
  name: string;
  value?: number;
  currency?: string;
  category?: string;
  brand?: string;
  price?: number;
  quantity?: number;
}

export interface AnalyticsOptions {
  eventData: EventData;
  eventType: EventType;
  gtmIdnts?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Tracks analytics events server-side
 * @param options - Analytics tracking options
 * @returns Promise<boolean> - Success status
 */
export async function trackServerSideEvent(options: AnalyticsOptions): Promise<boolean> {
  try {
    const {
      eventData,
      eventType,
      gtmIdnts,
      userAgent = "Unknown",
      ip = "Unknown"
    } = options;

    // Parse gtmIdnts cookie value safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsedGtmIdnts: { ga_fpid?: string; ga_session_id?: string; [key: string]: any } = {};
    if (gtmIdnts) {
      try {
        parsedGtmIdnts = JSON.parse(decodeURIComponent(gtmIdnts));
      } catch (error) {
        console.warn("Failed to parse gtmIdnts cookie:", error);
      }
    }

    // Construct the analytics payload
    const analyticsPayload = {
      client_id: parsedGtmIdnts.ga_fpid || "",
      events: [
      {
        name: eventType,
        params: {
        tracking_environment: process.env.NEXT_PUBLIC_NODE_ENV,
        ...(parsedGtmIdnts.ga_session_id && { ga_session_id: parsedGtmIdnts.ga_session_id }),
        gtm_idnts: parsedGtmIdnts,
        user_agent: userAgent,
        ip_override: ip,
        timestamp_micros: new Date().getTime() * 1000,
        value: eventData.value || 1500,
        currency: eventData.currency || "USD",
        product_name: eventData.name,
        "x-ga-system_properties": { c: "1" },
        items: [
          {
          item_id: eventData.id,
          item_name: eventData.name,
          item_brand: eventData.brand || "Mega Events",
          item_category: eventData.category || "Music",
          price: eventData.value || 1500,
          quantity: eventData.quantity || 1,
          },
        ],
        },
      },
      ],
    };

    // Make the server-side tracking call
    const response = await fetch(
      `https://gtm.mega-events.co.il/server_side?measurment_id=G-0000000000`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyticsPayload),
      }
    );

    if (!response.ok) {
      console.error("Analytics tracking failed:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in analytics tracking:", error);
    return false;
  }
}

/**
 * Extract IP address from request headers
 */
export function extractIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return typeof forwarded === "string" ? forwarded.split(",")[0] : "Unknown";
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgentFromRequest(request: Request): string {
  return request.headers.get("user-agent") || "Unknown";
}
