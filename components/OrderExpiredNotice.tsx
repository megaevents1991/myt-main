"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Clock, ArrowRight } from "lucide-react";

interface OrderExpiredNoticeProps {
  eventId?: string;
  eventName?: string;
  onRedirect?: () => void;
}

export default function OrderExpiredNotice({ 
  eventId, 
  eventName,
  onRedirect 
}: OrderExpiredNoticeProps) {
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const redirectPath = eventId ? `/order/${eventId}` : '/';
          if (onRedirect) {
            onRedirect();
          }
          router.push(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, eventId, onRedirect]);

  const handleRedirectNow = () => {
    const redirectPath = eventId ? `/order/${eventId}` : '/';
    if (onRedirect) {
      onRedirect();
    }
    router.push(redirectPath);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-gradient-to-br from-orange-50 to-red-50">
      <div className="max-w-md w-full text-center">
        <div className="rounded-full bg-orange-100 p-4 mb-6 mx-auto w-20 h-20 flex items-center justify-center">
          <Clock className="h-10 w-10 text-orange-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4" dir="rtl">
          פג תוקף ההזמנה
        </h1>
        
        <div className="bg-white rounded-lg p-6 shadow-lg mb-6" dir="rtl">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="h-5 w-5 text-orange-500 ml-2" />
            <span className="text-sm text-gray-600">
              לצערנו עברו יותר מ-24 שעות
            </span>
          </div>
          
          <p className="text-gray-700 mb-4">
            אבל אל דאגה, כבר תוכל לבדוק מחיר עדכני לחבילה{eventName ? ` ל-${eventName}` : ''}.
          </p>
          
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">
              מועבר אוטומטית תוך {countdown} שניות...
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRedirectNow}
          className="bg-main text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition-colors flex items-center mx-auto gap-2"
        >
          התחל הזמנה חדשה
          <ArrowRight className="h-4 w-4" />
        </button>
        
        <p className="text-xs text-gray-400 mt-4">
          MegaEvents - חוויות בלתי נשכחות
        </p>
      </div>
    </div>
  );
}
