import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import { isNative } from '../lib/capacitor';

export function initServiceWorker(): void {
  if (import.meta.env.DEV) return;

  // Service workers don't function in Capacitor WKWebView (iOS) — skip registration
  // All assets are bundled in the IPA; no SW caching needed for native builds
  if (isNative()) {
    return;
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      toast('Update available', {
        duration: Infinity,
        action: { label: 'Reload', onClick: () => updateSW(true) },
      });
    },
    onOfflineReady() {
      toast.success('App ready for offline use');
    },
  });
}
