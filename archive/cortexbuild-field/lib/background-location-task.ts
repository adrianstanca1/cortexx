/**
 * Background Location Task — HORUS Continuous Tracking
 *
 * IMPORTANT: TaskManager.defineTask MUST be called at module level (global scope),
 * not inside any React component or lifecycle method. This file is imported at
 * the top of app/_layout.tsx to ensure the task is defined before any component mounts.
 *
 * Battery Optimisation:
 * - Distance filter: only fires when the worker has moved ≥ distanceInterval metres.
 * - Stationary suppression: if the worker hasn't moved > STATIONARY_THRESHOLD metres
 *   from the last recorded position, the ping is silently dropped.
 * - Configurable via AsyncStorage key HORUS_TRACKING_CONFIG so the server or
 *   company settings can push a different threshold without an app update.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const HORUS_LOCATION_TASK = 'horus-background-location';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default distance (metres) the worker must move before a ping is recorded. */
const DEFAULT_DISTANCE_FILTER_M = 10;

/** Default OS-level interval between location callbacks (ms). */
const DEFAULT_TIME_INTERVAL_MS = 60_000;

/** Minimum time between pings even if distance threshold is met (ms). */
const MIN_PING_INTERVAL_MS = 30_000;

const STORAGE_KEYS = {
  ACTIVE_CHECKIN: 'horus_active_checkin',
  LOCATION_BUFFER: 'horus_location_buffer',
  LAST_PING: 'horus_last_ping',
  LAST_PING_COORDS: 'horus_last_ping_coords',
  LAST_PING_TIME: 'horus_last_ping_time',
  TRACKING_CONFIG: 'horus_tracking_config',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng points. */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getDistanceFilter(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_CONFIG);
    if (raw) {
      const cfg = JSON.parse(raw) as { distanceFilterM?: number };
      if (typeof cfg.distanceFilterM === 'number' && cfg.distanceFilterM > 0) {
        return cfg.distanceFilterM;
      }
    }
  } catch { /* use default */ }
  return DEFAULT_DISTANCE_FILTER_M;
}

// ─── Task Definition (must be global scope) ──────────────────────────────────

