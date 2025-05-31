/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import "@mantine/core/styles.css";

import {
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";
import { FlightMeta } from "@/components/ui/FlightCard";

interface TripDetails {
  destination: string;
  price: number;
  pricePerPerson: number;
  travelers: number;
}

interface FlightDetails {
  outboundDepartureTime: string;
  outboundDepartureAirport: string;
  outboundArrivalTime: string;
  outboundArrivalAirport: string;
  inboundDepartureTime: string;
  inboundDepartureAirport: string;
  inboundArrivalTime: string;
  inboundArrivalAirport: string;
  airlineName: string;
  inbound: any;
  outbound: any;
}

interface HotelDetails {
  name: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
}

interface EventDetails {
  eventName: string;
  eventDate: string;
  eventLocation: string;
  eventImage: string;
  ticketType: string;
  quantity: number;
}

interface PrintableOrderSummaryProps {
  logoUrl: string;
  tripDetails: TripDetails;
  flightDetails: FlightDetails;
  hotelDetails: HotelDetails;
  eventDetails: EventDetails;
}

const myColor: MantineColorsTuple = [
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
  "#277E89",
];

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: "myColor",
});

const PrintableOrderSummary: React.FC<PrintableOrderSummaryProps> = ({
  logoUrl,
  tripDetails,
  flightDetails,
  hotelDetails,
  eventDetails,
}) => {
  // Format date to show only date part
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("he-IL");
  };

  // Format date and time for flights
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const timeStr = date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateStr = date.toLocaleDateString("he-IL");
    return { time: timeStr, date: dateStr };
  };

  return (
    <MantineProvider theme={theme}>
      <div className="bg-white p-8 max-w-4xl mx-auto animate-fade-in">
        {/* Logo Section */}
        <div className="mb-8 text-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Travel Agency Logo"
              className="h-16 mx-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>

        {/* Trip Summary Section */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-start gap-6 mb-4" dir="rtl">
            {/* Event Image */}
            <div className="flex-shrink-0">
              {eventDetails.eventImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={eventDetails.eventImage}
                  alt={eventDetails.eventName}
                  className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>

            {/* Event Details */}
            <div className="flex-1 text-right">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                הצעת מחיר לחופשה ל{tripDetails.destination}
              </h1>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                כולל כרטיסים להופעה של {eventDetails.eventName}
              </h2>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                מסוג: {eventDetails.ticketType}
              </h3>
              <p className="text-gray-600 mb-4">
                {formatDate(eventDetails.eventDate)}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm text-gray-500">Total Price</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${tripDetails.price.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  ${tripDetails.pricePerPerson.toFixed(2)} per person
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-sm text-gray-500">Passengers</h3>
                <p className="text-lg font-medium text-gray-900">
                  {tripDetails.travelers}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Flight Details Section */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h2
            className="text-right text-xl font-semibold text-gray-900 mb-4"
            dir="rtl"
          >
            פרטי טיסה
          </h2>

          {/* Outbound Flight */}
          <div className="mb-6" dir="rtl">
            <h3 className="text-md font-medium text-right text-gray-800 mb-2">
              טיסת הלוך • {flightDetails.airlineName}
            </h3>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">
                {formatDateTime(flightDetails.outboundDepartureTime).date}
              </p>
              <p className="text-sm text-gray-500">
                {formatDateTime(flightDetails.outboundArrivalTime).date}
              </p>
            </div>
            <FlightMeta {...flightDetails.outbound} />
          </div>

          {/* Inbound Flight */}
          <div dir="rtl">
            <h3 className="text-md font-medium text-gray-800 mb-2">
              טיסת חזור • {flightDetails.airlineName}
            </h3>
            <div className="flex justify-between">
              <p className="text-sm text-gray-500">
                {formatDateTime(flightDetails.inboundDepartureTime).date}
              </p>
              <p className="text-sm text-gray-500">
                {formatDateTime(flightDetails.inboundArrivalTime).date}
              </p>
            </div>
            <FlightMeta {...flightDetails.inbound} />
          </div>
        </div>

        {/* Hotel Details Section */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h2
            className="text-xl text-right font-semibold text-gray-900 mb-4"
            dir="rtl"
          >
            לינה
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {hotelDetails.name}
            </h3>
            <p className="text-gray-600 mb-2">{hotelDetails.roomType}</p>
            <div className="flex justify-between text-sm text-gray-600">
              <p>Check-in: {hotelDetails.checkIn}</p>
              <p>Check-out: {hotelDetails.checkOut}</p>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {(() => {
                const checkIn = new Date(hotelDetails.checkIn);
                const checkOut = new Date(hotelDetails.checkOut);
                const diffTime = Math.abs(
                  checkOut.getTime() - checkIn.getTime()
                );
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return `${diffDays} nights`;
              })()}
            </p>
          </div>
        </div>

        {/* Additional Information
        <div className="text-sm text-gray-600">
          <p className="mb-2">
            This booking summary includes all applicable taxes and fees.
          </p>
          <p>
            For questions regarding this booking, please contact your travel
            agent.
          </p>
        </div> */}

        {/* Print guidance - only visible on screen, not when printed */}
        <div className="mt-8 text-center text-gray-500 text-sm print:hidden">
          <p>
            Use your browser&apos;s print function (Ctrl+P / Cmd+P) to print
            this page
          </p>
        </div>
      </div>
    </MantineProvider>
  );
};

export default PrintableOrderSummary;
