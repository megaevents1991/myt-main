"use client";

import { Plane, Hotel, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlightLoadingTransitionProps {
  className?: string;
  title?: string;
  subtitle?: string;
  showHotelOnly?: boolean;
}

export const FlightLoadingTransition = ({ className, title, subtitle, showHotelOnly = false }: FlightLoadingTransitionProps) => {
  return (
  <div 
      className={cn(
        "flex flex-col items-center justify-center min-h-96 w-full space-y-2 p-8 relative transform -translate-y-16 sm:-translate-y-6 lg:-translate-y-6",
        className
      )}
      role="status"
      aria-live="polite"
      aria-describedby="flight-loading-message"
      aria-label="טוען טיסות ומלונות"
    >
      {/* Animated Icons */}
      <div className="flex items-center justify-center gap-4">
        {!showHotelOnly && (
          <>
            <div className="animate-bounce motion-reduce:animate-none [animation-delay:-0.3s] flex items-center justify-center w-16 h-16">
              <Plane 
                size={48} 
                className="text-main transform rotate-45" 
                aria-hidden="true"
              />
            </div>
            <div className="animate-bounce motion-reduce:animate-none [animation-delay:-0.15s] flex items-center justify-center w-16 h-16">
              <Search 
                size={36} 
                className="text-main/70" 
                aria-hidden="true"
              />
            </div>
          </>
        )}
        <div className="animate-bounce motion-reduce:animate-none flex items-center justify-center w-16 h-16">
          <Hotel 
            size={48} 
            className="text-success"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Loading Message */}
      <div id="flight-loading-message" className="text-center space-y-1 max-w-md">
        <h3 className="text-base sm:text-xl font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis">
          {title ?? "רגע אחד, אנחנו מארגנים עבורכם מה שצריך"}
        </h3>
        <p className="text-sm sm:text-lg text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">
          {subtitle ?? "כל הטיסות והמלונות הכי משתלמים - במקום אחד"}
        </p>
      </div>

      {/* Animated Progress Dots - Sequential Loader */}
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-main animate-pulse motion-reduce:animate-none"></div>
        <div className="w-3 h-3 rounded-full bg-main animate-pulse motion-reduce:animate-none [animation-delay:0.2s]"></div>
        <div className="w-3 h-3 rounded-full bg-main animate-pulse motion-reduce:animate-none [animation-delay:0.4s]"></div>
        <div className="w-3 h-3 rounded-full bg-main animate-pulse motion-reduce:animate-none [animation-delay:0.6s]"></div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-main/10 rounded-full animate-ping motion-reduce:hidden [animation-duration:3s]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-secondary/10 rounded-full animate-ping motion-reduce:hidden [animation-duration:4s] [animation-delay:1s]"></div>
      </div>
    </div>
  );
};
