import { useEffect, useState } from 'react';
import { countPending } from '../services/offlineQueue';

interface PWAState {
  isOnline: boolean;
  showBanner: boolean;
  pendingCount: number;
  setShowBanner: (show: boolean) => void;
}

export function usePWA(): PWAState {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Function to check pending requests - reads from the current sync_queue store (DB v2)
  async function checkPendingRequests() {
    try {
      const count = await countPending();
      setPendingCount(count);
    } catch (error) {
      console.error('Error checking pending requests:', error);
    }
  }

  // Check for pending requests on mount and periodically
  useEffect(() => {
    checkPendingRequests();
    const interval = setInterval(checkPendingRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  return { isOnline, showBanner, pendingCount, setShowBanner };
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Service Worker registered:', registration.scope);

      // Check for updates periodically
      const updateInterval = setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check hourly

      // Listen for controller change (new SW activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          clearInterval(updateInterval);
          window.location.reload();
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}
