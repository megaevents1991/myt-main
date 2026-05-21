"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Copy, Link2 } from "lucide-react";
import { useState, useEffect } from "react";
import { OrderData, Flight } from "@/lib/app.types";
import dayjs from "dayjs";
import { ReferFriend } from "@/components/ReferFriend";
import { trackEvent } from "@/lib/mixpanel";

type PaymentStatus = "success" | "error" | "pending";

type OrderConfirmationData = {
  bookingReference: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  quantity: string;
  airline: string;
  flights: string;
  dates: string;
  hotel: string;
  isPaid: PaymentStatus;
  partnerTrackingCode: string | null;
  eventId: number;
};

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const isHold = searchParams.get("onlySave") === "1"; // 24h hold (onlySave flow)
  const [isLoading, setIsLoading] = useState(true);
  const [orderConfirmationData, setOrderConfirmationData] =
    useState<OrderConfirmationData>({} as OrderConfirmationData);
  const [copySuccess, setCopySuccess] = useState(false);

  const { params } = useParams();

  const [orderId, promoCode, status] = Array.isArray(params)
    ? params
    : [params, "dummy_code", undefined];

  const getOrderData = async () => {
    const response = await fetch(`/api/confirm-order/${orderId}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch order data");
    }
    const data: OrderData = await response.json();

    return data;
  };

  const validatePayment = async (txId: string) => {
    const response = await fetch(
      `/api/payment/${orderId}/${txId}/${promoCode}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();
    return data;
  };

  const trackAnalyticsEvent = (orderData: OrderData) => {
    try {
      const gtmIdnts =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("gtmIdnts="))
          ?.split("=")[1] || "";

      fetch("/api/events-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventData: {
            id: orderData.event_id,
            name: orderData.event_order_info.name,
            date: orderData.event_order_info.date,
            category: orderData.event_order_info.event_type,
          },
          eventType: "purchase",
          gtmIdnts,
        }),
      });
    } catch (error) {
      console.warn("Analytics tracking failed:", error);
    }
  };

  const handlePageOpen = async () => {
    setIsLoading(true);
    try {
      const orderData = await getOrderData();
      const resultObject = Object.fromEntries(searchParams.entries());

      let isPaid: PaymentStatus = "pending";

      if (status && resultObject.txId) {
        const { isSuccess } = await validatePayment(resultObject.txId);
        isPaid = isSuccess ? "success" : "error";
      }
      if (orderData) {
        if (isPaid === "success") {
          trackAnalyticsEvent(orderData);
        }
        // Flight is optional: skipped flights are saved as an empty object.
        const rawFlightInfo = orderData.flight_order_info;
        const hasFlight = Boolean(
          rawFlightInfo &&
            Object.keys(rawFlightInfo).length > 0 &&
            (rawFlightInfo as Flight).outbound
        );
        const flightInfo = rawFlightInfo as Flight;

        const orderDataToShow: OrderConfirmationData = {
          eventName: orderData.event_order_info.name,
          eventDate: orderData.event_order_info.date.toString(),
          eventLocation: orderData.event_order_info.location_name,
          ticketType: orderData.event_order_info.category,
          quantity: orderData.event_order_info.number_of_ticket.toString(),
          airline: hasFlight ? flightInfo.metadata?.name ?? "" : "",
          flights: hasFlight
            ? `Outbound: ${flightInfo.outbound.flightNumber}, Return: ${flightInfo.inbound.flightNumber}`
            : "",
          dates: hasFlight
            ? `Outbound: ${dayjs(
                flightInfo.outbound.departureTime
              ).format("DD/MM/YYYY HH:MM")}, Return: ${dayjs(
                flightInfo.inbound.departureTime
              ).format("DD/MM/YYYY HH:MM")}`
            : "",
          hotel: (!orderData.hotel_order_info || Object.keys(orderData.hotel_order_info).length === 0) ? "ללא מלון" : orderData.hotel_order_info.name,
          bookingReference: orderData.booking_reference,
          isPaid,
          partnerTrackingCode: promoCode === "dummy_code" ? null : promoCode,
          eventId: orderData.event_id,
        };
        setOrderConfirmationData(orderDataToShow);

        // Track payment resolution event in Mixpanel
        trackEvent("eventPayment", {
          orderId: orderId,
          paymentStatus: isPaid,
          eventName: orderData.event_order_info.name,
          eventDate: orderData.event_order_info.date,
          eventType: orderData.event_order_info.event_type,
          eventTags: orderData.event_order_info.event_tags,
          eventLocation: orderData.event_order_info.location_name,
          ticketCategory: orderData.event_order_info.category,
          numberOfTickets: orderData.event_order_info.number_of_ticket,
          airline: hasFlight ? flightInfo.metadata?.name ?? "SKIPPED" : "SKIPPED",
          hotel: (!orderData.hotel_order_info || Object.keys(orderData.hotel_order_info).length === 0) ? "SKIPPED" : orderData.hotel_order_info.name,
          paymentMethod:
            Object.keys(orderData.payment_info || {}).length === 0
              ? "Phone"
              : "CreditCard",
          affiliateId: orderData.aff_partner_tracking_code || null,
          finalPrice: orderData.final_purchase_price_ils,
        });
      }
    } catch (error) {
      console.error("Failed to load confirmation order data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handlePageOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const getOrderRecoveryUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/order/${orderConfirmationData.eventId}?orderId=${orderId}`;
  };

  const OrderRecoverySection = () => {
    const recoveryUrl = getOrderRecoveryUrl();
    
    return (
      <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3" dir="rtl">
          <Link2 className="h-5 w-5 text-secondary" />
          <h3 className="font-semibold text-secondary">קישור להשלמת ההזמנה</h3>
        </div>
        <p className="text-sm text-secondary/80 mb-3" dir="rtl">
          שמרו את הקישור כדי לגשת להזמנה שלכם ב-24 שעות הקרובות ולשלם במועד מאוחר יותר אם תרצו
        </p>
        <div 
          className={`relative cursor-pointer rounded-lg border-2 transition-all duration-200 ${
            copySuccess 
              ? "bg-secondary/10 border-secondary/50 shadow-sm" 
              : "bg-secondary/5 border-secondary/40 hover:border-secondary/60 hover:bg-secondary/10"
          }`}
          onClick={() => copyToClipboard(recoveryUrl)}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0 ml-3">
              <p className="text-sm font-medium text-secondary mb-1" dir="rtl">
                לחץ כדי להעתיק קישור
              </p>
              <p className="text-xs text-secondary/90 break-all font-mono leading-relaxed">
                {recoveryUrl}
              </p>
            </div>
            <div className="flex items-center flex-shrink-0">
              <Copy className={`h-5 w-5 transition-colors ${
                copySuccess ? "text-secondary" : "text-secondary"
              }`} />
            </div>
          </div>
          {copySuccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg">
              <div className="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-full shadow-lg border border-secondary/20">
                <Check className="h-5 w-5 text-white" />
                <span className="text-sm font-medium text-white">הלינק הועתק</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-center">
          <Button 
            onClick={() => window.open(recoveryUrl, '_blank')}
            className="bg-secondary hover:bg-secondary/90 text-white px-4 py-2 text-sm"
            dir="rtl"
          >
            עבור להשלמת ההזמנה
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          Confirming your booking...
        </p>
      </div>
    );
  }

  const {
    airline,
    bookingReference,
    dates,
    eventDate,
    eventLocation,
    eventName,
    flights,
    hotel,
    quantity,
    ticketType,
    isPaid,
    partnerTrackingCode,
  } = orderConfirmationData;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <div className="flex flex-col items-center" dir="rtl">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold">
          {isHold ? "ההזמנה נשמרה ל-24 שעות" : "הזמנתכם נקלטה"}
        </h1>
        <p className="mt-2 text-xl">
          {<>תודה שבחרתם MegaEvents</>}
        </p>
      </div>
      {partnerTrackingCode ? (
        <div className="md:flex md:flex-row md:gap-8 md:items-start md:max-w-4xl w-full flex flex-col">
          <div
            id="refer_a_friend_confirmation"
            className="md:w-2/5 text-sm text-gray-500 mt-6 sm:mt-6 order-2 md:order-1"
          >
            <ReferFriend promoCode={promoCode || ""} />
          </div>
          <div
            id="order_summary_confirmation"
            className="max-w-md w-full mt-6 text-center order-1 md:order-2"
          >
            {!isHold && (
              <>
                {isPaid === "success" ? (
                  <p className="my-2 text-lg text-green-600" dir="rtl">
                    התשלום התקבל בהצלחה, קבלה ואישור הזמנה ישלחו במייל ביום העסקים הבא.
                  </p>
                ) : isPaid === "error" ? (
                  <p className="my-2 text-lg text-red-600" dir="rtl">
                    אופס, משהו לא עבד עם התשלום, נציגינו יצרו עימך קשר ביום העסקים הבא.
                  </p>
                ) : (
                  <p className="my-2 text-green-600 font-bold" dir="rtl">
                    ההזמנה שלך נשלחה לנציגינו ואלו יצרו עימך קשר תוך יום עסקים לקבלת תשלום ואישור הרכישה.
                  </p>
                )}
              </>
            )}
            
            {isHold && <OrderRecoverySection />}
            
            <div className="bg-gray-50 rounded-lg p-6 my-6 text-left">
              <h2 className="text-2xl font-bold mb-4 text-center">
                פרטי ההזמנה
              </h2>
              <div className="space-y-3">
                <p>
                  <strong>Booking Reference:</strong> {bookingReference}
                </p>
                <p>
                  <strong>Event:</strong> {eventName}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString("he-IL")
                    : "N/A"}
                </p>
                <p>
                  <strong>Location:</strong> {eventLocation}
                </p>
                <p>
                  <strong>Tickets:</strong> (x{quantity}) {ticketType}
                </p>
                {flights ? (
                  <>
                    <p>
                      <strong>Airline:</strong> {airline}
                    </p>
                    <p>
                      <strong>Flight Numbers-</strong> {flights}
                    </p>
                    <p>
                      <strong>Flight Schedule-</strong> {dates}
                    </p>
                  </>
                ) : (
                  <p>
                    <strong>Flight:</strong> ללא טיסה
                  </p>
                )}
                {hotel !== "ללא מלון" && (
                  <p>
                    <strong>Hotel:</strong> {hotel}
                  </p>
                )}
              </div>
            </div>
            
            <Link href="/" className="mt-6">
              <Button className="w-full" aria-label="חזור לעמוד הבית">חזור לדף הבית</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="max-w-md w-full mt-6 text-center">
            {!isHold && (
              <>
                {isPaid === "success" ? (
                  <p className="my-2 text-lg text-green-600" dir="rtl">
                    התשלום התקבל בהצלחה, קבלה ואישור הזמנה ישלחו במייל ביום העסקים הבא.
                  </p>
                ) : isPaid === "error" ? (
                  <p className="my-2 text-lg text-red-600" dir="rtl">
                    אופס, משהו לא עבד עם התשלום, נציגינו יצרו עימך קשר ביום העסקים הבא.
                  </p>
                ) : (
                  <p className="my-2 text-green-600 font-bold" dir="rtl">
                    ההזמנה שלך נשלחה לנציגינו ואלו יצרו עימך קשר תוך יום עסקים לקבלת תשלום ואישור הרכישה.
                  </p>
                )}
              </>
            )}
            
            {isHold && <OrderRecoverySection />}
            
            <div className="bg-gray-50 rounded-lg p-6 my-6 text-left">
              <h2 className="text-2xl font-bold mb-4 text-center">
                פרטי ההזמנה
              </h2>
              <div className="space-y-3">
                <p>
                  <strong>Booking Reference:</strong> {bookingReference}
                </p>
                <p>
                  <strong>Event:</strong> {eventName}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString("he-IL")
                    : "N/A"}
                </p>
                <p>
                  <strong>Location:</strong> {eventLocation}
                </p>
                <p>
                  <strong>Tickets:</strong> (x{quantity}) {ticketType}
                </p>
                {flights ? (
                  <>
                    <p>
                      <strong>Airline:</strong> {airline}
                    </p>
                    <p>
                      <strong>Flight Numbers-</strong> {flights}
                    </p>
                    <p>
                      <strong>Flight Schedule-</strong> {dates}
                    </p>
                  </>
                ) : (
                  <p>
                    <strong>Flight:</strong> ללא טיסה
                  </p>
                )}
                {hotel !== "ללא מלון" && (
                  <p>
                    <strong>Hotel:</strong> {hotel}
                  </p>
                )}
              </div>
            </div>
            
            <Link href="/" className="mt-6">
              <Button className="w-full" aria-label="חזור לעמוד הבית">חזור לדף הבית</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
