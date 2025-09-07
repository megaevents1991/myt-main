'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CacheValidator({ 
  pageId, 
  checkInterval = 30000 // Check every 30 seconds
}: { 
  pageId: string;
  checkInterval?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/api/check-update?pageId=${pageId}`, {
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        const serverTimestamp = response.headers.get('x-page-timestamp');
        const clientTimestamp = document.getElementById('page-timestamp')?.dataset.timestamp;
        
        if (serverTimestamp && clientTimestamp && serverTimestamp !== clientTimestamp) {
          // Page has been updated, refresh
          router.refresh();
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    const interval = setInterval(checkForUpdates, checkInterval);
    return () => clearInterval(interval);
  }, [pageId, checkInterval, router]);

  return null;
}
