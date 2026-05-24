import { isNative } from '../capacitor';

export interface CapturedPhoto {
  /** data: URI (base64 JPEG) — consistent between native and web */
  dataUrl: string;
}

/**
 * Capture a photo from camera or select from library.
 * - Native: uses @capacitor/camera (proper iOS camera sheet with permission)
 * - Web: opens a file input for <input type="file" accept="image/*" capture="environment">
 */
export async function capturePhoto(source: 'camera' | 'photos' = 'camera'): Promise<CapturedPhoto> {
  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      quality: 80,
      allowEditing: false,
    });
    if (!photo.dataUrl) throw new Error('No photo data returned');
    return { dataUrl: photo.dataUrl };
  }

  // Web fallback: trigger file input programmatically
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * Request camera permission explicitly (useful to pre-flight before capturePhoto).
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (isNative()) {
    const { Camera } = await import('@capacitor/camera');
    const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    return result.camera === 'granted';
  }
  // Web: permission is handled by browser when getUserMedia is called
  return true;
}
