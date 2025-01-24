/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OrderContext } from "../app.context";
import { FlightMeta } from "@/components/ui/FlightCard";
import { cn } from "@/lib/utils";
import { OrderData } from "@/lib/app.types";
import validator from 'validator';
import { orderStage } from "../hooks/Affiliate";

export default function OrderReview() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affDiscount, setAffDiscount] = useState<number>(0);
  const [affId, setAffId] = useState<string>('');

  useEffect(() => {
    const affiliateData = localStorage.getItem("mytData");
    if (affiliateData) {
      const parsedAffiliateData = JSON.parse(affiliateData);
      if (parsedAffiliateData.affiliateId) {
        fetch(`/api/affiliate/checkCode?affiliateId=${parsedAffiliateData.affiliateId}`)
          .then(res => res.json())
          .then(data => {
            if (data?.commission) {
              setAffDiscount(data.commission);
              setAffId(parsedAffiliateData.affiliateId);
            }
          })
          .catch(console.error);
      }
    }
  }, []);

  const {
    flight: selectedFlight,
    hotel: selectedHotel,
    eventTicket,
    event,
    numberOfEventTickets,
  } = useContext(OrderContext);
  const router = useRouter();

  const [touched, setTouched] = useState(
    Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({
      firstName: false,
      lastName: false,
      phone: false,
      email: false,
    }))
  );

  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}[]>(
    Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({}))
  );

  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedFlight?.numOfTravelers || 1 }, () => ({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    }))
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

  const validate = {
    firstName: (value: string) => {
      if (!value.trim()) return "שם פרטי הוא שדה חובה";
      if (value.length < 2) return "שם פרטי חייב להכיל 2 תווים ויותר";
      if (!/^[A-Za-z\s]+$/.test(value)) {
        return "שם פרטי חייב להיות באנגלית בלבד";
      }
      return "";
    },
    lastName: (value: string) => {
      if (!value.trim()) return "שם משפחה הוא שדה חובה";
      if (value.length < 2) return "שם משפחה חייב להכיל 2 תווים ויותר";
      if (!/^[A-Za-z\s]+$/.test(value)) {
        return "שם משפחה חייב להיות באנגלית בלבד";
      }
      return "";
    },
    email: (value: string) => {
      if (!value) return "אימייל הוא שדה חובה";
      if (!validator.isEmail(value) || !/^[A-Za-z\s]+$/.test(value)) return "נא להזין כתובת אימייל תקינה";
      return "";
    },
    phone: (value: string) => {
      const cleanPhone = value.replace(/-/g, '');
      if (!value) return "טלפון נייד הוא שדה חובה";
      if (!cleanPhone.startsWith("05") || !validator.isMobilePhone(cleanPhone, 'he-IL')) {
        return "מספר טלפון נייד בלבד בבקשה";
      }
      return "";
    }
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length >= 3) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }
    if (cleaned.length >= 6) {
      formatted = `${formatted.slice(0, 7)}-${formatted.slice(7)}`;
    }
    
    return formatted.slice(0, 12); // Limit length
  };

  const handleBlur = (index: number, field: keyof typeof validate) => {
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
    const response = await fetch('/api/confirm-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error('Failed to submit order');
    }
    return await response.json();
  };
  
  const totalPrice = Math.ceil(
    ( eventTicket.price - affDiscount || 0) * numberOfEventTickets +
      selectedFlight.price + // is it include the price for all passengers?
      +selectedHotel.price // is it include the price for all passengers?
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Collect data from your UI elements
    const updatedFormData = {
      main_contact_first_name: passengers[0].firstName,
      main_contact_last_name: passengers[0].lastName,
      main_contact_phone_number: passengers[0].phone,
      main_contact_email: passengers[0].email,
      more_pax_info: passengers.slice(1).map(passenger => ({
        first_name: passenger.firstName,
        last_name: passenger.lastName
      })),
      event_order_info: {
        event_id: event?.id || 0,
        date: event? new Date(event.date) : new Date(),
        name: event?.name || '',
        location_name: event?.location.name || '',
        number_of_ticket: numberOfEventTickets,
        category: eventTicket.category,
        price_per_ticket: eventTicket.price,
        total_tickets_price: eventTicket.price * numberOfEventTickets
      },
      flight_order_info: selectedFlight || {},
      hotel_order_info: selectedHotel || {},
      user_shown_price: totalPrice,
      event_id: event?.id || 0,
      aff_partner_id: affId,
    };
  
    try {
      const result = await submitOrder(updatedFormData);

      orderStage("CONFIRMED", { // TO DO: temp workaround as order stage doesn't work (router.push?)
        data: { confirmed: "checkout" },
      });      
      
      const confirmationUrl = new URL('/confirmation', window.location.origin);
      const params = {
        bookingReference: result.bookingReference,
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location.name,
        ticketType: eventTicket.category,
        quantity: numberOfEventTickets.toString(),
        flight: `${selectedFlight.outbound} ${selectedFlight.outbound}`,
        hotel: selectedHotel.name,
        checkInDate: selectedHotel,
        checkOutDate: selectedHotel
      };

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          confirmationUrl.searchParams.append(key, value);
        }
      });

      router.push(confirmationUrl.toString());
    } catch (error) {
      // TO DO: Handle error (e.g., show error message)
      console.error('Order submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updatePassenger = useCallback(
    (
      index: number,
      field: "firstName" | "lastName" | "phone" | "email",
      value: string
    ) => {
      // Format phone number if it's the phone field
      const finalValue = field === 'phone' ? formatPhoneNumber(value) : value;
      
      // Update passenger data
      const newPassengers = [...passengers];
      newPassengers[index][field] = finalValue;
      setPassengers(newPassengers);

      // Only validate if field has been touched
      if (touched[index][field]) {
        const error = validate[field](finalValue);
        const newErrors = [...validationErrors];
        
        if (error) {
          newErrors[index] = { ...newErrors[index], [field]: error };
        } else {
          const { [field]: removed, ...rest } = newErrors[index];
          newErrors[index] = rest;
        }
        
        setValidationErrors(newErrors);
      }
    },
    [passengers, validationErrors, touched]
  );

  const isFormValid = passengers.every((passenger, i) => {
    const hasErrors = Object.keys(validationErrors[i]).length > 0;
    const isMainContact = i === 0;
    const hasRequiredFields = passenger.firstName && passenger.lastName;
    const hasContactInfo = !isMainContact || (passenger.phone && passenger.email);
    
    return !hasErrors && hasRequiredFields && hasContactInfo;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column - Booking Summary and CTA */}
          <div className="space-y-6 order-1 md:order-1">
            <Card className="bg-white shadow-lg overflow-hidden">
              <div className="bg-[#277e89] text-white py-4 px-6 ">
                <h2 className="text-[22px] font-bold text-right">
                  סיכום הזמנה
                </h2>
              </div>
              <div className="p-6 space-y-6 text-right">
                <div className="space-y-2">
                  <h3 className="font-medium text-[15px]">שם האירוע</h3>
                  <p className="text-[#666] text-[15px]">{event.name}</p>
                  <p className="text-[#666] text-[15px]">
                    {eventTicket.category}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-[15px]">
                    {selectedHotel.name}
                  </h3>
                  <div className="text-[#666] text-[15px]" dir="rtl">
                    <p>{selectedHotel.rate.room_data_trans.main_name}</p>
                    <p>
                      {`${selectedHotel.guests.reduce(
                        (ppl, room) => ppl + room.children.length + room.adults,
                        0
                      )} אורחים`}
                      {` | `}
                      {`${selectedHotel.guests.length} חדרים`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-[15px]">טיסות</h3>
                  <div dir="rtl" className="text-[#666] text-[15px]">
                    <FlightMeta {...selectedFlight.outbound} />
                    <FlightMeta {...selectedFlight.inbound} />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                {affDiscount > 0 && (
                  <div>
                    <div className="flex justify-between items-center w-full text-[18px] text-green-600">
                      <span>${affDiscount}</span>
                      <span>הנחה</span>
                    </div>
                    <div className="flex justify-between items-center w-full text-[18px]">
                      <span className="line-through">${totalPrice + affDiscount}</span>
                      <span>מחיר לפני הנחה</span>
                    </div>
                  </div>
                  )}
                  <div className="flex justify-between items-center text-[22px] font-bold">
                    <span>${totalPrice}</span>
                    <span>סה"כ לאחר הנחה</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* CTA Button */}
            <Button
              disabled={!isFormValid || isSubmitting}
              onClick={handleSubmit}
              className={cn(
                "w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] hidden md:block",
                !isFormValid && "cursor-not-allowed"
              )}
            >
              שלח הזמנה
            </Button>
          </div>
          <div className="space-y-6 order-2 md:order-2">
            <Card className="bg-white shadow-lg overflow-hidden">
              <div className="px-8 pt-6 pb-8">
                <h2 className="text-[22px] font-bold mb-4 text-right">
                  איש קשר
                </h2>
                <p className="text-right mb-8 text-gray-600 text-[15px]">
                  נציגנו ייצורו עימך קשר ביום העסקים הבא להשלמת ההזמנה
                </p>

                <div className="space-y-5" dir="rtl">
                  {passengers.map((passenger, index) => ( // TO DO: לוודא שזה לפי מספר הטסים.
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
                              touched[index]?.firstName && validationErrors[index]?.firstName && 
                              "border-red-500 focus-visible:ring-red-500"
                            )}
                            value={passenger.firstName}
                            onChange={(e) =>
                              updatePassenger(index, "firstName", e.target.value)
                            }
                            onBlur={() => handleBlur(index, "firstName")}
                          />
                          {touched[index]?.firstName && validationErrors[index]?.firstName && (
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
                              touched[index]?.lastName && validationErrors[index]?.lastName && 
                              "border-red-500 focus-visible:ring-red-500"
                            )}
                            value={passenger.lastName}
                            onChange={(e) => 
                              updatePassenger(index, "lastName", e.target.value)
                            }
                            onBlur={() => handleBlur(index, "lastName")}
                          />
                          {touched[index]?.lastName && validationErrors[index]?.lastName && (
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
                                touched[index]?.email && validationErrors[index]?.email && 
                                "border-red-500 focus-visible:ring-red-500"
                              )}
                              value={passenger.email}
                              onChange={(e) => 
                                updatePassenger(index, "email", e.target.value)
                              }
                              onBlur={() => handleBlur(index, "email")}
                            />
                            {touched[index]?.email && validationErrors[index]?.email && (
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
                                touched[index]?.phone && validationErrors[index]?.phone && 
                                "border-red-500 focus-visible:ring-red-500"
                              )}
                              value={passenger.phone}
                              onChange={(e) => 
                                updatePassenger(index, "phone", e.target.value)
                              }
                              onBlur={() => handleBlur(index, "phone")}
                            />
                            {touched[index]?.phone && validationErrors[index]?.phone && (
                              <p className="text-sm text-red-500 text-right">
                                {validationErrors[index].phone}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            {/* CTA Button */}
            <Button
              disabled={!isFormValid || isSubmitting}
              onClick={handleSubmit}
              className={cn(
                "w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] block md:hidden",
                !isFormValid && "cursor-not-allowed"
              )}
            >
              שלח הזמנה
            </Button>
            {/* Trust Badges */}
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
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}