TaskManager.defineTask(
  HORUS_LOCATION_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error) {
      console.error('[HORUS] Background location task error:', error.message);
      return;
    }

    if (!data?.locations?.length) return;

    try {
      // Check if worker is actively checked in
      const checkInRaw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CHECKIN);
      if (!checkInRaw) return;

      const checkIn = JSON.parse(checkInRaw) as {
        id: string;
        projectId: string;
        userId: string;
        serverUrl?: string;
      };

      const location = data.locations[data.locations.length - 1];
      const { latitude, longitude } = location.coords;

      // ── Battery optimisation: distance filter ──────────────────────────────
      const distanceFilter = await getDistanceFilter();

      const lastCoordsRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PING_COORDS);
      const lastTimeRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PING_TIME);
      const lastCoords = lastCoordsRaw
        ? JSON.parse(lastCoordsRaw) as { lat: number; lng: number }
        : null;

      if (lastCoords) {
        const { lat, lng } = lastCoords;
        const movedMetres = haversineDistance(lat, lng, latitude, longitude);

        if (movedMetres < distanceFilter) {
          // Worker hasn't moved enough — skip this ping to save battery
          return;
        }
      }

      // ── Rate-limit: enforce minimum time between pings ─────────────────────
      if (lastTimeRaw) {
        const elapsed = Date.now() - parseInt(lastTimeRaw, 10);
        if (elapsed < MIN_PING_INTERVAL_MS) return;
      }

      // ── Build ping ─────────────────────────────────────────────────────────
      const ping = {
        checkInId: checkIn.id,
        projectId: checkIn.projectId,
        userId: checkIn.userId,
        latitude,
        longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: new Date(location.timestamp).toISOString(),
        distanceFromLast: lastCoords
          ? haversineDistance(lastCoords.lat, lastCoords.lng, latitude, longitude)
          : null,
      };

      // Update last-ping metadata
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PING_COORDS, JSON.stringify({ lat: latitude, lng: longitude }));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PING_TIME, Date.now().toString());
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_PING, ping.timestamp);

      // Buffer the ping locally
      const bufferRaw = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_BUFFER);
      const buffer: typeof ping[] = bufferRaw ? JSON.parse(bufferRaw) : [];
      buffer.push(ping);
      const trimmed = buffer.slice(-50);
      await AsyncStorage.setItem(STORAGE_KEYS.LOCATION_BUFFER, JSON.stringify(trimmed));

      // Attempt to flush to HORUS backend
      const serverUrl = checkIn.serverUrl || 'http://127.0.0.1:3000';
      try {
        const response = await fetch(`${serverUrl}/api/horus/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pings: trimmed }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          await AsyncStorage.removeItem(STORAGE_KEYS.LOCATION_BUFFER);
        }
      } catch {
        // Network unavailable — pings stay buffered, will flush on next successful ping
      }
    } catch (err) {
      console.error('[HORUS] Failed to process background location:', err);
    }
  },
);

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface HorusCheckInData {
  id: string;
  projectId: string;
  userId: string;
  serverUrl?: string;
}

export interface HorusTrackingConfig {
  /**
   * Minimum distance (metres) the worker must travel from the last recorded
   * position before a new ping is sent. Increase to reduce battery drain on
   * stationary workers; decrease for higher-precision tracking.
   * Default: 10 m. Recommended range: 5–100 m.
   */
  distanceFilterM: number;
}

// ─── Control Functions ────────────────────────────────────────────────────────

/**
 * Persist a tracking configuration. The background task reads this on every
 * callback, so changes take effect immediately without restarting the task.
 */
export async function setHorusTrackingConfig(config: Partial<HorusTrackingConfig>): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_CONFIG);
    const current: HorusTrackingConfig = existing
      ? JSON.parse(existing)
      : { distanceFilterM: DEFAULT_DISTANCE_FILTER_M };
    const merged = { ...current, ...config };
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_CONFIG, JSON.stringify(merged));
  } catch (err) {
    console.error('[HORUS] Failed to save tracking config:', err);
  }
}

/**
 * Read the current tracking configuration.
 */
export async function getHorusTrackingConfig(): Promise<HorusTrackingConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_CONFIG);
    if (raw) return JSON.parse(raw) as HorusTrackingConfig;
  } catch { /* use default */ }
  return { distanceFilterM: DEFAULT_DISTANCE_FILTER_M };
}

/**
 * Start background location tracking for HORUS.
 * Requires both foreground AND background location permissions.
 *
 * @param checkIn   Active check-in data to associate pings with.
 * @param config    Optional tracking config override (distance filter, etc.).
 */
export async function startHorusTracking(
  checkIn: HorusCheckInData,
  config?: Partial<HorusTrackingConfig>,
): Promise<{ success: boolean; error?: string; permissionDenied?: boolean }> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Background location not supported on web' };
  }

  try {
    // Request foreground permission first
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      return { success: false, error: 'Foreground location permission denied', permissionDenied: true };
    }

    // Request background permission
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      return {
        success: false,
        error: 'Background location permission denied. Please enable "Always" location access in Settings.',
        permissionDenied: true,
      };
    }

    // Persist config and check-in data
    if (config) await setHorusTrackingConfig(config);
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHECKIN, JSON.stringify(checkIn));

    // Clear stale last-ping coords so the first ping always fires
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_PING_COORDS);
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_PING_TIME);

    // Check if already running
    const isRegistered = await TaskManager.isTaskRegisteredAsync(HORUS_LOCATION_TASK);
    if (isRegistered) {
      return { success: true };
    }

    const distanceFilter = config?.distanceFilterM ?? DEFAULT_DISTANCE_FILTER_M;

    // Start background location updates
    // distanceInterval acts as the OS-level coarse filter (saves GPS wake-ups).
    // The task applies a finer software filter via haversineDistance.
    await Location.startLocationUpdatesAsync(HORUS_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: DEFAULT_TIME_INTERVAL_MS,
      distanceInterval: Math.max(distanceFilter, 5), // OS-level filter ≥ 5 m
      deferredUpdatesInterval: 30_000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'CortexBuild Field',
        notificationBody: 'Tracking your location on site',
        notificationColor: '#F97316',
      },
      pausesUpdatesAutomatically: false,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

/**
 * Stop background location tracking and flush any buffered pings.
 */
export async function stopHorusTracking(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(HORUS_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(HORUS_LOCATION_TASK);
    }
  } catch (err) {
    console.error('[HORUS] Failed to stop location task:', err);
  } finally {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACTIVE_CHECKIN,
      STORAGE_KEYS.LAST_PING_COORDS,
      STORAGE_KEYS.LAST_PING_TIME,
    ]);
  }
}

/**
 * Get the last known ping timestamp, buffered ping count, and current config.
 */
export async function getHorusTrackingStatus(): Promise<{
  isTracking: boolean;
  lastPing: string | null;
  bufferedPings: number;
  config: HorusTrackingConfig;
}> {
  if (Platform.OS === 'web') {
    return { isTracking: false, lastPing: null, bufferedPings: 0, config: { distanceFilterM: DEFAULT_DISTANCE_FILTER_M } };
  }

  try {
    const [isRegistered, lastPing, bufferRaw, config] = await Promise.all([
      TaskManager.isTaskRegisteredAsync(HORUS_LOCATION_TASK),
      AsyncStorage.getItem(STORAGE_KEYS.LAST_PING),
      AsyncStorage.getItem(STORAGE_KEYS.LOCATION_BUFFER),
      getHorusTrackingConfig(),
    ]);

    const buffer = bufferRaw ? JSON.parse(bufferRaw) : [];
    return { isTracking: isRegistered, lastPing, bufferedPings: buffer.length, config };
  } catch {
    return { isTracking: false, lastPing: null, bufferedPings: 0, config: { distanceFilterM: DEFAULT_DISTANCE_FILTER_M } };
  }
}

/**
 * Flush buffered location pings to the server (call when app comes to foreground).
 */
export async function flushHorusBuffer(serverUrl = 'http://127.0.0.1:3000'): Promise<void> {
  try {
    const bufferRaw = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_BUFFER);
    if (!bufferRaw) return;

    const buffer = JSON.parse(bufferRaw);
    if (!buffer.length) return;

    const response = await fetch(`${serverUrl}/api/horus/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pings: buffer }),
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      await AsyncStorage.removeItem(STORAGE_KEYS.LOCATION_BUFFER);
    }
  } catch {
    // Silently fail — buffer will be retried next time
  }
}
