/**
 * AI photo inspection helpers (auto-generation disabled — no longer scheduled on listing create/update/view).
 */
import type { Vehicle, AIInspectionReport } from '../../types.js';
import { generateAIInspectionForServer } from '../../services/aiInspectionService.js';

type VehicleUpdater = {
  update: (primaryKey: string, updates: Partial<Vehicle>) => Promise<Vehicle>;
};

function vehiclePrimaryKey(vehicle: Vehicle): string {
  return vehicle.databaseId || String(vehicle.id);
}

/** Dedupes concurrent track-view backfills for the same listing. */
const backfillInFlight = new Set<string>();

export function shouldBackfillAIInspectionOnView(vehicle: Vehicle): boolean {
  if (vehicle.status !== 'published') return false;
  const images = vehicle.images?.filter(Boolean) ?? [];
  if (images.length === 0) return false;
  if (vehicle.aiInspectionReport) return false;
  return true;
}

/** Lazy backfill when a buyer views a listing that never received an auto report (seed/import/legacy). */
export function scheduleBackfillAIInspectionOnView(
  vehicle: Vehicle,
  vehicleService: VehicleUpdater,
): void {
  if (!shouldBackfillAIInspectionOnView(vehicle)) return;

  const key = vehiclePrimaryKey(vehicle);
  if (backfillInFlight.has(key)) return;

  backfillInFlight.add(key);
  void runAutoAIInspection(vehicle, vehicleService)
    .catch((error) => {
      console.error(
        `❌ Backfill AI inspection failed for vehicle ${key}:`,
        error instanceof Error ? error.message : error,
      );
    })
    .finally(() => {
      backfillInFlight.delete(key);
    });
}

export function shouldRegenerateAIInspection(
  existing: Vehicle,
  updates: Partial<Vehicle>,
): boolean {
  if (!updates.images || !Array.isArray(updates.images) || updates.images.length === 0) {
    return false;
  }
  const previous = JSON.stringify(existing.images || []);
  const next = JSON.stringify(updates.images);
  return previous !== next;
}

export async function runAutoAIInspection(
  vehicle: Vehicle,
  vehicleService: VehicleUpdater,
  options: { forceRegenerate?: boolean } = {},
): Promise<AIInspectionReport | null> {
  const images = vehicle.images?.filter(Boolean) ?? [];
  if (images.length === 0) {
    return null;
  }

  if (vehicle.aiInspectionReport && !options.forceRegenerate) {
    return vehicle.aiInspectionReport;
  }

  const primaryKey = vehiclePrimaryKey(vehicle);
  console.log(`🔍 Auto-generating AI inspection for vehicle ${primaryKey} (${images.length} photo(s))`);

  const report = await generateAIInspectionForServer({
    vehicleId: vehicle.id,
    imageUrls: images,
    vehicleDetails: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      mileage: vehicle.mileage,
      fuelType: vehicle.fuelType,
      color: vehicle.color,
    },
  });

  await vehicleService.update(primaryKey, { aiInspectionReport: report });
  console.log(`✅ AI inspection saved for vehicle ${primaryKey} — grade ${report.overallGrade} (${report.overallScore}/100)`);
  return report;
}

/** Fire-and-forget wrapper so listing creation is not blocked by AI processing. */
export function scheduleAutoAIInspection(
  vehicle: Vehicle,
  vehicleService: VehicleUpdater,
  options: { forceRegenerate?: boolean } = {},
): void {
  void runAutoAIInspection(vehicle, vehicleService, options).catch((error) => {
    console.error(
      `❌ Auto AI inspection failed for vehicle ${vehiclePrimaryKey(vehicle)}:`,
      error instanceof Error ? error.message : error,
    );
  });
}
