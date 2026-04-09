import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    const checkIsMobile = () => {
      // Check if window is available (client-side)
      if (typeof window !== 'undefined') {
        // Use multiple detection methods for better accuracy
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isUserAgentMobile = mobileRegex.test(userAgent);
        
        // Also check screen width as a backup
        const isScreenMobile = window.innerWidth <= 768;
        
        setIsMobile(isUserAgentMobile || isScreenMobile);
      }
    };

    checkIsMobile();

    // Listen for resize events to update mobile status
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isScreenMobile = window.innerWidth <= 768;
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isUserAgentMobile = mobileRegex.test(userAgent);
        
        setIsMobile(isUserAgentMobile || isScreenMobile);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Return false during SSR and initial client render to prevent hydration mismatch
  return { isMobile: isMounted ? isMobile : false, isMounted };
}
