"use client";

import type React from "react";

import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OrderContext } from "../app.context";
import { FlightMeta } from "@/components/ui/FlightCard";
import { cn } from "@/lib/utils";
import type { OrderData } from "@/lib/app.types";
import validator from "validator";
import { orderStage } from "../hooks/Affiliate";
import dayjs from "dayjs";
import { formatPrice, getTotalPersons } from "@/lib/price.utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Fields = "firstName" | "lastName" | "phone" | "email";

const shortenAirlineName = (name: string | undefined) => {
  if (!name) {
    return "";
  }

  const words = name.split(/\s+/); // Split by spaces
  let shortName = "";
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // If it's the first word and longer than 6 chars, return it directly
    if (i === 0 && word.length > 6) {
      return word;
    }

    if (charCount + word.length > 6) {
      if (word.length >= 10) {
        return shortName.trim(); // Stop if the word is very long (10+ chars)
      } else {
        return (shortName + " " + word[0] + ".").trim(); // Add first letter of next word + "."
      }
    }

    shortName += (shortName ? " " : "") + word;
    charCount += word.length;
  }

  return shortName.trim();
};

const validate: Record<Fields, (value: string) => string> = {
  firstName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם פרטי הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם פרטי חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם פרטי חייב להיות באנגלית בלבד";
    }
    return "";
  },
  lastName: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "שם משפחה הוא שדה חובה";
    if (trimmedValue.length < 2) return "שם משפחה חייב להכיל 2 תווים ויותר";
    if (!/^[A-Za-z\s]+$/.test(trimmedValue)) {
      return "שם משפחה חייב להיות באנגלית בלבד";
    }
    return "";
  },
  email: (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "אימייל הוא שדה חובה";
    if (!validator.isEmail(trimmedValue)) return "נא להזין כתובת אימייל תקינה";
    return "";
  },
  phone: (value: string) => {
    const cleanPhone = value.replace(/[- ]/g, "");
    if (!cleanPhone) return "טלפון נייד הוא שדה חובה";
    if (!cleanPhone.startsWith("05")) return "מספר נייד חייב להתחיל ב-05";
    if (!validator.isMobilePhone(cleanPhone, "he-IL")) {
      return "נא להזין מספר טלפון תקין";
    }
    return "";
  },
};

/**
 * Check if the price is outside the pack boundries
 * @param totalPrice - Total price for all passengers
 * @param basePrice - Base price per single passenger
 * @param paxs - Number of passengers
 * @returns boolean
 */
const priceOutsidePackBoundries = (
  totalPrice: number,
  basePrice: number,
  paxs: number
) => {
  const price = totalPrice / paxs;
  return Math.abs(price - basePrice) >
    Number(process.env.NEXT_PUBLIC_BOUNDRIES || "4")
    ? true
    : false;
};

const maup = Number(process.env.NEXT_PUBLIC_MARKUP || "150");

