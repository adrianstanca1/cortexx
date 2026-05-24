/**
 * CortexBuild Ultimate — Push Notifications Hook
 * Subscribes to VAPID push notifications after the user first clocks in (high-intent moment).
 */
import { useEffect } from 'react';
import { getToken } from '@/lib/auth-storage';

export function usePushNotifications(isClockIn: boolean) {
  useEffect(() => {
    if (!isClockIn) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (Notification.permission === 'granted') {
      void subscribe();
      return;
    }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') void subscribe();
      });
    }
  }, [isClockIn]);
}

async function subscribe(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
    const { key } = (await res.json()) as { key: string };

    if (!key) {
      console.warn('[Push] VAPID public key not configured');
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
    });

    // Use getToken() which reads localStorage key 'cortexbuild_token'
    const token = getToken() ?? '';

    await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ subscription: sub }),
    });
  } catch (err) {
    console.warn('[Push] Subscription failed:', err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
