/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CalendarDays, MapPin, Plane, Hotel, CreditCard, PlusCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { events } from "@/lib/events-data";
import { Order } from "@/lib/app.types";
import { OrderContext } from "../app.context";

interface OrderReviewProps {
  order: Order;
  onSubmit: () => Promise<{ bookingReference: string }>;
}

export default function OrderReview({ order, onSubmit }: OrderReviewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);

  const { flight: selectedFlight, hotel: selectedHotel } = useContext(OrderContext);
  const router = useRouter();

  const event = events.find((e) => e.id === order.eventId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await onSubmit();
      router.push(`/confirmation?bookingReference=${result.bookingReference}`);
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!event || !selectedFlight || !selectedHotel) {
    return (
      <div className="text-center p-3 bg-red-50 rounded-lg">
        <p className="text-red-600">
          Missing order information. Please complete all selections.
        </p>
      </div>
    );
  }

  const totalPrice =
    (order.ticketType === "vip"
      ? event.tickets[1].price * 2
      : event.tickets[0].price) *
      order.quantity +
    selectedFlight.price +
    selectedHotel.price;

  const [passengers, setPassengers] = useState([{ firstName: '', lastName: '' }])

  const addPassenger = () => {
    setPassengers([...passengers, { firstName: '', lastName: '' }])
  }

  const removePassenger = (index: number) => {
    if (passengers.length > 1) {
      const newPassengers = [...passengers]
      newPassengers.splice(index, 1)
      setPassengers(newPassengers)
    }
  }

  const updatePassenger = (index: number, field: 'firstName' | 'lastName', value: string) => {
    const newPassengers = [...passengers]
    newPassengers[index][field] = value
    setPassengers(newPassengers)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column - Booking Summary and CTA */}
          <div className="space-y-6 order-1 md:order-1">
            <Card className="bg-white shadow-lg overflow-hidden">
              <div 
                className="bg-[#277e89] text-white py-4 px-6 text-right flex justify-between items-center cursor-pointer"
                onClick={() => setIsSummaryOpen(!isSummaryOpen)}
              >
                <button className="text-white">
                  {isSummaryOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
                <h2 className="text-[22px] font-bold">סיכום הזמנה</h2>
              </div>
              {isSummaryOpen && (
                <div className="p-6 space-y-6 text-right">
                  <div className="space-y-2">
                    <h3 className="font-medium text-[15px]">שם האירוע</h3>
                    <p className="text-[#666] text-[15px]">באיירן מינכן - פ.ס.ז׳</p>
                    <p className="text-[#666] text-[15px]">קטגוריה 2</p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-[15px]">שם המלון</h3>
                    <div className="text-[#666] text-[15px]">
                      <p>Classic double..</p>
                      <p>1 חדר / 2 אורחים</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-[15px]">טיסות</h3>
                    <div className="text-[#666] text-[15px]">
                      <p>LY555 07:10 - 17:45</p>
                      <p>תל אביב TLV - לונדון STN</p>
                      <p className="mt-3">LY123 14:05 - 05:55</p>
                      <p>לונדון STN - תל אביב TLV</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center text-[22px] font-bold">
                      <span>$5,555</span>
                      <span>סה״כ</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* CTA Button */}
            <Button className="w-full bg-[#05203c] hover:bg-[#05203c]/90 text-[18px] h-[52px] order-3 md:order-2">
              שלח הזמנה
            </Button>
          </div>

          {/* Right Column - Contact Form and Trust Badges */}
          <div className="space-y-6 order-2 md:order-2">
            {/* Contact Form */}
            <Card className="bg-white shadow-lg overflow-hidden">
              <div className="px-8 pt-6 pb-8">
                <h2 className="text-[22px] font-bold mb-4 text-right">איש קשר</h2>
                <p className="text-right mb-8 text-gray-600 text-[15px]">נצייני יצור איתך קשר ביום העסקים הבא להשלמת ההזמנה</p>

                <div className="space-y-5">
                  {passengers.map((passenger, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-[15px]">נוסע {index + 1}</h3>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePassenger(index)}
                            className="h-8 w-8"
                          >
                            <MinusCircle className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          dir="rtl"
                          placeholder="First name (passport)"
                          className="h-11 text-right"
                          value={passenger.firstName}
                          onChange={(e) => updatePassenger(index, 'firstName', e.target.value)}
                        />
                        <Input
                          dir="rtl"
                          placeholder="Last name (passport)"
                          className="h-11 text-right"
                          value={passenger.lastName}
                          onChange={(e) => updatePassenger(index, 'lastName', e.target.value)}
                        />
                      </div>
                      {index === 0 && (
                        <>
                          <Input dir="rtl" placeholder="טלפון" className="h-11 text-right" />
                          <Input dir="rtl" placeholder="דואר אלקטרוני" className="h-11 text-right" />
                        </>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    onClick={addPassenger}
                    className="w-full h-11 flex items-center justify-center gap-2 mt-4"
                  >
                    <PlusCircle className="h-5 w-5" />
                    הוסף נוסע
                  </Button>
                </div>
              </div>
            </Card>

            {/* Trust Badges */}
            <Card className="bg-white shadow-lg overflow-hidden order-4 md:order-3">
              <div className="p-6">
                <h3 className="font-bold mb-4 text-[#05203c]">trusted by:</h3>
                <div className="space-y-3 text-[13px] text-[#444]">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#277e89] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Exclusive rates for flight and hotel bookings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#277e89] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>100% Buyers Guarantee protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#277e89] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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
  )
}