export default function OrderReview() {
  const {
    flight: selectedFlight,
    hotel: selectedHotel,
    eventTicket,
    event,
    numberOfEventTickets,
  } = useContext(OrderContext);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affDiscount, setAffDiscount] = useState<number>(0);
  const [affId, setAffId] = useState<string>("");
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

  useEffect(() => {
    let affiliateData;
    try {
      affiliateData = localStorage.getItem("mytData");
    } catch (error) {
      console.error("localStorage access error:", error);
      // add statsig event
    }
    if (affiliateData) {
      const parsedAffiliateData = JSON.parse(affiliateData);
      if (parsedAffiliateData.affiliateId) {
        fetch(
          `/api/affiliate/checkCode?affiliateId=${parsedAffiliateData.affiliateId}`
        )
          .then((res) => res.json())
          .then((data) => {
            if (data?.commission) {
              setAffDiscount(data.commission);
              setAffId(parsedAffiliateData.affiliateId);
            }
          })
          .catch(console.error);
      }
    }
  }, []);

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

  const airlineName = useMemo(
    () => shortenAirlineName(selectedFlight?.metadata.name),
    [selectedFlight?.metadata.name]
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

  const submitOrder = async (orderData: OrderData) => {
    const response = await fetch("/api/confirm-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error("Failed to submit order");
    }
    return await response.json();
  };

  /* Calculate total guests */
  const totalGuests = getTotalPersons(selectedHotel.guests);

  /* Fetch lowest avaiable ticket price */
  const minTicketPrice = Math.min(
    ...event.tickets_and_rates.map((ticket) => ticket.price)
  );

  /* Fetch Pack recommended price */
  const packRecommendedPrice = Math.ceil(
    event.base_flight_price + event.base_hotel_price + minTicketPrice + maup
  );

  /* Main variables to calculate price additions */
  const eventTicketPriceAddition = eventTicket.price - minTicketPrice;

  const flightPriceAddition = priceOutsidePackBoundries(
    selectedFlight.price,
    event.base_flight_price,
    selectedFlight.numOfTravelers
  )
    ? selectedFlight.price / selectedFlight.numOfTravelers -
      event.base_flight_price
    : 0;

  const hotelPriceAddition = priceOutsidePackBoundries(
    +selectedHotel.price,
    event.base_hotel_price,
    totalGuests
  )
    ? +selectedHotel.price / totalGuests - event.base_hotel_price
    : 0;

  /* Calculation of final price */
  const totalPrice = Math.ceil(
    (eventTicket.price + maup - affDiscount || 0) * numberOfEventTickets +
      (flightPriceAddition + event.base_flight_price) *
        selectedFlight.numOfTravelers +
      (hotelPriceAddition + event.base_hotel_price) * totalGuests
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTermsCheckboxTouched(true);

    if (!termsAccepted) {
      return;
    }

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
        price_per_ticket: eventTicket.price,
        total_tickets_price: eventTicket.price * numberOfEventTickets,
      },
      flight_order_info: selectedFlight || {},
      hotel_order_info: selectedHotel || {},
      user_shown_price: totalPrice,
      event_id: event?.id || 0,
      aff_partner_tracking_code: affId,
    };

    try {
      const result = await submitOrder(updatedFormData);

      orderStage("CONFIRMED", {
        // TO DO: temp workaround as order stage doesn't work (router.push?)
        data: { confirmed: "checkout" },
      });

      const confirmationUrl = new URL("/confirmation", window.location.origin);
      const params = {
        bookingReference: result.bookingReference,
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location.name,
        ticketType: eventTicket.category,
        quantity: numberOfEventTickets.toString(),
        airline: selectedFlight.metadata.name,
        flights: `Outbound: ${selectedFlight.outbound.flightNumber}, Return: ${selectedFlight.inbound.flightNumber}`,
        dates: `Outbound: ${dayjs(selectedFlight.outbound.departureTime).format(
          "DD/MM/YYYY HH:MM"
        )}, Return: ${dayjs(selectedFlight.inbound.departureTime).format(
          "DD/MM/YYYY HH:MM"
        )}`,
        hotel: selectedHotel.name,
      };

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          confirmationUrl.searchParams.append(key, value);
        }
      });

      router.push(confirmationUrl.toString());
    } catch (error) {
      // TO DO: Handle error (e.g., show error message)
      console.error("Order submission failed:", error);
    } finally {
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
  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto lg:px-6 py-4">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column - Booking Summary and CTA */}
          <div className="space-y-4 order-1 md:order-1">
            <Card className="bg-white shadow-lg overflow-hidden">
              <div className="bg-[#277e89] text-white py-4 px-6 ">
                <h2 className="text-2xl font-bold text-right">סיכום הזמנה</h2>
              </div>
              <div className="p-6 space-y-3 text-right">
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{event.name}</h2>
                  <p className="text-lg">
                    {event.location.name +
                      " | " +
                      dayjs(event.date).format("DD/MM/YYYY")}
                  </p>
                  <div className="font-lg" dir="rtl">
                    מחיר ממוצע לאדם: $
                    {packRecommendedPrice.toLocaleString("en-US")}
                  </div>
                </div>
                <div>
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
                        <div>
                          {eventTicketPriceAddition ? (
                            <>
                              ({formatPrice(eventTicketPriceAddition)})/לכרטיס
                            </>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                      <div>
                        {eventTicketPriceAddition
                          ? formatPrice(
                              eventTicketPriceAddition,
                              numberOfEventTickets
                            )
                          : "כלול במחיר"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="">
                  <h3 className="font-bold text-lg">
                    לינה{" "}
                    <span>
                      {"("}
                      {selectedHotel.guests.reduce(
                        (ppl, room) => ppl + room.children.length + room.adults,
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
                          {hotelPriceAddition ? (
                            <>({formatPrice(hotelPriceAddition)})/לאורח</>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      {hotelPriceAddition
                        ? formatPrice(hotelPriceAddition, totalGuests)
                        : "כלול במחיר"}
                    </div>
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
                      <div className="text-[16px] flex items-center" dir="rtl">
                        <div className="font-bold ml-1" dir="ltr">
                          {airlineName}
                        </div>
                        <div>
                          {formatPrice(flightPriceAddition) ? (
                            <>({formatPrice(flightPriceAddition)})/לנוסע</>
                          ) : (
                            ""
                          )}
                        </div>
                      </div>
                      <div className="flex text-[16px]" dir="rtl">
                        <div>מ-</div>
                        <div>
                          {dayjs(selectedFlight.outbound.departureTime).format(
                            "DD/MM/YYYY"
                          )}
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
                    <div>
                      {formatPrice(flightPriceAddition)
                        ? formatPrice(
                            flightPriceAddition,
                            selectedFlight.numOfTravelers
                          )
                        : "כלול במחיר"}
                    </div>
                  </div>
                  <div className="h-1"></div>
                  <div className="text-[12px] mt-2 px-2" dir="rtl">
                    <FlightMeta {...selectedFlight.outbound} />
                    <FlightMeta {...selectedFlight.inbound} />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  {affDiscount > 0 && (
                    <div>
                      <div className="flex justify-between items-center w-full text-[18px]">
                        <span className="line-through">
                          $
                          {(
                            totalPrice +
                            affDiscount * numberOfEventTickets
                          ).toLocaleString("en-US")}
                        </span>
                        <span>מחיר</span>
                      </div>
                      <div className="flex font-bold justify-between items-center w-full text-[18px] text-green-600">
                        <span>${affDiscount * numberOfEventTickets}</span>
                        <span>הנחה</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[22px] font-bold">
                    <span>${totalPrice.toLocaleString("en-US")}</span>
                    {affDiscount > 0 ? (
                      <span>סה&quot;כ לאחר הנחה</span>
                    ) : (
                      <span>סה&quot;כ</span>
                    )}
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
                      <button className="text-sm mr-1 text-blue-600 hover:underline">
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
                        <h3 className="font-bold mt-4 mb-2">כרטיסים לאירוע</h3>
                        <p>כרטיסי האירוע בדמי ביטול מלאים מרגע ביצוע ההזמנה.</p>

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
                          עלות הטיפול בביטול הטיסה הינה $50 לכל כרטיס טיסה בנוסף
                          לדמי הביטול של המוביל האווירי.
                        </p>

                        <h3 className="font-bold mt-4 mb-2">מלון</h3>
                        <p>
                          ביטול או שינוי חינם עד לתאריך ה- 25 במרץ, 2025, לאחר
                          מכן דמי ביטול מלאים.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {termsCheckboxTouched && !termsAccepted && <TermsError />}
            </div>

            {/* CTA Button */}
            <Button
              onClick={(e) => {
                setErrors();
                const touched = passengers.map(() => ({
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                }));
                setTouched(touched);

                // Check if form is valid after validation
                if (isFormValid && !isSubmitting) {
                  handleSubmit(e);
                }
              }}
              className="w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] hidden md:block"
              disabled={isSubmitting}
            >
              שלח הזמנה
            </Button>
          </div>
          <div className="space-y-6 order-2 md:order-2">
            <Card className="bg-white shadow-lg overflow-hidden">
              <div className="px-8 pt-6 pb-8">
                <h2 className="text-2xl font-bold mb-4 text-right">
                  פרטי הנוסעים
                </h2>
                <p className="text-right mb-8 text-[16px]">
                  נציגנו ייצורו עימך קשר ביום העסקים הבא להשלמת ההזמנה
                </p>

                <div className="space-y-5" dir="rtl">
                  {passengers.map(
                    (
                      passenger,
                      index // TO DO: לוודא שזה לפי מספר הטסים.
                    ) => (
                      <div key={index} className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-[15px]">
                            נוסע {index + 1}
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Input
                              dir="rtl"
                              name="first-name"
                              autoComplete="given-name"
                              type="text"
                              placeholder="שם פרטי באנגלית"
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
                                <p className="text-sm text-red-500 text-right">
                                  {validationErrors[index].firstName}
                                </p>
                              )}
                          </div>
                          <div className="space-y-1">
                            <Input
                              dir="rtl"
                              placeholder="שם משפחה באנגלית"
                              type="text"
                              name="last-name"
                              autoComplete="family-name"
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
                                <p className="text-sm text-red-500 text-right">
                                  {validationErrors[index].lastName}
                                </p>
                              )}
                          </div>
                        </div>
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
                </div>
              </div>
            </Card>
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
                      <button className="text-sm mr-1 text-blue-600 hover:underline">
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
                        <p>כרטיסי האירוע בדמי ביטול מלאים מרגע ביצוע ההזמנה.</p>

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
                          עלות הטיפול בביטול הטיסה הינה $50 לכל כרטיס טיסה בנוסף
                          לדמי הביטול של המוביל האווירי.
                        </p>

                        <h3 className="font-bold mt-4">מלון</h3>
                        <p>
                          ביטול או שינוי חינם עד לתאריך ה- 25 במרץ, 2025, לאחר
                          מכן דמי ביטול מלאים.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              {termsCheckboxTouched && !termsAccepted && <TermsError />}
            </div>
            {/* CTA Button */}
            <Button
              onClick={(e) => {
                setErrors();
                const touched = passengers.map(() => ({
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                }));
                setTouched(touched);

                // Check if form is valid after validation
                if (isFormValid && !isSubmitting) {
                  handleSubmit(e);
                }
              }}
              className="w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] block md:hidden"
            >
              שלח הזמנה
            </Button>
            {/* Trust Badges 
            <Card className="bg-white shadow-lg overflow-hidden order-4 md:order-3">
              <div className="p-6">
                <h3 className="font-bold mb-4 text-[#05203c]">trusted by:</h3>
                <div className="space-y-3 text-[13px] text-[#444]">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[#277e89] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Exclusive rates for flight and hotel bookings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[#277e89] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>100% Buyers Guarantee protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[#277e89] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>On-time arrival guarantee</span>
                  </div>
                </div>
              </div>
            </Card>*/}
          </div>
        </div>
      </main>
    </div>
  );
}
