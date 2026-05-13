"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Home } from "lucide-react";
import { getClientHomeHref } from "@/lib/homeHref";

interface EventNotFoundNoticeProps {
  eventId?: string;
}

export default function EventNotFoundNotice({ 
}: EventNotFoundNoticeProps) {
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const href = getClientHomeHref();
          if (href.startsWith("http")) window.location.href = href;
          else router.push(href);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleRedirectNow = () => {
    const href = getClientHomeHref();
    if (href.startsWith("http")) window.location.href = href;
    else router.push(href);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-md w-full text-center">
        <div className="rounded-full bg-blue-100 p-4 mb-6 mx-auto w-20 h-20 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-blue-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4" dir="rtl">
          האירוע כבר לגמרי סולד אאאוט!
        </h1>
        
        <div className="bg-white rounded-lg p-6 shadow-lg mb-6" dir="rtl">
          
          <p className="text-gray-700 mb-4">
            בואו תבדקו מה עוד יש לנו להציע לכם במחירים סופר משתלמים
          </p>
          
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">
              כבר תועברו אוטומטית (תוך {countdown} שניות...)
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRedirectNow}
          className="bg-main text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition-colors flex items-center mx-auto gap-2"
        >
          חזרה לעמוד הבית
          <Home className="h-4 w-4" />
        </button>
        
        <p className="text-xs text-gray-400 mt-4">
          MegaEvents - חוויות בלתי נשכחות
        </p>
      </div>
    </div>
  );
}
