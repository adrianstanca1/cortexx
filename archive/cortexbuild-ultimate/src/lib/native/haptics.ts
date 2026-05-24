import { isNative } from '../capacitor';

/**
 * Trigger impact haptic feedback.
 * - Native: @capacitor/haptics ImpactLight/Medium/Heavy
 * - Web: navigator.vibrate() fallback
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (isNative()) {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const styleMap: Record<string, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: styleMap[style] });
    return;
  }
  // Web fallback
  const durations: Record<string, number> = { light: 10, medium: 25, heavy: 50 };
  navigator.vibrate?.(durations[style]);
}

/**
 * Trigger notification haptic feedback (success, warning, error).
 */
export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  if (isNative()) {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    const typeMap: Record<string, typeof NotificationType[keyof typeof NotificationType]> = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    await Haptics.notification({ type: typeMap[type] });
    return;
  }
  const patterns: Record<string, number[]> = {
    success: [10],
    warning: [10, 50, 10],
    error: [50, 50, 50],
  };
  navigator.vibrate?.(patterns[type]);
}
