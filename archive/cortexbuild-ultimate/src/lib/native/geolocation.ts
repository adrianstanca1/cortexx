import { isNative } from '../capacitor';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Get current position.
 * Uses @capacitor/geolocation on native (no permission dialog needed on iOS —
 * Info.plist strings handle that); falls back to browser Geolocation API on web.
 */
export async function getCurrentPosition(): Promise<GeoPosition> {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

/**
 * Request geolocation permission (iOS shows system dialog automatically when
 * getCurrentPosition is called; this helper is for explicit pre-request flows).
 */
export async function requestGeolocationPermission(): Promise<boolean> {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const result = await Geolocation.requestPermissions();
    return result.location === 'granted';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
    );
  });
}
