/**
 * Capacitor platform utilities.
 *
 * @capacitor/core is safe to import in web builds — it returns 'web' /
 * isNativePlatform()=false when running outside a native shell.
 */
import { Capacitor } from '@capacitor/core';

/** Returns true when running inside a Capacitor native shell (iOS or Android). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Returns 'ios' | 'android' | 'web' */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/** Returns true when running in iOS Capacitor shell. */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Returns true when running in Android Capacitor shell. */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}
