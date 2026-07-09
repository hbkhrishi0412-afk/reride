import { useEffect, useRef } from 'react';
import type { Vehicle, User } from '../types';
import { logWarn, logDebug } from '../utils/logger';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';

type UpdateVehicleFn = (
  id: number,
  updates: Partial<Vehicle>,
  options?: { skipToast?: boolean },
) => Promise<void>;

/** Track a single listing view when a buyer opens the detail page. */
export function useTrackVehicleView(
  vehicle: Vehicle | undefined,
  options?: {
    currentUser?: User | null;
    updateVehicle?: UpdateVehicleFn;
  },
): void {
  const trackedViewRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    trackedViewRef.current.clear();
  }, [vehicle?.id, vehicle?.videoUrl]);

  useEffect(() => {
    const vehicleId = vehicle?.id;
    const viewToken = vehicle?.viewTrackToken;
    if (!vehicleId || !viewToken) return;

    const sellerEmail = vehicle.sellerEmail?.toLowerCase().trim();
    const viewerEmail = options?.currentUser?.email?.toLowerCase().trim();
    if (sellerEmail && viewerEmail && sellerEmail === viewerEmail) return;

    if (trackedViewRef.current.has(vehicleId)) return;
    trackedViewRef.current.add(vehicleId);

    const trackView = async () => {
      try {
        const { publicApiFetch } = await import('../utils/apiFetch');
        const res = await publicApiFetch('/api/vehicles?action=track-view', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId,
            ...(vehicle.databaseId ? { databaseId: vehicle.databaseId } : {}),
            viewToken,
          }),
        });
        if (!res.ok) return;
        const data = await res.json().catch((error) => {
          logWarn('Failed to parse view count response:', error);
          return {};
        });
        if (!data || typeof data.views !== 'number') return;

        try {
          const stored = sessionStorage.getItem('selectedVehicle');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.id === vehicleId) {
              parsed.views = data.views;
              sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(parsed as Vehicle));
            }
          }
        } catch (error) {
          logDebug('Failed to update selectedVehicle in sessionStorage (non-critical):', error);
        }

        try {
          if (options?.updateVehicle) {
            await options.updateVehicle(vehicleId, { views: data.views }, { skipToast: true });
          }
        } catch (error) {
          logWarn('Failed to update vehicle views:', error);
        }
      } catch {
        trackedViewRef.current.delete(vehicleId);
      }
    };

    void trackView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]);
}
