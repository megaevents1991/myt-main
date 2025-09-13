"use client";

import type React from "react";

import { useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { trackEvent, getUTMParams } from "@/lib/mixpanel";
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
import { useIsMobile } from "../hooks/useIsMobile";

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
    passengers: passengersContext,
    setPassengers: setPassengersContext,
  } = useContext(OrderContext);
  const router = useRouter();
  const { isMobile } = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { affId, affDiscount, agentCommission, setAffDiscount } = useFetchAffiliate();
  const [validationErrors, setValidationErrors] = useState<
    { [key: string]: string }[]
  >(Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({})));
  const [passengers, setPassengers] = useState(
    passengersContext ||
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
  const [termsAccepted, setTermsAccepted] = useState(
    //If there are passengers in context from existing order, assume terms were accepted, we can keep separate state for it if needed in the future
    passengersContext ? true : false
  );
  const [termsCheckboxTouched, setTermsCheckboxTouched] = useState(false);
  const {
    numberOfPersons,
    finalPurchasePriceCalc,
    finalPurchasePriceILSCalc,
    recommendedPriceAllPax,
    isNumberOfPersonsEqual,
    eventTicketPriceAddition,
    flightPriceAddition,
    airlineName,
    airlineFullName,
    hotelPriceAddition,
    totalGuests,
  } = useOrderVars();

  useEffect(() => {
    return () => {
      // Cleanup on unmount, clear passengers in context to avoid stale data
      setPassengersContext(undefined);
    };
  }, []);

  const [openModal, setOpenModal] = useState(true);
  const [isTimeout, setIsTimeout] = useState(false);
  const [isPayNow, setIsPayNow] = useState(false);
  // Special offer (inactivity) modal state
  const [specialOfferOpen, setSpecialOfferOpen] = useState(false);
  const hasInteractedRef = useRef(false);
  const inactivityTimeoutRef = useRef<number | null>(null);

  // Sticky footer state and refs
  const [showStickyFooter, setShowStickyFooter] = useState(false);
  const [showStickyOptions, setShowStickyOptions] = useState(false);
  const originalButtonRef = useRef<HTMLButtonElement>(null);
  const passengerDetailsRef = useRef<HTMLDivElement>(null);
  const stickyFooterRef = useRef<HTMLDivElement>(null);

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
            tags: event?.tags,
          },
          eventType: "view_cart",
          gtmIdnts,
        }),
      });
    } catch (error) {
      console.warn("Analytics tracking failed:", error);
    }
  };

  const finalPurchasePrice = useMemo(
    () => finalPurchasePriceCalc(affDiscount),
    [finalPurchasePriceCalc, affDiscount]
  );
  const [finalPurchasePriceILS, setFinalPurchasePriceILS] = useState<number>(0);
  const [usd_ils_rate, setUSD_ILS_RATE] = useState<number>(3.7);


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

  // Scroll listener for sticky footer
  useEffect(() => {
    const handleScroll = () => {
      if (originalButtonRef.current && isMobile) {
        const buttonRect = originalButtonRef.current.getBoundingClientRect();
        const isButtonVisible = buttonRect.top < window.innerHeight && buttonRect.bottom > 0;
        
        // Show sticky footer when original button is not visible and we're on mobile
        const shouldShowSticky = !isButtonVisible;
        setShowStickyFooter(shouldShowSticky);
        
        // Close options when sticky footer disappears
        if (!shouldShowSticky) {
          setShowStickyOptions(false);
        }
      } else {
        setShowStickyFooter(false);
        setShowStickyOptions(false);
      }
    };

    if (isMobile) {
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
      
      // Initial check
      handleScroll();

      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isMobile]);

  // Click outside handler for sticky options
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stickyFooterRef.current && !stickyFooterRef.current.contains(event.target as Node)) {
        setShowStickyOptions(false);
      }
    };

    if (showStickyOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showStickyOptions]);

  // Inactivity detection for special offer (desktop + mobile)
  useEffect(() => {
    // Only for non-agent bookings and only when initial info modal is closed
    if (agentCommission > 0 || openModal) return;

    const handleUserInteraction = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        if (inactivityTimeoutRef.current) {
          window.clearTimeout(inactivityTimeoutRef.current);
          inactivityTimeoutRef.current = null;
        }
      }
    };

    // Start one-shot inactivity timer (20s) from when the page is ready for interaction
    inactivityTimeoutRef.current = window.setTimeout(() => {
      if (!hasInteractedRef.current) {
        setSpecialOfferOpen(true);
      }
    }, 20000);

    // Listen broadly for interactions on the page
    document.addEventListener("click", handleUserInteraction, true);
    document.addEventListener("keydown", handleUserInteraction, true);
    document.addEventListener("input", handleUserInteraction, true);
    document.addEventListener("touchstart", handleUserInteraction, true);

    return () => {
      document.removeEventListener("click", handleUserInteraction, true);
      document.removeEventListener("keydown", handleUserInteraction, true);
      document.removeEventListener("input", handleUserInteraction, true);
      document.removeEventListener("touchstart", handleUserInteraction, true);
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [agentCommission, openModal]);

  const setErrors = (requireAllPassengers = false) => {
    const allErrors = [...validationErrors];
    passengers.forEach((passenger, index) => {
      (["firstName", "lastName", "phone", "email"] as Fields[]).forEach(
        (field) => {
          let error = "";
          const value = passenger[field];
          const isMainContact = index === 0;

          if (requireAllPassengers) {
            // For payment (המשך לתשלום), validate all passengers' names
            if (field === "firstName" || field === "lastName") {
              error = validate[field](value);
            } else if (field === "phone" || field === "email") {
              // Phone and email only required for main contact
              if (isMainContact) {
                error = validate[field](value);
              }
            }
          } else {
            // For נציג/שמירה, only validate main contact
            if (isMainContact) {
              if (field === "phone" || field === "email") {
                error = validate[field](value);
              } else {
                error = validate[field](value);
              }
            } else {
              // For additional passengers, only validate if the field has a value
              if (value && value.trim() !== "") {
                error = validate[field](value);
              }
            }
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

      const isMainContact = index === 0;
      let error = "";

      if (isMainContact) {
        // For main contact, always validate (required fields)
        error = validate[field](finalValue);
      } else {
        // For additional passengers, only validate if field has content
        if (finalValue && finalValue.trim() !== "") {
          error = validate[field](finalValue);
        }
      }

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
    const isMainContact = index === 0;
    let error = "";

    if (isMainContact) {
      // For main contact, always validate (required fields)
      error = validate[field](value);
    } else {
      // For additional passengers, only validate if field has content
      if (value && value.trim() !== "") {
        error = validate[field](value);
      }
    }

    if (error) {
      const newErrors = [...validationErrors];
      newErrors[index] = { ...newErrors[index], [field]: error };
      setValidationErrors(newErrors);
    } else {
      // Clear error if validation passes
      const newErrors = [...validationErrors];
      if (newErrors[index]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [field]: _, ...rest } = newErrors[index];
        newErrors[index] = rest;
        setValidationErrors(newErrors);
      }
    }
  };

  const submitOrder = async (
    orderData: Omit<OrderData, "booking_reference" | "confirmation_email_sent">,
    payNow: boolean,
    onlySave: boolean
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
        onlySave,
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

  const handleSubmit = async (
    e: React.FormEvent,
    payNow = false,
    onlySave = false
  ) => {
    e.preventDefault();
    setTermsCheckboxTouched(true);

    // Set errors based on the action type
    setErrors(payNow);
    
    // Set touched fields based on action type
    const touched = passengers.map((_, index) => ({
      firstName: payNow ? true : (index === 0 ? true : false),
      lastName: payNow ? true : (index === 0 ? true : false),
      phone: payNow ? (index === 0 ? true : false) : (index === 0 ? true : false), // Phone only for main contact
      email: payNow ? (index === 0 ? true : false) : (index === 0 ? true : false), // Email only for main contact
    }));
    setTouched(touched);

    // Check if form is valid after validation based on action type
    const isValidForAction = isFormValidForAction(payNow);
    if (!isValidForAction || isSubmitting) {
      // If validation fails, scroll to passenger details section
      if (!isValidForAction && passengerDetailsRef.current) {
        passengerDetailsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      return;
    }

    if (!termsAccepted) {
      setIsSubmitting(false);
      // Scroll to passenger details if terms not accepted as well
      if (passengerDetailsRef.current) {
        passengerDetailsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
      return;
    }
    setIsPayNow(payNow);
    setPaymentMethod(payNow ? "credit_card" : "phone_order");
    setIsSubmitting(true);

    const utmParams = getUTMParams() as { [key: string]: string };

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
      aff_partner_tracking_code: affId || utmParams.source || "",
      is_agent_booking: agentCommission > 0,
    };

    try {
      const result = await submitOrder(updatedFormData, payNow, onlySave);

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
        // Redirect to the order confirmation page.
        // If this was a 24h hold (onlySave), append a query param so the confirmation screen can show hold-specific messaging.
        const basePath = `/confirmation/${result.id}/${result.newPromoterCode}`;
        const targetPath = onlySave ? `${basePath}?onlySave=1` : basePath;
        router.push(targetPath);
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

  const isFormValidForAction = (requireAllPassengers: boolean) =>
    passengers.every((passenger, i) => {
      const hasErrors = Object.keys(validationErrors[i]).length > 0;
      const isMainContact = i === 0;
      
      if (requireAllPassengers) {
        // For payment (המשך לתשלום), require all passengers' names
        const hasRequiredFields = passenger.firstName && passenger.lastName;
        const hasContactInfo = !isMainContact || (passenger.phone && passenger.email);
        return !hasErrors && hasRequiredFields && hasContactInfo;
      } else {
        // For נציג/שמירה, only validate first passenger completely
        if (isMainContact) {
          const hasRequiredFields = passenger.firstName && passenger.lastName;
          const hasContactInfo = passenger.phone && passenger.email;
          return !hasErrors && hasRequiredFields && hasContactInfo;
        } else {
          // For additional passengers, only check for errors if fields are filled
          return !hasErrors;
        }
      }
    }) && termsAccepted;

  const TermsError = () => (
    <p className="text-sm text-red-500 text-center mt-1">
      יש לאשר את פרטי ההזמנה ותנאי השימוש
    </p>
  );

  const HandleTimeoutModalAction = () => {
    setOpenModal(false);
    if (isTimeout) {
      setStep(1);
    }
  };

  const handleSpecialOfferAccept = () => {
    // Close modal and apply $70 discount per person (per ticket)
    setSpecialOfferOpen(false);
    if (agentCommission <= 0) {
      const newDiscount = affDiscount > 50
        ? 100
        : affDiscount > 10
        ? affDiscount * 2
        : 60;
      setAffDiscount(newDiscount);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sr-only">
        <h1>סיכום הזמנה לאירוע {event?.name}</h1>
        <p>
          בדוק את פרטי ההזמנה שלך, הזן פרטי נוסעים ואשר את התנאים כדי להשלים את
          ההזמנה
        </p>
      </div>
      <Modal
        title={
          isTimeout
            ? "הזמן אזל"
            : "היי, אתם כבר כמעט שם 🎉"
        }
        description={
          isTimeout ? (
            "לצערנו היינו חייבים לשחרר את ההזמנה"
          ) : (
            <>
              המחיר אצלנו שקוף והוגן - מוצג גם בשקלים, מחויב בשקלים, בלי עמלות ובלי הפתעות.
              <br /> <br />
              אגב, הכרטיסים שמורים לכם ל-15 דקות, מספיק זמן לסגור את ההזמנה בראש שקט.
            </>
          )
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
        iconType="Plane"
      />
      {/* Special offer modal - triggered by 20s of inactivity, non-agent only */}
      <Modal
        title="הנה משהו מאיתנו לתחילת השנה"
        description={<>
          היי, <br />תפסתם אותנו באווירה טובה!<br />נשמח לפרגן לכם בהנחה מיוחדת
        </>}
        action={
          <Button
            variant="secondary"
            className="font-bold w-full"
            onClick={handleSpecialOfferAccept}
            aria-label="אשמח להנחה"
          >
            אשמח להנחה
          </Button>
        }
        opened={agentCommission <= 0 && specialOfferOpen}
        iconType="Beer"
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
        <main className={cn("max-w-[1200px] mx-auto lg:px-6 py-4", showStickyFooter && (showStickyOptions ? "pb-32" : "pb-24"))}>
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
                            {airlineFullName}
                          </div>
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

              {/* Mobile: Payment security logos moved directly after summary (before passenger details) */}
              <div className="flex items-center justify-center gap-4 !my-8 md:hidden">
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

              {/* Mobile: Interest-free installment banner (restyled to appear informational, not a button) */}
              <div
                className="md:hidden w-full !my-8 px-4"
                aria-label="תשלומים ללא ריבית 5"
              >
                <div className="w-full rounded-md bg-secondary/10  border-secondary/40 text-secondary text-center py-2.5 px-3 text-[15px] font-semibold leading-snug tracking-wide shadow-sm">
                  <span dir="rtl" className="inline-block align-middle">
                    5 תשלומים ללא ריבית בכרטיס אשראי
                  </span>
                </div>
              </div>

              {/* Mobile: Trust section repositioned right after payment logos */}
              <div className="md:hidden">
                <div
                  className="flex justify-around items-center text-right container"
                  dir="rtl"
                >
                  {(() => {
                    const garuarntees = [
                      {
                        svg: (
                          <svg
                            width="36"
                            height="36"
                            viewBox="0 0 36 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M32.6768 4.03516C33.047 4.03522 33.3457 4.32524 33.3457 4.68945V10.9434C33.3456 11.8852 33.0311 12.7547 32.4863 13.4561V29.0029C32.4863 30.6431 31.1174 31.9648 29.4375 31.9648H6.56445C4.88458 31.9648 3.51562 30.6431 3.51562 29.0029V13.4561C2.98141 12.7559 2.65536 11.8866 2.65527 10.9434V4.68945C2.65527 4.32335 2.9673 4.03516 3.3252 4.03516H32.6768ZM25.3389 13.1885C24.5721 14.3701 23.2178 15.1533 21.6699 15.1533C20.131 15.1533 18.7763 14.3699 18.001 13.1885C17.2342 14.3701 15.8799 15.1532 14.332 15.1533C12.7931 15.1533 11.4384 14.3699 10.6631 13.1885C9.8963 14.3701 8.54204 15.1532 6.99414 15.1533C6.21927 15.1533 5.48793 14.9533 4.85352 14.6045V29.0029C4.85352 29.9117 5.62326 30.6572 6.56445 30.6572H29.4375C30.3886 30.6572 31.1475 29.9123 31.1475 29.0029V14.6064C30.5207 14.9542 29.7898 15.1533 29.0078 15.1533C27.4689 15.1533 26.1142 14.3699 25.3389 13.1885ZM3.99414 10.9434C3.99435 12.5425 5.34031 13.8467 6.99414 13.8467C8.65802 13.8465 9.99296 12.5427 9.99316 10.9434V5.34277H3.99414V10.9434ZM11.332 10.9434C11.3322 12.5425 12.6782 13.8467 14.332 13.8467C15.9959 13.8466 17.3308 12.5428 17.3311 10.9434V5.34277H11.332V10.9434ZM18.6699 10.9434C18.6701 12.5425 20.0161 13.8467 21.6699 13.8467C23.3338 13.8466 24.6687 12.5428 24.6689 10.9434V5.34277H18.6699V10.9434ZM26.0078 10.9434C26.008 12.5425 27.354 13.8467 29.0078 13.8467C30.6717 13.8466 32.0066 12.5428 32.0068 10.9434V5.34277H26.0078V10.9434Z"
                              fill="#277E89"
                              stroke="#287E89"
                              strokeWidth="0.290446"
                            />
                            <path
                              d="M17.5413 17.4809C17.6862 17.0349 18.3172 17.0349 18.4621 17.4809L19.4145 20.4123C19.4793 20.6118 19.6652 20.7468 19.8749 20.7468H22.9572C23.4262 20.7468 23.6211 21.3469 23.2418 21.6225L20.7481 23.4342C20.5785 23.5575 20.5075 23.776 20.5723 23.9754L21.5248 26.9069C21.6697 27.3529 21.1592 27.7237 20.7798 27.4481L18.2862 25.6364C18.1165 25.5131 17.8868 25.5131 17.7171 25.6364L15.2235 27.4481C14.8441 27.7237 14.3337 27.3529 14.4786 26.9069L15.4311 23.9754C15.4959 23.776 15.4249 23.5575 15.2552 23.4342L12.7616 21.6225C12.3822 21.3469 12.5772 20.7468 13.0461 20.7468H16.1284C16.3381 20.7468 16.524 20.6118 16.5888 20.4123L17.5413 17.4809Z"
                              fill="#277E89"
                            />
                          </svg>
                        ),
                        title: "אלפי לקוחות מרוצים",
                        subtitle: (
                          <span>
                            <a
                              href="https://www.google.com/search?q=%D7%9E%D7%92%D7%94+%D7%AA%D7%99%D7%99%D7%A8%D7%95%D7%AA"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              מבית מגה תיירות
                            </a>
                            <br />
                            30 שנות ניסיון
                          </span>
                        ),
                      },
                      {
                        svg: (
                          <svg
                            width="37"
                            height="36"
                            viewBox="0 0 37 36"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M18.4414 0.953613C18.5016 0.960015 18.5604 0.975324 18.6162 0.998535L18.6973 1.03955L19.4385 1.46924C23.1727 3.56357 27.3254 4.81291 31.6025 5.12451L31.7188 5.14404C31.8322 5.17452 31.9357 5.23648 32.0166 5.32373C32.1244 5.43999 32.1846 5.59292 32.1846 5.75146L32.1904 6.49463C32.2031 7.32219 32.2326 8.38995 32.2656 9.58154L32.3535 13.0562C32.3789 14.2587 32.3977 15.4781 32.3984 16.6294C32.3997 18.6393 32.3477 20.4554 32.1865 21.6167L32.1113 22.0728C31.6341 24.4489 30.3662 26.6866 28.3506 28.7319L27.9375 29.1382C25.7149 31.2612 22.6006 33.2304 18.6875 34.9946V34.9937C18.6062 35.0304 18.5179 35.0503 18.4287 35.0503C18.384 35.0503 18.3394 35.045 18.2959 35.0356L18.1699 34.9937C14.7429 33.4452 11.9187 31.7157 9.77148 29.8442L9.35059 29.4683C7.26685 27.554 5.82294 25.4444 5.05957 23.1909L4.91602 22.7388C4.8052 22.3635 4.73124 21.7241 4.68262 20.894C4.63373 20.0593 4.60996 19.0177 4.60352 17.8286C4.59062 15.45 4.6485 12.4743 4.71777 9.37158L4.7627 7.24072L4.78418 5.64111C4.7848 5.48853 4.84137 5.34141 4.94238 5.22705C5.04348 5.11272 5.18261 5.03839 5.33398 5.01904L6.39258 4.87549C11.5969 4.12077 15.498 2.83633 18.0127 1.06494L18.0898 1.01807C18.1705 0.977123 18.2595 0.95419 18.3506 0.950684L18.4414 0.953613ZM18.3984 2.32178C15.6135 4.15941 11.455 5.4582 6.03711 6.19482C6.03234 6.59022 6.02487 7.04917 6.01465 7.55615L5.97559 9.40088C5.92367 11.7161 5.85864 14.6207 5.8584 17.1216C5.85828 18.3722 5.87415 19.5209 5.91602 20.4429C5.95818 21.3712 6.02553 22.0525 6.12305 22.3823L6.25293 22.7905C7.67452 26.9824 11.7506 30.6659 18.4297 33.73C25.8158 30.3507 29.9743 26.3403 30.8779 21.8296C31.0812 20.8127 31.1444 18.8409 31.1406 16.5718C31.1387 15.4399 31.12 14.2383 31.0947 13.0513L31.0088 9.61768C30.9732 8.33482 30.9417 7.19119 30.9307 6.32959C26.5109 5.92394 22.2337 4.55632 18.3984 2.32178ZM18.4443 4.75342C18.5466 4.75275 18.6475 4.77656 18.7383 4.82373H18.7393C21.7736 6.40464 25.0399 7.4933 28.416 8.04834L28.5215 8.07568C28.6238 8.11151 28.716 8.1737 28.7881 8.25635C28.884 8.36655 28.9386 8.50678 28.9424 8.65283L29.001 10.6782L29.0469 12.2202C29.0612 12.7383 29.0735 13.2585 29.083 13.7739L29.1025 14.9126C29.1133 15.6841 29.1193 16.4772 29.1143 17.2788L29.0977 18.4849L29.0928 18.7192C29.0993 19.6255 29.0316 20.5309 28.8916 21.4263L28.8906 21.4321C28.1567 25.0975 24.6998 28.4307 18.708 31.3589V31.3579C18.6219 31.4002 18.5275 31.4223 18.4316 31.4224C18.3597 31.4224 18.2882 31.4103 18.2207 31.3862L18.1543 31.3579C12.5668 28.6111 9.1572 25.4201 8.08105 21.856V21.855C8.07558 21.8366 8.07115 21.8187 8.06738 21.8013L8.06445 21.7915V21.7905C7.94401 20.9658 7.89066 20.1327 7.9043 19.2993L7.89941 18.9263L7.88574 17.7056C7.87872 16.4794 7.89177 15.2195 7.91406 13.7896L7.9834 10.5688V10.5679L8.03223 8.46631L8.04297 8.35791C8.06356 8.25174 8.11154 8.15197 8.18262 8.06885C8.27759 7.95787 8.40885 7.88307 8.55273 7.85791L9.28418 7.7251C12.8935 7.04315 15.7983 6.09353 18.1504 4.82861L18.2197 4.79639C18.2911 4.76849 18.3673 4.75395 18.4443 4.75342ZM18.4512 6.08936C15.9784 7.37007 12.9682 8.32585 9.27832 9.00439L9.24023 10.5981L9.1709 13.8071C9.14157 15.7025 9.12833 17.2954 9.15723 18.9019L9.16211 19.2847V19.2876C9.15032 20.0343 9.1944 20.7809 9.29395 21.521C10.2473 24.632 13.3009 27.5202 18.4326 30.0894C23.9528 27.344 27.0254 24.3427 27.6582 21.1841C27.7829 20.361 27.8415 19.5292 27.835 18.6968V18.6929L27.9854 18.6958L27.8359 18.6929L27.8398 18.4575L27.8564 17.2671C27.8613 16.4755 27.8554 15.6908 27.8447 14.9263L27.8262 13.7974C27.8073 12.7746 27.7754 11.7289 27.7441 10.7173L27.7432 10.7163C27.7282 10.2191 27.7124 9.70867 27.6982 9.19971C24.4807 8.61919 21.3656 7.57149 18.4512 6.08936ZM21.4365 14.4331C21.5677 14.429 21.6983 14.4522 21.8203 14.5005C21.9422 14.5488 22.0528 14.6216 22.1455 14.7144C22.2382 14.807 22.3111 14.9177 22.3594 15.0396C22.4077 15.1615 22.4308 15.2923 22.4268 15.4233C22.4226 15.5545 22.3918 15.6835 22.3359 15.8022C22.3086 15.8603 22.2754 15.9151 22.2373 15.9663L22.2471 15.9731L22.1104 16.1089C21.4162 16.8031 20.7139 17.5127 20.0352 18.1987L17.96 20.2866C17.7799 20.4665 17.5358 20.5679 17.2812 20.5679C17.0586 20.5678 16.8437 20.4909 16.6729 20.3511L16.6025 20.2866C16.29 19.9741 15.972 19.6154 15.6387 19.2378V19.2388C15.2837 18.839 14.9198 18.431 14.542 18.0513L14.5381 18.0474V18.0464C14.3689 17.8644 14.2769 17.624 14.2812 17.3755C14.2857 17.1267 14.3865 16.8894 14.5625 16.7134C14.7385 16.5375 14.9758 16.4365 15.2246 16.4321C15.4422 16.4283 15.6538 16.4983 15.8252 16.6294L15.8965 16.6899L17.123 17.9165L17.1729 17.9575C17.1906 17.9694 17.2097 17.9796 17.2295 17.9878C17.2694 18.0043 17.3123 18.0122 17.3555 18.0122C17.3986 18.0122 17.4416 18.0043 17.4814 17.9878C17.5212 17.9713 17.5574 17.947 17.5879 17.9165L20.7529 14.7515C20.8385 14.6563 20.9417 14.5785 21.0576 14.5239C21.1763 14.4681 21.3054 14.4372 21.4365 14.4331Z"
                              fill="#277E89"
                              stroke="#287E89"
                              strokeWidth="0.3"
                            />
                          </svg>
                        ),
                        title: "100% אחריות",
                        subtitle: "אנחנו משווקים רק כרטיסים רשמיים!",
                      },
                      {
                        svg: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="36"
                            height="36"
                            viewBox="0 0 36 36"
                            fill="none"
                          >
                            <path
                              d="M31.8005 34.829V31.2806C31.7983 30.2139 31.3846 29.1893 30.6455 28.4201C29.9064 27.651 28.8989 27.1968 27.8332 27.1522C28.439 26.4702 28.8347 25.6277 28.9728 24.726C29.111 23.8243 28.9856 22.9019 28.6117 22.0699C28.2379 21.2378 27.6315 20.5315 26.8657 20.036C26.0998 19.5405 25.207 19.2769 24.2949 19.2769C23.3827 19.2769 22.4899 19.5405 21.724 20.036C20.9582 20.5315 20.3518 21.2378 19.978 22.0699C19.6042 22.9019 19.4787 23.8243 19.6169 24.726C19.755 25.6277 20.1507 26.4702 20.7565 27.1522C19.6845 27.1972 18.6725 27.6598 17.9371 28.4411C17.2166 27.7195 16.2691 27.2685 15.2547 27.1643C15.8641 26.4835 16.2634 25.6408 16.4043 24.738C16.5453 23.8352 16.4219 22.9109 16.049 22.0767C15.6761 21.2425 15.0697 20.5341 14.303 20.037C13.5363 19.5399 12.6421 19.2754 11.7284 19.2754C10.8147 19.2754 9.92048 19.5399 9.15379 20.037C8.3871 20.5341 7.78071 21.2425 7.40784 22.0767C7.03496 22.9109 6.91155 23.8352 7.0525 24.738C7.19345 25.6408 7.59274 26.4835 8.20215 27.1643C7.11039 27.275 6.09857 27.787 5.36266 28.601C4.62675 29.4151 4.21913 30.4732 4.21875 31.5706V34.829C4.21875 35.0427 4.30362 35.2476 4.45469 35.3986C4.60576 35.5497 4.81065 35.6346 5.02429 35.6346H30.9949C31.2086 35.6346 31.4135 35.5497 31.5646 35.3986C31.7156 35.2476 31.8005 35.0427 31.8005 34.829ZM24.2928 20.9052C24.9102 20.9052 25.5137 21.0883 26.027 21.4313C26.5404 21.7743 26.9405 22.2618 27.1767 22.8322C27.413 23.4026 27.4748 24.0302 27.3543 24.6357C27.2339 25.2412 26.9366 25.7974 26.5001 26.2339C26.0635 26.6705 25.5073 26.9678 24.9018 27.0882C24.2963 27.2087 23.6687 27.1468 23.0983 26.9106C22.5279 26.6743 22.0404 26.2742 21.6974 25.7609C21.3544 25.2476 21.1714 24.6441 21.1714 24.0267C21.1714 23.1989 21.5002 22.4049 22.0856 21.8195C22.671 21.2341 23.465 20.9052 24.2928 20.9052ZM11.7103 20.9052C12.3278 20.9044 12.9317 21.0868 13.4456 21.4294C13.9594 21.7719 14.3601 22.2591 14.597 22.8294C14.8339 23.3997 14.8963 24.0274 14.7763 24.6332C14.6563 25.239 14.3593 25.7956 13.923 26.2325C13.4866 26.6695 12.9304 26.9671 12.3248 27.0879C11.7191 27.2087 11.0913 27.1471 10.5207 26.911C9.9501 26.6748 9.46235 26.2747 9.11918 25.7613C8.77601 25.2479 8.59284 24.6443 8.59284 24.0267C8.5939 23.1999 8.92256 22.4071 9.50685 21.8221C10.0911 21.2371 10.8834 20.9074 11.7103 20.9052ZM17.5988 34.0235H5.81372V31.5746C5.81372 30.8269 6.11076 30.1098 6.6395 29.581C7.16824 29.0523 7.88537 28.7552 8.63312 28.7552H14.7794C15.5271 28.7552 16.2443 29.0523 16.773 29.581C17.3018 30.1098 17.5988 30.8269 17.5988 31.5746V34.0235ZM30.1975 34.0235H19.2099V31.5746C19.2096 30.975 19.0877 30.3817 18.8514 29.8306C19.0836 29.499 19.3922 29.2282 19.7511 29.041C20.11 28.8538 20.5088 28.7558 20.9136 28.7552H27.6681C28.3375 28.7563 28.9792 29.0227 29.4526 29.4961C29.926 29.9695 30.1924 30.6112 30.1934 31.2806L30.1975 34.0235Z"
                              fill="#287E89"
                            />
                            <path
                              d="M17.5833 1.64705C17.7144 1.24375 18.285 1.24375 18.416 1.64705L19.2773 4.29798C19.3359 4.47835 19.504 4.60046 19.6937 4.60046H22.481C22.9051 4.60046 23.0814 5.14311 22.7383 5.39237L20.4833 7.03073C20.3299 7.1422 20.2657 7.33979 20.3243 7.52015L21.1856 10.1711C21.3167 10.5744 20.8551 10.9098 20.512 10.6605L18.257 9.02214C18.1035 8.91067 17.8958 8.91067 17.7424 9.02214L15.4873 10.6605C15.1443 10.9098 14.6827 10.5744 14.8137 10.1711L15.675 7.52015C15.7337 7.33979 15.6695 7.1422 15.516 7.03073L13.261 5.39237C12.9179 5.14311 13.0943 4.60046 13.5183 4.60046H16.3057C16.4953 4.60046 16.6634 4.47835 16.722 4.29798L17.5833 1.64705Z"
                              fill="#277E89"
                            />
                            <path
                              d="M27.9544 6.36141C28.0855 5.9581 28.656 5.9581 28.7871 6.36141L29.6484 9.01234C29.707 9.1927 29.8751 9.31482 30.0648 9.31482H32.8521C33.2762 9.31482 33.4525 9.85747 33.1094 10.1067L30.8544 11.7451C30.701 11.8566 30.6368 12.0541 30.6954 12.2345L31.5567 14.8854C31.6878 15.2887 31.2262 15.6241 30.8831 15.3749L28.6281 13.7365C28.4746 13.625 28.2669 13.625 28.1135 13.7365L25.8584 15.3749C25.5154 15.6241 25.0538 15.2887 25.1848 14.8854L26.0461 12.2345C26.1047 12.0541 26.0405 11.8566 25.8871 11.7451L23.6321 10.1067C23.289 9.85746 23.4653 9.31482 23.8894 9.31482H26.6768C26.8664 9.31482 27.0345 9.1927 27.0931 9.01234L27.9544 6.36141Z"
                              fill="#277E89"
                            />
                            <path
                              d="M7.21224 6.36141C7.34328 5.9581 7.91386 5.9581 8.0449 6.36141L8.90624 9.01234C8.96484 9.1927 9.13292 9.31482 9.32257 9.31482H12.1099C12.534 9.31482 12.7103 9.85747 12.3672 10.1067L10.1122 11.7451C9.95878 11.8566 9.89458 12.0541 9.95319 12.2345L10.8145 14.8854C10.9456 15.2887 10.484 15.6241 10.1409 15.3749L7.88588 13.7365C7.73245 13.625 7.52469 13.625 7.37127 13.7365L5.11625 15.3749C4.77318 15.6241 4.31157 15.2887 4.44262 14.8854L5.30396 12.2345C5.36256 12.0541 5.29836 11.8566 5.14493 11.7451L2.88992 10.1067C2.54684 9.85746 2.72316 9.31482 3.14723 9.31482H5.93457C6.12422 9.31482 6.2923 9.1927 6.3509 9.01234L7.21224 6.36141Z"
                              fill="#277E89"
                            />
                          </svg>
                        ),
                        title: "צוות מקצועי",
                        subtitle: "שילווה אתכם גם כשאתם בחו”ל",
                      },
                    ];

                    return garuarntees.map((g, i) => (
                      <div
                        key={i}
                        className="flex flex-col justify-center items-center text-center w-1/3"
                      >
                        {g.svg}
                        <span className="font-bold text-[13px]">{g.title}</span>
                        <span className="text-[12px] leading-tight whitespace-pre-wrap">
                          {g.subtitle}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              {/*
              <Card
                className="bg-white shadow-lg overflow-hidden md:hidden"
                dir="rtl"
              >
                {(() => {
                  const items = [
                    {
                      title: "100% אחריות",
                      description:
                        "מגה תיירות היא אחת מקבוצות התיירות המובילות בישראל, עם מעל ל- 30 שנות ניסיון ואלפי לקוחות מרוצים.",
                    },
                    {
                      title: "כרטיסים מובטחים",
                      description:
                        "הכרטיסים הינם מספקים רשמיים בלבד והם 100% בטוחים - אנחנו מתחייבים שתקבלו את מה ששילמתם עליו, בראש שקט",
                    },
                    {
                      title: "שירות אישי ואנושי",
                      description:
                        "הצוות שלנו זמין עבורכם לפני, בזמן ואחרי החופשה בטל. 054-200-2722 (גם בווטסאפ!)",
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
              </Card> */}
              <div
                className="hidden md:flex flex-col mr-2 mt-4 mb-2 text-right"
                dir="rtl"
              >
                <div className="flex items-center justify-center space-x-2">
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
                          התנאים ומדיניות הביטולים
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
                className="w-full bg-[#05203c] font-bold hover:bg-[#05203c]/90 text-[18px] h-[52px] hidden md:block"
                disabled={isSubmitting}
                aria-label="המשך לתשלום מאובטח בכרטיס אשראי"
              >
                המשך לתשלום מאובטח
              </Button>

              <div className="hidden md:flex gap-2 mt-0">
                <Button
                  onClick={handleSubmit}
                  variant={"link"}
                  className="flex-[3] min-w-0 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                  aria-label="צור קשר עם נציג"
                >
                  ?רוצים לפצל תשלום
                  <br />
                  דברו עם נציג
                </Button>
                <Button
                  onClick={(e) => handleSubmit(e, false, true)}
                  variant={"link"}
                  className="flex-[3] min-w-0 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                  aria-label="הבטיחו את המחיר ל-24 שעות"
                >
                  ?צריכים עוד זמן
                  <br />
                  הבטיחו מחיר ל-24 שעות
                </Button>
              </div>
            </div>
            <div className="space-y-6 order-2 md:order-2">
              <Card className="bg-white shadow-lg overflow-hidden" ref={passengerDetailsRef}>
                <div className="px-8 pt-6 pb-8">
                  <h2
                    className="text-2xl font-bold mb-4 text-right"
                    id="passenger-details-heading"
                  >
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
                            <h3
                              className="font-medium text-[15px]"
                              id={`passenger-${index}-heading`}
                            >
                              נוסע {index + 1}
                            </h3>
                          </div>
                          <fieldset
                            className="grid grid-cols-2 gap-4"
                            aria-labelledby={`passenger-${index}-heading`}
                          >
                            <div className="space-y-1">
                              <Label
                                htmlFor={`firstName-${index}`}
                                className="sr-only"
                              >
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
                                aria-label={`שם פרטי באנגלית לנוסע ${
                                  index + 1
                                }`}
                                aria-required={index === 0 ? "true" : "false"}
                                aria-invalid={
                                  touched[index]?.firstName &&
                                  !!validationErrors[index]?.firstName
                                }
                                aria-describedby={
                                  touched[index]?.firstName &&
                                  validationErrors[index]?.firstName
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
                              <Label
                                htmlFor={`lastName-${index}`}
                                className="sr-only"
                              >
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
                                aria-label={`שם משפחה באנגלית לנוסע ${
                                  index + 1
                                }`}
                                aria-required={index === 0 ? "true" : "false"}
                                aria-invalid={
                                  touched[index]?.lastName &&
                                  !!validationErrors[index]?.lastName
                                }
                                aria-describedby={
                                  touched[index]?.lastName &&
                                  validationErrors[index]?.lastName
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
              {/* Trust */}
              {agentCommission <= 0 && (
                <Card
                  className="bg-white shadow-lg overflow-hidden order-4 md:order-3 hidden md:block"
                  dir="rtl"
                >
                  {(() => {
                    const items = [
                      {
                        title: "100% אחריות",
                        description:
                          "מגה תיירות היא אחת מקבוצות התיירות המובילות בישראל, עם מעל ל- 30 שנות ניסיון ואלפי לקוחות מרוצים.",
                      },
                      {
                        title: "כרטיסים מובטחים",
                        description:
                          "הכרטיסים הינם מספקים רשמיים בלבד והם 100% בטוחים - אנחנו מתחייבים שתקבלו את מה ששילמתם עליו, בראש שקט",
                      },
                      {
                        title: "שירות אישי ואנושי",
                        description:
                          "הצוות שלנו זמין עבורכם לפני, בזמן ואחרי החופשה בטל. 054-200-2722 (גם בווטסאפ!)",
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
                <div className="flex items-center space-x-2 justify-center">
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
                          התנאים ומדיניות הביטולים
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
              {/* Payment security logos (mobile moved earlier) - removed here */}
              {/* CTA Button */}
              <Button
                ref={originalButtonRef}
                onClick={(e) => handleSubmit(e, true)}
                className="w-full bg-[#05203c] font-bold hover:bg-[#05203c]/90 text-[18px] h-[52px] block md:hidden"
                disabled={isSubmitting}
                aria-label="המשך לתשלום מאובטח בכרטיס אשראי"
              >
                המשך לתשלום מאובטח
              </Button>

              <div className="flex !mt-2 md:hidden w-full flex-nowrap gap-2">
                <Button
                  onClick={handleSubmit}
                  variant={"link"}
                  className="flex-[3] min-w-0 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md transition-colors"
                  disabled={isSubmitting}
                  aria-label="צור קשר עם נציג"
                >
                  ?רוצים לפצל תשלום
                  <br />
                  דברו עם נציג
                </Button>
                <Button
                  onClick={(e) => handleSubmit(e, false, true)}
                  variant={"link"}
                  className="flex-[3] min-w-0 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md transition-colors"
                  disabled={isSubmitting}
                  aria-label="הבטיחו את המחיר ל-24 שעות"
                >
                  ?צריכים עוד זמן
                  <br />
                  הבטיחו מחיר ל-24 שעות
                </Button>
              </div>
            </div>
          </div>
        </main>
      </LoaderWrapper>
      
      {/* Sticky Footer for Mobile */}
      {showStickyFooter && (
        <div ref={stickyFooterRef} className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 md:hidden">
          {/* Additional Options Dropdown */}
          {showStickyOptions && (
            <div className="mb-4 flex gap-2">
              <Button
                onClick={handleSubmit}
                variant={"link"}
                className="flex-1 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md transition-colors"
                disabled={isSubmitting}
                aria-label="צור קשר עם נציג"
              >
                ?רוצים לפצל תשלום
                <br />
                דברו עם נציג
              </Button>
              <Button
                onClick={(e) => handleSubmit(e, false, true)}
                variant={"link"}
                className="flex-1 px-2 text-[14px] h-[52px] leading-tight whitespace-normal break-words text-center border border-primary text-primary rounded-md transition-colors"
                disabled={isSubmitting}
                aria-label="הבטיחו את המחיר ל-24 שעות"
              >
                ?צריכים עוד זמן
                <br />
                הבטיחו מחיר ל-24 שעות
              </Button>
            </div>
          )}
          
          {/* Main Buttons Row */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowStickyOptions(!showStickyOptions)}
              variant="outline"
              className="w-[20%] h-[52px] text-[12px] leading-tight border-[#05203c] text-[#05203c] hover:bg-[#05203c]/10 whitespace-normal break-words px-1"
              aria-label="אפשרויות נוספות"
            >
              {showStickyOptions ? "סגור" : "אפשרויות נוספות"}
            </Button>
            <Button
              onClick={(e) => handleSubmit(e, true)}
              className="flex-1 bg-[#05203c] font-bold hover:bg-[#05203c]/90 text-[18px] h-[52px]"
              disabled={isSubmitting}
              aria-label="המשך לתשלום מאובטח בכרטיס אשראי"
            >
              המשך לתשלום מאובטח
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
