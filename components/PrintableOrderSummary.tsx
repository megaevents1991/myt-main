import React from "react";

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
  airline: string;
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

const PrintableOrderSummary: React.FC<PrintableOrderSummaryProps> = ({
  logoUrl,
  tripDetails,
  flightDetails,
  hotelDetails,
  eventDetails,
}) => {
  return (
    <div className="bg-white p-8 max-w-4xl mx-auto animate-fade-in">
      {/* Logo Section */}
      <div className="mb-8 text-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Travel Agency Logo"
            className="h-16 mx-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="h-16 flex items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-800">
              Travel Booking Summary
            </h2>
          </div>
        )}
      </div>

      {/* Trip Summary Section */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {tripDetails.destination} חופשה ל-
        </h1>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          {eventDetails.eventName} כולל כרטיסים להופעה של
        </h2>
        <p className="text-gray-600 mb-4">
          {flightDetails.outboundDepartureTime} -{" "}
          {flightDetails.inboundDepartureTime}
        </p>

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
              <h3 className="text-sm text-gray-500">Travelers</h3>
              <p className="text-lg font-medium text-gray-900">
                {tripDetails.travelers}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Details Section */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Flight Details
        </h2>

        {/* Outbound Flight */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-800 mb-2">
            Outbound Flight • {flightDetails.airline}
          </h3>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-2xl font-semibold text-gray-900">
                {flightDetails.outboundDepartureTime}
              </p>
              <p className="text-gray-600">
                {flightDetails.outboundDepartureAirport}
              </p>
            </div>
            <div className="flex-1 text-center">
              <div className="relative">
                <div className="h-0.5 bg-gray-300 w-full absolute top-1/2 transform -translate-y-1/2"></div>
                <span className="relative inline-block px-2 bg-white text-xs text-gray-500">
                  Direct Flight
                </span>
              </div>
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xl font-semibold text-gray-900">
                {flightDetails.outboundArrivalTime}
              </p>
              <p className="text-gray-600">
                {flightDetails.outboundArrivalAirport}
              </p>
            </div>
          </div>
        </div>

        {/* Inbound Flight */}
        <div>
          <h3 className="text-md font-medium text-gray-800 mb-2">
            Return Flight • {flightDetails.airline}
          </h3>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-2xl font-semibold text-gray-900">
                {flightDetails.inboundDepartureTime}
              </p>
              <p className="text-gray-600">
                {flightDetails.inboundDepartureAirport}
              </p>
            </div>
            <div className="flex-1 text-center">
              <div className="relative">
                <div className="h-0.5 bg-gray-300 w-full absolute top-1/2 transform -translate-y-1/2"></div>
                <span className="relative inline-block px-2 bg-white text-xs text-gray-500">
                  Direct Flight
                </span>
              </div>
            </div>
            <div className="flex-1 text-right">
              <p className="text-2xl font-semibold text-gray-900">
                {flightDetails.inboundArrivalTime}
              </p>
              <p className="text-gray-600">
                {flightDetails.inboundArrivalAirport}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hotel Details Section */}
      <div className="border-b border-gray-200 pb-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Accommodation
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
              const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return `${diffDays} nights`;
            })()}
          </p>
        </div>
      </div>

      {/* Additional Information */}
      <div className="text-sm text-gray-600">
        <p className="mb-2">
          This booking summary includes all applicable taxes and fees.
        </p>
        <p>
          For questions regarding this booking, please contact your travel
          agent.
        </p>
      </div>

      {/* Print guidance - only visible on screen, not when printed */}
      <div className="mt-8 text-center text-gray-500 text-sm print:hidden">
        <p>
          Use your browser&apos;s print function (Ctrl+P / Cmd+P) to print this
          page
        </p>
      </div>
    </div>
  );
};

export default PrintableOrderSummary;
