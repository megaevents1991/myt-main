"use client";

import type React from "react";

import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OrderContext } from "../app.context";
import { FlightMeta } from "@/components/ui/FlightCard";
import { cn } from "@/lib/utils";
import type { OrderData } from "@/lib/app.types";
import { orderStage } from "../hooks/Affiliate";
import dayjs from "dayjs";
import { formatPrice } from "@/lib/price.utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFetchAffiliate, useOrderVars } from "./hooks";
import { trackEvent } from "@/lib/mixpanel";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { Timer } from "@/components/ui/Timer";
import { type Fields, validate } from "./order-review.utils";
import { LoaderWrapper } from "@/components/ui/loader";
import { useRouter } from "next/navigation";
import AgentMode from "@/components/AgentMode";
import AgentPrintSettings from "@/components/AgentPrintSettings";
import PrintableOrderSummary from "@/components/PrintableOrderSummary";
import usePrintableWindow from "../hooks/usePrintableWindow";
import { ShareButton } from "@/components/ui/shareButton";

const TIMEOUT = 15 * 60;

// One line shift down, imports
export default function OrderReview() {
  const {
    flight: selectedFlight,
    hotel: selectedHotel,
    eventTicket,
    event,
    setPaymentMethod,
    numberOfEventTickets,
    setStep,
  } = useContext(OrderContext);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { affId, affDiscount, agentCommission } = useFetchAffiliate();
  const [validationErrors, setValidationErrors] = useState<
    { [key: string]: string }[]
  >(Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({})));
  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    }))
  );
  const [touched, setTouched] = useState(
    Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({
      firstName: false,
      lastName: false,
      phone: false,
      email: false,
    }))
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsCheckboxTouched, setTermsCheckboxTouched] = useState(false);
  const {
    numberOfPersons,
    finalPurchasePriceCalc,
    finalPurchasePriceILSCalc,
    recommendedPriceAllPax,
    packRecommendedPrice,
    isNumberOfPersonsEqual,
    eventTicketPriceAddition,
    flightPriceAddition,
    airlineName,
    hotelPriceAddition,
    totalGuests,
  } = useOrderVars();
  const [openModal, setOpenModal] = useState(true);
  const [isTimeout, setIsTimeout] = useState(false);
  const [isPayNow, setIsPayNow] = useState(false);

  const [isAgentMode, setIsAgentMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      const raw = localStorage.getItem("mytData");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.logoUrl || "";
    } catch (e) {
      console.error("Failed to parse localStorage mytData", e);
      return "";
    }
  });

  const trackAnalyticsEvent = (event: import("@/lib/app.types").Event) => {
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
            id: event?.id,
            name: event?.name,
            date: event?.date,
            category: event?.type,
            location: event?.location?.name,
            tags: event?.tags
          },
          eventType: "view_cart",
          gtmIdnts,
        }),
      });
    } catch (error) {
      console.warn("Analytics tracking failed:", error);
    }
  };

  const finalPurchasePrice = useMemo(() => 
    finalPurchasePriceCalc(affDiscount), 
    [finalPurchasePriceCalc, affDiscount]
  );
  const [finalPurchasePriceILS, setFinalPurchasePriceILS] = useState<number>(0);
  const [usd_ils_rate, setUSD_ILS_RATE] = useState<number>(3.7);

  // Format the share text according to the specified template
  const getShareText = () => {
    if (!event || !selectedFlight || !selectedHotel) return "";

    const eventDate = dayjs(event.date).format("DD/MM/YYYY");
    const departureDateTime = dayjs(
      selectedFlight.outbound.departureTime
    ).format("DD/MM/YYYY HH:mm");
    const returnDateTime = dayjs(selectedFlight.inbound.departureTime).format(
      "DD/MM/YYYY HH:mm"
    );

    return `האירוע הבא שלכם מחכה ב - MegaEvents! 🎉

🎤 *פרטי אירוע*
${event.name}- ${event.location.name}
בתאריך: ${eventDate}

✈️ *טיסה*
${airlineName || ""}
${departureDateTime} - ${returnDateTime}

🏨 *מלון*
${selectedHotel.name}
חדר: ${selectedHotel.rate?.room_data_trans?.main_name || ""}`;
  };

  useEffect(() => {
    let isMounted = true;
    finalPurchasePriceILSCalc(finalPurchasePrice).then(
      ({ ils, travelRate }) => {
        if (isMounted) {
          setFinalPurchasePriceILS(ils);
          setUSD_ILS_RATE(travelRate);
          if (event) {
            trackAnalyticsEvent(event);
          }
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [finalPurchasePrice, finalPurchasePriceILSCalc]);

  const setErrors = () => {
    const allErrors = [...validationErrors];
    passengers.forEach((passenger, index) => {
      (["firstName", "lastName", "phone", "email"] as Fields[]).forEach(
        (field) => {
          let error = "";
          const value = passenger[field];

          if (field === "phone" || field === "email") {
            if (index === 0) {
              error = validate[field](value);
            }
          } else {
            error = validate[field](value);
          }

          if (error) {
            allErrors[index] = { ...allErrors[index], [field]: error };
          }
        }
      );
    });

    setValidationErrors(allErrors);
  };

  const [finalPrice, setFinalPrice] = useState(finalPurchasePrice);

  const { openPrintableWindow } = usePrintableWindow({
    title: "Trip Booking Summary",
  });

  const handlePrintForClient = () => {
    // Open the printable window with the customized data

    const tripData = {
      tripDetails: {
        destination: event?.location.name || "",
        price: finalPrice,
        pricePerPerson: finalPrice / numberOfPersons,
        travelers: numberOfPersons,
      },
      flightDetails: {
        outboundDepartureTime: selectedFlight?.outbound.departureTime || "",
        outboundDepartureAirport:
          selectedFlight?.outbound.departureAirport || "",
        outboundArrivalTime: selectedFlight?.outbound.arrivalTime || "",
        outboundArrivalAirport: selectedFlight?.outbound.arrivalAirport || "",
        inboundDepartureTime: selectedFlight?.inbound.departureTime || "",
        inboundDepartureAirport: selectedFlight?.inbound.departureAirport || "",
        inboundArrivalTime: selectedFlight?.inbound.arrivalTime || "",
        inboundArrivalAirport: selectedFlight?.inbound.arrivalAirport || "",
        airlineName: airlineName || "",
        outbound: selectedFlight?.outbound || {},
        inbound: selectedFlight?.inbound || {},
      },
      hotelDetails: {
        name: selectedHotel?.name || "",
        roomType: selectedHotel?.rate?.room_data_trans?.main_name || "",
        checkIn: selectedHotel?.checkin || "",
        checkOut: selectedHotel?.checkout || "",
      },
      eventDetails: {
        eventName: event?.name || "",
        eventDate: event?.date || "",
        eventLocation: event?.location.name || "",
        eventImage: event?.card_image_url || "",
        ticketType: eventTicket.category,
        quantity: numberOfEventTickets,
      },
    };

    openPrintableWindow(
      <PrintableOrderSummary
        logoUrl={logoUrl}
        tripDetails={tripData.tripDetails}
        flightDetails={tripData.flightDetails}
        hotelDetails={tripData.hotelDetails}
        eventDetails={tripData.eventDetails}
      />
    );
  };

  useEffect(() => {
    setErrors();
    // Mark fields as touched if they have values (indicating autofill)
    const newTouched = passengers.map((passenger) => ({
      firstName: !!passenger.firstName,
      lastName: !!passenger.lastName,
      phone: !!passenger.phone,
      email: !!passenger.email,
    }));
    setTouched(newTouched);
  }, [passengers]);

  const HandleTimeout = useCallback(() => {
    setIsTimeout(true);
    setOpenModal(true);
  }, []);

  const updatePassenger = useCallback(
    (index: number, field: Fields, value: string) => {
      // Format phone number if it's the phone field
      const finalValue = field === "phone" ? formatPhoneNumber(value) : value;

      // Update passenger data
      const newPassengers = [...passengers];
      newPassengers[index][field] = finalValue;
      setPassengers(newPassengers);

      const error = validate[field](finalValue);
      const newErrors = [...validationErrors];

      if (error) {
        newErrors[index] = { ...newErrors[index], [field]: error };
      } else {
        // Remove the error for this field
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = newErrors[index];
        newErrors[index] = rest;
      }
      setValidationErrors(newErrors);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passengers, validationErrors]
  );

  if (!event || !selectedFlight || !selectedHotel) {
    return (
      <div className="text-center p-3 bg-red-50 rounded-lg">
        <p className="text-red-600">
          Missing order information. Please complete all selections.
        </p>
      </div>
    );
  }

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    let formatted = cleaned;

    if (cleaned.length >= 3) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    if (cleaned.length >= 6) {
      formatted = `${formatted.slice(0, 7)}-${formatted.slice(7)}`;
    }

    return formatted.slice(0, 12); // Limit length
  };

  const handleBlur = (index: number, field: Fields) => {
    const newTouched = [...touched];
    newTouched[index] = { ...newTouched[index], [field]: true };
    setTouched(newTouched);

    // Validate on blur
    const value = passengers[index][field];
    const error = validate[field](value);

    if (error) {
      const newErrors = [...validationErrors];
      newErrors[index] = { ...newErrors[index], [field]: error };
      setValidationErrors(newErrors);
    }
  };

  const submitOrder = async (
    orderData: Omit<OrderData, "booking_reference" | "confirmation_email_sent">,
    payNow: boolean
  ) => {
    const gtmIdnts =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("gtmIdnts="))
        ?.split("=")[1] || "";

    const response = await fetch("/api/confirm-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...orderData,
        payNow,
        gtmIdnts,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to submit order");
    }
    return await response.json(); // response.newPromoterCode
  };

  const getPaymentUrl = async (orderId: string, promoCode: string) => {
    const response = await fetch(`/api/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        promoCode,
        email: passengers[0].email,
        amount: finalPurchasePriceILS,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get payment URL");
    }
    return await response.json();
  };

  const handleSubmit = async (e: React.FormEvent, payNow = false) => {
    e.preventDefault();
    setTermsCheckboxTouched(true);

    setErrors();
    const touched = passengers.map(() => ({
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    }));
    setTouched(touched);

    // Check if form is valid after validation
    if (!isFormValid || isSubmitting) return;

    if (!termsAccepted) {
      setIsSubmitting(false);
      return;
    }
    setIsPayNow(payNow);
    setPaymentMethod(payNow ? "credit_card" : "phone_order");
    setIsSubmitting(true);

    // Collect data from your UI elements
    const updatedFormData = {
      main_contact_first_name: passengers[0].firstName,
      main_contact_last_name: passengers[0].lastName,
      main_contact_phone_number: passengers[0].phone,
      main_contact_email: passengers[0].email,
      more_pax_info: passengers.slice(1).map((passenger) => ({
        first_name: passenger.firstName,
        last_name: passenger.lastName,
      })),
      event_order_info: {
        event_id: event?.id || 0,
        date: event ? new Date(event.date) : new Date(),
        name: event?.name || "",
        location_name: event?.location.name || "",
        number_of_ticket: numberOfEventTickets,
        category: eventTicket.category,
        event_type: event?.type || "",
        event_tags: event?.tags || "",
        price_per_ticket: eventTicket.price,
        total_tickets_price: eventTicket.price * numberOfEventTickets,
        vendor: eventTicket.vendor,
        id: eventTicket.id,
      },
      flight_order_info: selectedFlight || {},
      hotel_order_info: selectedHotel || {},
      user_shown_price: finalPurchasePrice,
      exchange_rate_usd_ils_100: usd_ils_rate * 100,
      final_purchase_price_ils: finalPurchasePriceILS,
      event_id: event?.id || 0,
      aff_partner_tracking_code: affId || "",
      is_agent_booking: agentCommission > 0,
    };

    try {
      const result = await submitOrder(updatedFormData, payNow);

      orderStage("CONFIRMED", {
        // TO DO: temp workaround as order stage doesn't work (router.push?)
        data: {
          confirmed: "checkout",
          eventName: event.name,
          numOfTicket: numberOfEventTickets,
        },
      });

      trackEvent("eventCheckout", {
        userFinalPrice: finalPurchasePrice,
        userFinalPriceILS: finalPurchasePriceILS,
        userFinalPriceRate: usd_ils_rate,
        fullPacagePrice: recommendedPriceAllPax,
        paymentMethod: payNow ? "credit_card" : "phone_order",
        affiliateDiscount: affDiscount * numberOfEventTickets,
        affiliateId: affId,
        isAgentBooking: agentCommission > 0,
        eventTags: event.tags,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
      });

      if (payNow) {
        const { url } = await getPaymentUrl(result.id, result.newPromoterCode);
        if (!url) {
          throw new Error("Failed to get payment URL");
        }
        window.location.replace(url);
      } else {
        // Redirect to the order confirmation page
        router.push(`/confirmation/${result.id}/${result.newPromoterCode}`);
      }
    } catch (error) {
      // TO DO: Handle error (e.g., show error message)
      console.error("Order submission failed:", error);

      setIsSubmitting(false);
    }
  };

  const penText = () => {
    if (!selectedFlight.penalties) return "";

    return (
      selectedFlight.penalties
        .replace(/PE\.PENALTIES\s*\n/, "")
        .replace(
          /CANCELLATIONS\s*\n/,
          '<h3 class="font-bold mt-4 mb-2">Cancellation Policy</h3>'
        )
        .replace(
          /CHANGES\s*\n/,
          '<h3 class="font-bold mt-4 mb-2">Change Policy</h3>'
        )
        .replace(/NOTE -/g, "<strong>Note:</strong>")
        .replace(/--+/g, '<hr class="my-2">')
        // Convert newlines to paragraphs
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `<p class="mb-2">${line}</p>`)
        .join("")
    );
  };

  const isFormValid =
    passengers.every((passenger, i) => {
      const hasErrors = Object.keys(validationErrors[i]).length > 0;
      const isMainContact = i === 0;
      const hasRequiredFields = passenger.firstName && passenger.lastName;
      const hasContactInfo =
        !isMainContact || (passenger.phone && passenger.email);

      return !hasErrors && hasRequiredFields && hasContactInfo;
    }) && termsAccepted;

  const TermsError = () => (
    <p className="text-sm text-red-500 text-right mt-1">
      יש לאשר את פרטי ההזמנה ותנאי השימוש
    </p>
  );

  const HandleTimeoutModalAction = () => {
    setOpenModal(false);
    if (isTimeout) {
      setStep(1);
    }
  };

  const shareText = getShareText();

  return (
    <div className="min-h-screen bg-white">
      <div className="sr-only">
        <h1>סיכום הזמנה לאירוע {event?.name}</h1>
        <p>בדוק את פרטי ההזמנה שלך, הזן פרטי נוסעים ואשר את התנאים כדי להשלים את ההזמנה</p>
      </div>
      <Modal
        title={isTimeout ? "הזמן אזל" : "הכרטיסים שלכם שמורים!"}
        description={
          isTimeout
            ? "לצערנו היינו חייבים לשחרר את ההזמנה"
            : `יש לכם 15 דקות להשלים את ההזמנה ולא לאבד את הכרטיסים שבחרתם במחיר זה`
        }
        action={
          <Button
            variant="secondary"
            className="font-bold w-full"
            onClick={HandleTimeoutModalAction}
            aria-label={isTimeout ? "התחל הזמנה חדשה" : "סגור הודעת זמן"}
          >
            {isTimeout ? "שננסה מחדש?" : "הבנתי"}
          </Button>
        }
        opened={openModal}
        iconType="Clock9"
      />
      <LoaderWrapper
        isLoading={isSubmitting}
        position="unset"
        text={
          <div className="text-lg font-bold text-center">
            {isPayNow
              ? "הינכם מועברים לעמוד תשלום מאובטח, אנא המתינו..."
              : "הינכם מועברים לסיכום ההזמנה..."}
          </div>
        }
      >
        {/* Main Content */}
        <main className="max-w-[1200px] mx-auto lg:px-6 py-4">
          {agentCommission > 0 && (
            <div>
              <AgentMode
                isAgentMode={isAgentMode}
                onToggleAgentMode={() => setIsAgentMode(!isAgentMode)}
                onPrintForClient={handlePrintForClient}
              />

              {isAgentMode && (
                <AgentPrintSettings
                  logoUrl={logoUrl}
                  setLogoUrl={setLogoUrl}
                  finalPrice={finalPrice}
                  setFinalPrice={setFinalPrice}
                  originalPrice={finalPurchasePrice}
                />
              )}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4 order-1 md:order-1">
              <Card className="bg-white shadow-lg overflow-hidden">
                <div className="bg-[#277e89] text-white py-4 px-6 flex flex-row justify-between items-center">
                  <Timer onTimeElapsed={HandleTimeout} duration={TIMEOUT} />
                  <div className="flex items-center gap-2">
                    <ShareButton shareText={shareText} />
                    <h2 className="text-2xl font-bold text-right">
                      סיכום הזמנה
                    </h2>
                  </div>
                </div>
                <div className="flex flex-row justify-between items-center py-4 px-6 border-b border-gray-400">
                  <div>
                    <div className="flex justify-between items-baseline w-full text-[18px] gap-2 font-bold">
                      <span className="text-xl">
                        ${finalPurchasePrice.toLocaleString("en-US")}
                      </span>
                      {agentCommission <= 0 &&
                        isNumberOfPersonsEqual &&
                        recommendedPriceAllPax > finalPurchasePrice && (
                          <span className="line-through text-[red]">
                            ${recommendedPriceAllPax.toLocaleString("en-US")}
                          </span>
                        )}
                    </div>
                    <div className="flex justify-left items-center w-full text-gray-500 gap-1">
                      <span>לאדם</span>
                      <span>
                        $
                        {Math.ceil(
                          finalPurchasePrice / numberOfPersons
                        ).toLocaleString("en-US")}
                      </span>
                    </div>
                    <div dir="rtl" className="text-left">
                      {finalPurchasePriceILS.toLocaleString("en-US")} ש&quot;ח
                    </div>
                  </div>
                  <div
                    className="flex flex-col items-start font-bold"
                    dir="rtl"
                  >
                    <span className="text-[22px] ">סה&quot;כ</span>
                    {agentCommission > 0 ? (
                      <span className="text-[14px]" style={{ color: "green" }}>
                        עמלה צפויה $
                        {(
                          (agentCommission / 100) *
                          finalPurchasePrice
                        ).toLocaleString("en-US")}
                      </span>
                    ) : (
                      affDiscount > 0 && (
                        <span
                          className="text-[14px]"
                          style={{ color: "green" }}
                        >
                          כולל הנחת $
                          {(affDiscount * numberOfEventTickets).toLocaleString(
                            "en-US"
                          )}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <div className="py-4 px-6 space-y-3 text-right">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">{event.name}</h2>
                    <p className="text-lg">
                      {event.location.name +
                        " | " +
                        dayjs(event.date).format("DD/MM/YYYY")}
                    </p>
                    <div className="font-lg" dir="rtl">
                      מחיר חבילה התחלתי לאדם: $
                      {packRecommendedPrice.toLocaleString("en-US")}
                    </div>
                  </div>
                  <div className="">
                    <h3 className="font-bold text-lg">
                      כרטיסים{" "}
                      <span>
                        {"("}
                        {numberOfEventTickets}
                        {" כרטיסים)"}
                      </span>
                    </h3>
                    <div className="flex justify-between items-center w-full">
                      <div
                        className="flex w-full text-[16px] justify-between gap-1"
                        dir="rtl"
                      >
                        <div className="flex gap-[2px]">
                          <div className="ml-1">
                            קטגוריה:{" "}
                            <span className="font-bold">
                              {eventTicket.category}
                            </span>
                          </div>
                          {agentCommission <= 0 && (
                            <div>
                              {eventTicketPriceAddition ? (
                                <>
                                  ({formatPrice(eventTicketPriceAddition)}
                                  )/לכרטיס
                                </>
                              ) : (
                                ""
                              )}
                            </div>
                          )}
                        </div>
                        {agentCommission <= 0 && (
                          <div>
                            {eventTicketPriceAddition
                              ? formatPrice(eventTicketPriceAddition, {
                                  factor: numberOfEventTickets,
                                  applyColor: true,
                                  bold: true,
                                })
                              : "כלול במחיר"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="">
                    <h3 className="font-bold text-lg">
                      לינה{" "}
                      <span>
                        {"("}
                        {selectedHotel.guests.reduce(
                          (ppl, room) =>
                            ppl + room.children.length + room.adults,
                          0
                        )}
                        {" אורחים)"}
                      </span>
                    </h3>
                    <div className="flex w-full justify-between" dir="rtl">
                      <div>
                        <p className="font-bold" dir="ltr">
                          {selectedHotel.name}
                        </p>
                        <p dir="ltr">
                          {selectedHotel.rate.room_data_trans.main_name}
                        </p>
                        <div className="flex items-center gap-1">
                          <div>
                            {`${selectedHotel.guests.reduce(
                              (ppl, room) =>
                                ppl + room.children.length + room.adults,
                              0
                            )} אורחים`}
                          </div>
                          <div>
                            {selectedHotel.guests.length > 1 &&
                              ` | ${selectedHotel.guests.length} חדרים`}{" "}
                            {agentCommission <= 0 && hotelPriceAddition ? (
                              <>({formatPrice(hotelPriceAddition)})/לאורח</>
                            ) : (
                              ""
                            )}
                          </div>
                        </div>
                      </div>
                      {agentCommission <= 0 && (
                        <div>
                          {hotelPriceAddition
                            ? formatPrice(hotelPriceAddition, {
                                factor: totalGuests,
                                applyColor: true,
                                bold: true,
                              })
                            : "כלול במחיר"}
                        </div>
                      )}
                    </div>
                    <div className="flex text-[16px]" dir="rtl">
                      <div>מ-</div>
                      <div>
                        {dayjs(selectedHotel.checkin).format(
                          // pass check-in and check-out dates to selectedhotel (need to chaned hotel order type)
                          "DD/MM/YYYY"
                        )}
                      </div>
                      <div className="w-1"></div>
                      <div>עד-</div>
                      <div>
                        {dayjs(selectedHotel.checkout).format("DD/MM/YYYY")}
                      </div>
                    </div>
                  </div>
                  <div className="">
                    <h3 className="font-bold text-lg">
                      טיסה{" "}
                      <span>
                        {"("}
                        {selectedFlight.numOfTravelers}
                        {" נוסעים)"}
                      </span>
                    </h3>
                    <div className="flex justify-between w-full" dir="rtl">
                      <div>
                        <div
                          className="text-[16px] flex items-center"
                          dir="rtl"
                        >
                          <div className="font-bold ml-1" dir="ltr">
                            {airlineName}
                          </div>
                          {agentCommission <= 0 && (
                            <div>
                              {formatPrice(flightPriceAddition) ? (
                                <>({formatPrice(flightPriceAddition)})/לנוסע</>
                              ) : (
                                ""
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex text-[16px]" dir="rtl">
                          <div>מ-</div>
                          <div>
                            {dayjs(
                              selectedFlight.outbound.departureTime
                            ).format("DD/MM/YYYY")}
                          </div>
                          <div className="w-1"></div>
                          <div>עד-</div>
                          <div>
                            {dayjs(selectedFlight.inbound.departureTime).format(
                              "DD/MM/YYYY"
                            )}
                          </div>
                        </div>
                      </div>
                      {agentCommission <= 0 && (
                        <div>
                          {formatPrice(flightPriceAddition)
                            ? formatPrice(flightPriceAddition, {
                                factor: selectedFlight.numOfTravelers,
                                applyColor: true,
                                bold: true,
                              })
                            : "כלול במחיר"}
                        </div>
                      )}
                    </div>
                    <div className="h-1"></div>
                    <div className="text-[12px] mt-2 px-2" dir="rtl">
                      <FlightMeta {...selectedFlight.outbound} />
                      <FlightMeta {...selectedFlight.inbound} />
                    </div>
                  </div>
                </div>
              </Card>

              <div
                className="hidden md:flex flex-col mr-2 mt-4 mb-2 text-right"
                dir="rtl"
              >
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked: boolean) => {
                        setTermsAccepted(checked === true);
                        setTermsCheckboxTouched(true);
                      }}
                    />
                  </div>
                  <div className="flex items-center">
                    <Label htmlFor="terms" className="text-sm mr-2">
                      אני מאשר/ת שקראתי את
                    </Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          className="text-sm mr-1 text-blue-600 hover:underline"
                          name="terms"
                          type="button"
                          aria-label="קרא את התנאים וההגבלות"
                        >
                          התנאים וההגבלות
                        </button>
                      </DialogTrigger>
                      <DialogContent
                        className="max-w-md max-h-[80vh] overflow-y-auto"
                        dir="rtl"
                      >
                        <DialogHeader>
                          <DialogTitle className="text-right text-xl font-bold">
                            תנאים כלליים ודמי ביטול
                          </DialogTitle>
                        </DialogHeader>
                        <div className="text-right">
                          <p className="">
                            <a
                              href="/terms"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              תנאי שימוש באתר
                            </a>
                          </p>
                          <p className="mt-1">
                            <a
                              href="/cancellation"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              כללי ביטול הזמנה
                            </a>
                          </p>
                          <h3 className="font-bold mt-4 mb-2">
                            כרטיסים לאירוע
                          </h3>
                          <p>
                            כרטיסי האירוע בדמי ביטול מלאים מרגע ביצוע ההזמנה.
                          </p>

                          <h3 className="font-bold mt-4 mb-2">טיסות</h3>
                          <Dialog>
                            <DialogTrigger asChild>
                              <a className="text-blue-600 hover:underline cursor-pointer">
                                תנאי הכרטיס עפ&quot;י המוביל האווירי.
                              </a>
                            </DialogTrigger>
                            <DialogContent
                              className="max-w-md max-h-[80vh] overflow-y-auto"
                              dir="rtl"
                            >
                              <DialogHeader>
                                <DialogTitle className="text-center text-xl font-bold">
                                  Penalties
                                </DialogTitle>
                              </DialogHeader>
                              <div
                                dir="ltr"
                                className="text-left"
                                dangerouslySetInnerHTML={{ __html: penText() }}
                              />
                            </DialogContent>
                          </Dialog>
                          <p>
                            עלות הטיפול בביטול הטיסה הינה $50 לכל כרטיס טיסה
                            בנוסף לדמי הביטול של המוביל האווירי.
                          </p>

                          <h3 className="font-bold mt-4 mb-2">מלון</h3>
                          <p>
                            החזר מלא או שינוי חינם עד לתאריך ה-{" "}
                            {dayjs(
                              selectedHotel.rate.payment_options
                                ?.payment_types[0].cancellation_penalties
                                .free_cancellation_before
                            )
                              .subtract(7, "day")
                              .format("DD/MM/YYYY")}
                            , לאחר מכן דמי ביטול מלאים.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                {termsCheckboxTouched && !termsAccepted && <TermsError />}{" "}
              </div>
              {/* Payment security logos */}
              <div className="flex items-center justify-center gap-4 my-4 hidden md:flex">
                <Image
                  src="/amex.svg"
                  alt="American Express"
                  width={40}
                  height={25}
                  className="h-6 w-auto"
                  unoptimized
                />
                <Image
                  src="/logo__pci.svg"
                  alt="PCI Compliant"
                  width={40}
                  height={25}
                  className="h-7 w-auto"
                  unoptimized
                />
                <Image
                  src="/mastercardSecuerd.png"
                  alt="Mastercard Secure"
                  width={50}
                  height={30}
                  className="h-8 w-auto"
                  unoptimized
                />
                <Image
                  src="/VisaVerify.png"
                  alt="Visa Verified"
                  width={50}
                  height={30}
                  className="h-8 w-auto"
                  unoptimized
                />
              </div>

              {/* CTA Button */}
              <Button
                onClick={(e) => handleSubmit(e, true)}
                className="w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] hidden md:block"
                disabled={isSubmitting}
                aria-label="המשך לתשלום מאובטח בכרטיס אשראי"
              >
                המשך לתשלום מאובטח
              </Button>

              <Button
                onClick={handleSubmit}
                variant={"link"}
                className="w-full text-[14px] font-bold !mt-0 underline h-[52px] hidden md:block"
                disabled={isSubmitting}
                aria-label="דבר עם נציג לקבלת עזרה"
              >
                צריך עזרה? דבר עם נציג
              </Button>
            </div>
            <div className="space-y-6 order-2 md:order-2">
              <Card className="bg-white shadow-lg overflow-hidden">
                <div className="px-8 pt-6 pb-8">
                  <h2 className="text-2xl font-bold mb-4 text-right" id="passenger-details-heading">
                    פרטי הנוסעים
                  </h2>
                  <h3 className="text-lg mb-4 text-right">
                    יש להזין שמות כפי שמופיעים בדרכון
                  </h3>
                  <form 
                    className="space-y-5" 
                    dir="rtl"
                    aria-labelledby="passenger-details-heading"
                    noValidate
                  >
                    {passengers.map(
                      (
                        passenger,
                        index // TO DO: לוודא שזה לפי מספר הטסים.
                      ) => (
                        <div key={index} className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium text-[15px]" id={`passenger-${index}-heading`}>
                              נוסע {index + 1}
                            </h3>
                          </div>
                          <fieldset className="grid grid-cols-2 gap-4" aria-labelledby={`passenger-${index}-heading`}>
                            <div className="space-y-1">
                              <Label htmlFor={`firstName-${index}`} className="sr-only">
                                שם פרטי באנגלית לנוסע {index + 1}
                              </Label>
                              <Input
                                id={`firstName-${index}`}
                                dir="rtl"
                                name="first-name"
                                data-mp-allow="true"
                                autoComplete="given-name"
                                type="text"
                                placeholder="שם פרטי באנגלית"
                                aria-label={`שם פרטי באנגלית לנוסע ${index + 1}`}
                                aria-required="true"
                                aria-invalid={touched[index]?.firstName && !!validationErrors[index]?.firstName}
                                aria-describedby={
                                  touched[index]?.firstName && validationErrors[index]?.firstName 
                                    ? `firstName-error-${index}` 
                                    : undefined
                                }
                                className={cn(
                                  "h-11 text-right",
                                  touched[index]?.firstName &&
                                    validationErrors[index]?.firstName &&
                                    "border-red-500 focus-visible:ring-red-500"
                                )}
                                value={passenger.firstName}
                                onChange={(e) =>
                                  updatePassenger(
                                    index,
                                    "firstName",
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleBlur(index, "firstName")}
                              />
                              {touched[index]?.firstName &&
                                validationErrors[index]?.firstName && (
                                  <p 
                                    id={`firstName-error-${index}`}
                                    className="text-sm text-red-500 text-right"
                                    role="alert"
                                    aria-live="polite"
                                  >
                                    {validationErrors[index].firstName}
                                  </p>
                                )}
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`lastName-${index}`} className="sr-only">
                                שם משפחה באנגלית לנוסע {index + 1}
                              </Label>
                              <Input
                                id={`lastName-${index}`}
                                dir="rtl"
                                placeholder="שם משפחה באנגלית"
                                type="text"
                                data-mp-allow="true"
                                name="last-name"
                                autoComplete="family-name"
                                aria-label={`שם משפחה באנגלית לנוסע ${index + 1}`}
                                aria-required="true"
                                aria-invalid={touched[index]?.lastName && !!validationErrors[index]?.lastName}
                                aria-describedby={
                                  touched[index]?.lastName && validationErrors[index]?.lastName 
                                    ? `lastName-error-${index}` 
                                    : undefined
                                }
                                className={cn(
                                  "h-11 text-right",
                                  touched[index]?.lastName &&
                                    validationErrors[index]?.lastName &&
                                    "border-red-500 focus-visible:ring-red-500"
                                )}
                                value={passenger.lastName}
                                onChange={(e) =>
                                  updatePassenger(
                                    index,
                                    "lastName",
                                    e.target.value
                                  )
                                }
                                onBlur={() => handleBlur(index, "lastName")}
                              />
                              {touched[index]?.lastName &&
                                validationErrors[index]?.lastName && (
                                  <p 
                                    id={`lastName-error-${index}`}
                                    className="text-sm text-red-500 text-right"
                                    role="alert"
                                    aria-live="polite"
                                  >
                                    {validationErrors[index].lastName}
                                  </p>
                                )}
                            </div>
                          </fieldset>
                          {index === 0 && (
                            <>
                              <div className="space-y-1">
                                <Input
                                  dir="rtl"
                                  placeholder="אימייל"
                                  type="email"
                                  name="email"
                                  autoComplete="email"
                                  className={cn(
                                    "h-11 text-right",
                                    touched[index]?.email &&
                                      validationErrors[index]?.email &&
                                      "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  value={passenger.email}
                                  onChange={(e) =>
                                    updatePassenger(
                                      index,
                                      "email",
                                      e.target.value
                                    )
                                  }
                                  onBlur={() => handleBlur(index, "email")}
                                />
                                {touched[index]?.email &&
                                  validationErrors[index]?.email && (
                                    <p className="text-sm text-red-500 text-right">
                                      {validationErrors[index].email}
                                    </p>
                                  )}
                              </div>

                              <div className="space-y-1">
                                <Input
                                  dir="rtl"
                                  placeholder="טלפון נייד"
                                  name="phone"
                                  type="tel"
                                  autoComplete="tel"
                                  className={cn(
                                    "h-11 text-right",
                                    touched[index]?.phone &&
                                      validationErrors[index]?.phone &&
                                      "border-red-500 focus-visible:ring-red-500"
                                  )}
                                  value={passenger.phone}
                                  onChange={(e) =>
                                    updatePassenger(
                                      index,
                                      "phone",
                                      e.target.value
                                    )
                                  }
                                  onBlur={() => handleBlur(index, "phone")}
                                />
                                {touched[index]?.phone &&
                                  validationErrors[index]?.phone && (
                                    <p className="text-sm text-red-500 text-right">
                                      {validationErrors[index].phone}
                                    </p>
                                  )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    )}
                  </form>
                </div>
              </Card>
              {agentCommission <= 0 && (
                <Card
                  className="bg-white shadow-lg overflow-hidden order-4 md:order-3"
                  dir="rtl"
                >
                  {(() => {
                    const items = [
                      {
                        title: "100% אחריות",
                        description:
                          "מגה תיירות היא אחת מקבוצות התיירות המובילות בישראל, עם מעל ל-30 שנות ניסיון ואלפי לקוחות מרוצים.",
                      },
                      {
                        title: "כרטיסים מובטחים",
                        description:
                          "הכרטיסים הינם מספקים רשמיים בלבד והם 100% בטוחים –אנחנו מתחייבים שתקבלו את מה ששילמתם עליו, בראש שקט",
                      },
                      {
                        title: "שירות אישי ואנושי",
                        description:
                          "הצוות שלנו זמין עבורכם לפני, בזמן ואחרי החופשה בטל. 054-200-2722 (גם בוואטספ!)",
                      },
                    ];

                    return (
                      <div className="bg-white p-4 md:p-8 space-y-6 mx-auto text-right">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex">
                            <Image
                              src="/icons/checkmark-wavey-circle.svg"
                              alt="check"
                              width={24}
                              height={24}
                              className="w-7 h-7 mt-1"
                              unoptimized
                            />
                            <div className="flex-1 pr-4">
                              <h3 className="text-lg font-semibold text-gray-800">
                                {item.title}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>
              )}
              <div
                className="flex md:hidden flex-col mr-2 mt-4 mb-2 text-right"
                dir="rtl"
              >
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Checkbox
                      id="terms-mobile"
                      checked={termsAccepted}
                      onCheckedChange={(checked: boolean) => {
                        setTermsAccepted(checked === true);
                        setTermsCheckboxTouched(true);
                      }}
                    />
                  </div>
                  <div className="flex items-center">
                    <Label htmlFor="terms-mobile" className="text-sm mr-2">
                      אני מאשר/ת שקראתי את
                    </Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          className="text-sm mr-1 text-blue-600 hover:underline"
                          name="terms"
                          type="button"
                          aria-label="קרא את התנאים וההגבלות"
                        >
                          התנאים וההגבלות
                        </button>
                      </DialogTrigger>
                      <DialogContent
                        className="max-w-md max-h-[80vh] overflow-y-auto"
                        dir="rtl"
                      >
                        <DialogHeader>
                          <DialogTitle className="text-right text-xl font-bold">
                            תנאים כלליים ודמי ביטול
                          </DialogTitle>
                        </DialogHeader>
                        <div className="text-right">
                          <p>
                            <a
                              href="/terms"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              תנאי שימוש באתר
                            </a>
                          </p>
                          <p>
                            <a
                              href="/cancellation"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              כללי ביטול הזמנה
                            </a>
                          </p>
                          <h3 className="font-bold mt-4">כרטיסים לאירוע</h3>
                          <p>
                            כרטיסי האירוע בדמי ביטול מלאים מרגע ביצוע ההזמנה.
                          </p>
                          <h3 className="font-bold mt-4">טיסות</h3>
                          <Dialog>
                            <DialogTrigger asChild>
                              <a className="text-blue-600 hover:underline cursor-pointer">
                                תנאי הכרטיס עפ&quot;י המוביל האווירי.
                              </a>
                            </DialogTrigger>
                            <DialogContent
                              className="max-w-md max-h-[80vh] overflow-y-auto"
                              dir="rtl"
                            >
                              <DialogHeader>
                                <DialogTitle className="text-center text-xl font-bold">
                                  Penalties
                                </DialogTitle>
                              </DialogHeader>
                              <div
                                dir="ltr"
                                className="text-left"
                                dangerouslySetInnerHTML={{ __html: penText() }}
                              />
                            </DialogContent>
                          </Dialog>
                          <p>
                            עלות הטיפול בביטול הטיסה הינה $50 לכל כרטיס טיסה
                            בנוסף לדמי הביטול של המוביל האווירי.
                          </p>
                          <h3 className="font-bold mt-4">מלון</h3>
                          <p>
                            ביטול או שינוי חינם עד לתאריך ה-{" "}
                            {dayjs(
                              selectedHotel.rate.payment_options
                                ?.payment_types[0].cancellation_penalties
                                .free_cancellation_before
                            )
                              .subtract(7, "day")
                              .format("DD/MM/YYYY")}
                            , לאחר מכן דמי ביטול מלאים.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                {termsCheckboxTouched && !termsAccepted && <TermsError />}{" "}
              </div>
              {/* Payment security logos */}
              <div className="flex items-center justify-center gap-4 my-4 md:hidden">
                <Image
                  src="/amex.svg"
                  alt="American Express"
                  width={40}
                  height={25}
                  className="h-6 w-auto"
                  unoptimized
                />
                <Image
                  src="/logo__pci.svg"
                  alt="PCI Compliant"
                  width={40}
                  height={25}
                  className="h-7 w-auto"
                  unoptimized
                />
                <Image
                  src="/mastercardSecuerd.png"
                  alt="Mastercard Secure"
                  width={50}
                  height={30}
                  className="h-8 w-auto"
                  unoptimized
                />
                <Image
                  src="/VisaVerify.png"
                  alt="Visa Verified"
                  width={50}
                  height={30}
                  className="h-8 w-auto"
                  unoptimized
                />
              </div>
              {/* CTA Button */}
              <Button
                onClick={(e) => handleSubmit(e, true)}
                className="w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] block md:hidden"
                disabled={isSubmitting}
                aria-label="המשך לתשלום מאובטח בכרטיס אשראי"
              >
                המשך לתשלום מאובטח
              </Button>

              <Button
                onClick={handleSubmit}
                variant={"link"}
                className="w-full text-[14px] font-bold !mt-0 underline h-[52px] block md:hidden"
                disabled={isSubmitting}
                aria-label="דבר עם נציג לקבלת עזרה"
              >
                צריך עזרה? דבר עם נציג
              </Button>
            </div>
          </div>
        </main>
      </LoaderWrapper>
    </div>
  );
}
