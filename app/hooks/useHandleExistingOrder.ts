import { useContext, useLayoutEffect } from "react";
import { OrderContext } from "../app.context";
import { Flight, OrderHotel } from "@/lib/app.types";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useOrderExpiry } from "./useOrderExpiry";

export const useHandleExistingOrder = () => {
  const {
    setStep,
    setFlight,
    setHotel,
    setNumberOfEventTickets,
    setEventTicket,
    setGlobalLoader,
    setPassengers,
    event: currentEvent,
  } = useContext(OrderContext);

  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const { setOrderExpired } = useOrderExpiry();
  
  // Get event ID from URL params if available
  const eventId = params?.eventId as string;

  const fetchOrder = async (orderId: string) => {
    setGlobalLoader(true);

    try {
      const response = await fetch(`/api/find-order?orderId=${orderId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403) {
          // Check if it's an event ID mismatch or time expiry
          if (errorData.error?.includes("This order does not belong to the specified event")) {
            console.error(errorData.error);
            router.push('/');
            return;
          } else {
            console.error(errorData.error);
            const eventName = errorData.eventName || currentEvent?.name;
            setOrderExpired({
              eventId,
              eventName,
            });
            return;
          }
        } else {
          // Other errors (404, 400, etc.) - redirect to homepage
          console.error("API error:", errorData.error || `HTTP ${response.status}`);
          router.push('/');
          return;
        }
      }

      const data: {
        flight_order_info: Flight;
        hotel_order_info: OrderHotel;
        main_contact_email: string;
        main_contact_first_name: string;
        main_contact_last_name: string;
        main_contact_phone_number: string;
        more_pax_info: [
          {
            first_name: string;
            last_name: string;
          }
        ];
        event_order_info: {
          number_of_ticket: number;
          category: string;
          id: string;
          price_per_ticket: number;
          name: string;
          event_id: number;
        };
      } = await response.json();

      if (!data) {
        console.error("No data found");
        return;
      }

      //Convert from db format to passengers format
      const passengers = [
        {
          firstName: data.main_contact_first_name,
          lastName: data.main_contact_last_name,
          email: data.main_contact_email,
          phone: data.main_contact_phone_number,
        },
        ...data.more_pax_info.map((pax) => ({
          firstName: pax.first_name,
          lastName: pax.last_name,
          email: data.main_contact_email,
          phone: data.main_contact_phone_number,
        })),
      ];

      setPassengers(passengers);
      setFlight(data.flight_order_info);
      setHotel(data.hotel_order_info);
      setNumberOfEventTickets(data.event_order_info.number_of_ticket);
      setEventTicket({
        category: data.event_order_info.category,
        id: data.event_order_info.id,
        price: data.event_order_info.price_per_ticket,
        quantity: data.event_order_info.number_of_ticket,
      });

      setStep(4);
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setGlobalLoader(false);
    }
  };

  useLayoutEffect(() => {
    const orderId = searchParams.get("orderId");
    if (orderId) {
      fetchOrder(orderId);
    }
  }, []); // Just to suppress the warning
};
