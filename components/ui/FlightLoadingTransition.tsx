"use client";

import { Plane, Hotel, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlightLoadingTransitionProps {
  className?: string;
}

export const FlightLoadingTransition = ({ className }: FlightLoadingTransitionProps) => {
  return (
    <>
      <style>{`
        @keyframes loading-dot {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          40% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
        .loading-dot {
          animation: loading-dot 1.4s ease-in-out infinite;
        }
      `}</style>
      <div 
        className={cn(
          "flex flex-col items-center justify-center min-h-96 w-full space-y-8 p-8",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="טוען טיסות ומלונות"
      >
      {/* Animated Icons */}
      <div className="relative flex items-center justify-center gap-8">
        <div className="animate-bounce [animation-delay:-0.3s] flex items-center justify-center">
          <Plane 
            size={48} 
            className="text-main transform rotate-45" 
            aria-hidden="true"
          />
        </div>
        <div className="animate-bounce [animation-delay:-0.15s] flex items-center justify-center">
          <Search 
            size={36} 
            className="text-main/60" 
            aria-hidden="true"
          />
        </div>
        <div className="animate-bounce flex items-center justify-center">
          <Hotel 
            size={48} 
            className="text-secondary" 
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Loading Message */}
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-xl font-semibold text-gray-700">
        רגע אחד ואנחנו מסדרים הכל בשבילכם
        </h3>
        <p className="text-lg text-gray-600">
        כל הטיסות והמלונות הכי מתאימים — במקום אחד
        </p>
      </div>

      {/* Animated Progress Dots - Sequential Loader */}
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-main loading-dot"></div>
        <div className="w-3 h-3 rounded-full bg-main loading-dot [animation-delay:0.2s]"></div>
        <div className="w-3 h-3 rounded-full bg-main loading-dot [animation-delay:0.4s]"></div>
        <div className="w-3 h-3 rounded-full bg-main loading-dot [animation-delay:0.6s]"></div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-20 h-20 bg-main/10 rounded-full opacity-20 animate-ping [animation-duration:3s]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-secondary/10 rounded-full opacity-20 animate-ping [animation-duration:4s] [animation-delay:1s]"></div>
      </div>
    </div>
    </>
  );
};
