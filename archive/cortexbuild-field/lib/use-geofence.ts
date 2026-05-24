/**
 * useGeofence — GPS-based site check-in with geofence verification
 * Integrates with HORUS workforce tracking system
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useOfflineMutation } from '@/lib/use-offline-mutation';
import { startHorusTracking, stopHorusTracking } from '@/lib/background-location-task';
import { MOCK_PROJECTS } from '@/lib/mock-data';
import { getApiBaseUrl } from '@/constants/oauth';

export interface SiteGeofence {
  projectId: string;
  projectName: string;
  siteAddress: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // default 200m
}

export interface CheckInRecord {
  id: string;
  projectId: string;
  projectName: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInLat: number;
  checkInLng: number;
  checkOutLat?: number;
  checkOutLng?: number;
  durationMinutes?: number;
  gpsVerified: boolean;
  distanceFromSite: number; // metres
}

export interface GeofenceStatus {
  isInsideGeofence: boolean;
  distanceFromSite: number; // metres
  accuracy: number;
  lastUpdated: string;
}

const CHECKIN_STORAGE_KEY = '@cortexbuild:checkins';
const ACTIVE_CHECKIN_KEY = '@cortexbuild:active_checkin';

// Haversine formula to compute distance between two GPS points in metres
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeofence(geofence: SiteGeofence | null) {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceStatus | null>(null);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckInRecord | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // Load persisted check-in state on mount
  useEffect(() => {
    loadPersistedState();
    return () => {
      if (watcherRef.current) {
        watcherRef.current.remove();
      }
    };
  }, []);

  // Update geofence status when location or geofence changes
  useEffect(() => {
    if (currentLocation && geofence) {
      const dist = haversineDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        geofence.latitude,
        geofence.longitude
      );
      setGeofenceStatus({
        isInsideGeofence: dist <= geofence.radiusMeters,
        distanceFromSite: Math.round(dist),
        accuracy: Math.round(currentLocation.coords.accuracy ?? 0),
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [currentLocation, geofence]);

  const loadPersistedState = async () => {
    try {
      const [activeRaw, historyRaw] = await Promise.all([
        AsyncStorage.getItem(ACTIVE_CHECKIN_KEY),
        AsyncStorage.getItem(CHECKIN_STORAGE_KEY),
      ]);
      if (activeRaw) setActiveCheckIn(JSON.parse(activeRaw));
      if (historyRaw) setCheckInHistory(JSON.parse(historyRaw));
    } catch { /* ignore */ }
  };

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setPermissionStatus('granted');
      return true;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      return status === 'granted';
    } catch {
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<Location.LocationObject | null> => {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Browser geolocation is unavailable.');
        return null;
      }
      return new Promise<Location.LocationObject | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc: Location.LocationObject = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            };
            setCurrentLocation(loc);
            resolve(loc);
          },
          (geoError) => {
            setError(geoError.message || 'Browser location permission denied.');
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
      });
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(loc);
      return loc;
    } catch (err: any) {
      setError(err?.message ?? 'Could not get location');
      return null;
    }
  }, []);

  const startLocationWatch = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (watcherRef.current) return; // already watching
    try {
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30s
          distanceInterval: 20, // 20m
        },
        (loc) => setCurrentLocation(loc)
      );
    } catch { /* ignore */ }
  }, []);

  const stopLocationWatch = useCallback(() => {
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }
  }, []);

  // tRPC mutations for server-side HORUS sync. Both wrapped with the
  // offline-queue helper because workers commonly check in/out from sites
  // with patchy coverage (basements, steel cages, lift shafts) — without
  // the queue, a check-in on the cellular dead zone would never reach the
  // database and the time on site would be invisible to payroll.
  const createCheckInMutation = useOfflineMutation(
    trpc.checkins.create.useMutation(),
    'checkins.create',
  );
  const checkoutMutation = useOfflineMutation(
    trpc.checkins.checkout.useMutation(),
    'checkins.checkout',
  );

  const checkIn = useCallback(async (projectId: string, projectName: string): Promise<{
    success: boolean;
    message: string;
    checkIn?: CheckInRecord;
  }> => {
    if (activeCheckIn) {
      return { success: false, message: 'Already checked in. Please check out first.' };
    }
    setLoading(true);
    setError(null);
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return { success: false, message: 'Location permission is required for GPS check-in.' };
      }

      const loc = await getCurrentLocation();
      if (!loc) {
        return { success: false, message: 'Could not determine your location. Please try again.' };
      }

      let gpsVerified = false;
      let distanceFromSite = 0;

      if (geofence && geofence.projectId === projectId) {
        distanceFromSite = Math.round(haversineDistance(
          loc.coords.latitude, loc.coords.longitude,
          geofence.latitude, geofence.longitude
        ));
        gpsVerified = distanceFromSite <= geofence.radiusMeters;

        if (!gpsVerified) {
          return {
            success: false,
            message: `You are ${distanceFromSite}m from the site boundary (${geofence.radiusMeters}m radius). Please move closer to the site to check in.`,
          };
        }
      } else {
        gpsVerified = false;
      }

      const record: CheckInRecord = {
        id: `ci_${Date.now()}`,
        projectId,
        projectName,
        checkInTime: new Date().toISOString(),
        checkInLat: loc.coords.latitude,
        checkInLng: loc.coords.longitude,
        gpsVerified,
        distanceFromSite,
      };

      await AsyncStorage.setItem(ACTIVE_CHECKIN_KEY, JSON.stringify(record));
      setActiveCheckIn(record);
      await startLocationWatch();

      // Start background location tracking for HORUS (works when app is backgrounded)
      // distanceFilterM: only send a ping when the worker has moved ≥ 10 m from the
      // last recorded position — significantly reduces battery drain for stationary workers.
      // This threshold can be updated at runtime via setHorusTrackingConfig().
      // Resolve per-project GPS distance filter (set by admin), fallback to 10 m
      const projectData = MOCK_PROJECTS.find(p => p.id === record.projectId);
      const resolvedDistanceFilter = projectData?.gpsDistanceFilterM ?? 10;
      startHorusTracking(
        {
          id: record.id,
          projectId: record.projectId,
          userId: 'current_user',
          serverUrl: getApiBaseUrl() || undefined,
        },
        { distanceFilterM: resolvedDistanceFilter },
      ).catch(() => {}); // Non-blocking — foreground watch is the fallback

      // Sync to HORUS backend (fire-and-forget, don't block UI). The
      // offline-queue wrapper ensures the check-in is preserved if the
      // worker is in a dead zone — it lands in AsyncStorage and replays
      // when connectivity returns, so payroll always sees the punch.
      const numericProjectId = parseInt(projectId, 10);
      if (!isNaN(numericProjectId)) {
        createCheckInMutation.mutateAsync({
          workerName: 'Current User',
          projectId: numericProjectId,
          checkInLat: loc.coords.latitude,
          checkInLng: loc.coords.longitude,
          gpsVerified,
          distanceFromSite,
        }).catch(() => {/* swallow — queue + retry handles transient errors */});
      }

      return { success: true, message: gpsVerified ? `GPS verified — ${distanceFromSite}m from site centre` : 'Checked in (GPS unverified)', checkIn: record };
    } catch (err: any) {
      const msg = err?.message ?? 'Check-in failed';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [activeCheckIn, geofence, requestPermissions, getCurrentLocation, startLocationWatch, createCheckInMutation]);

  const checkOut = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    record?: CheckInRecord;
  }> => {
    if (!activeCheckIn) {
      return { success: false, message: 'Not currently checked in.' };
    }
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      const checkOutTime = new Date().toISOString();
      const durationMs = new Date(checkOutTime).getTime() - new Date(activeCheckIn.checkInTime).getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const completed: CheckInRecord = {
        ...activeCheckIn,
        checkOutTime,
        checkOutLat: loc?.coords.latitude,
        checkOutLng: loc?.coords.longitude,
        durationMinutes,
      };

      const updated = [completed, ...checkInHistory].slice(0, 50);
      await Promise.all([
        AsyncStorage.removeItem(ACTIVE_CHECKIN_KEY),
        AsyncStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(updated)),
      ]);

      setActiveCheckIn(null);
      setCheckInHistory(updated);
      stopLocationWatch();

      // Stop background location tracking
      stopHorusTracking().catch(() => {});

      // Sync checkout to HORUS backend (fire-and-forget; offline-queue
      // wrapper preserves the punch even if the worker is out of coverage).
      const numericProjectId = parseInt(activeCheckIn.projectId, 10);
      if (!isNaN(numericProjectId)) {
        checkoutMutation.mutateAsync({
          projectId: numericProjectId,
          workerName: 'Current User',
          checkOutLat: loc?.coords.latitude,
          checkOutLng: loc?.coords.longitude,
          durationMinutes,
        }).catch(() => {/* queue + retry handles transient errors */});
      }

      const hrs = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

      return { success: true, message: `Checked out after ${durationStr}`, record: completed };
    } catch (err: any) {
      const msg = err?.message ?? 'Check-out failed';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [activeCheckIn, checkInHistory, getCurrentLocation, stopLocationWatch, checkoutMutation]);

  return {
    permissionStatus,
    currentLocation,
    geofenceStatus,
    activeCheckIn,
    checkInHistory,
    loading,
    error,
    checkIn,
    checkOut,
    requestPermissions,
    getCurrentLocation,
  };
}
