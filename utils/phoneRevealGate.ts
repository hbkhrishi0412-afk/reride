const STORAGE_KEY = 'reridePhoneRevealLog';
const MAX_REVEALS_PER_DAY = 8;
const MAX_REVEALS_PER_VEHICLE = 2;

interface RevealLog {
  day: string;
  total: number;
  byVehicle: Record<string, number>;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readLog(): RevealLog {
  if (typeof localStorage === 'undefined') {
    return { day: todayKey(), total: 0, byVehicle: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day: todayKey(), total: 0, byVehicle: {} };
    const parsed = JSON.parse(raw) as RevealLog;
    if (parsed.day !== todayKey()) {
      return { day: todayKey(), total: 0, byVehicle: {} };
    }
    return {
      day: parsed.day,
      total: Number(parsed.total) || 0,
      byVehicle: parsed.byVehicle && typeof parsed.byVehicle === 'object' ? parsed.byVehicle : {},
    };
  } catch {
    return { day: todayKey(), total: 0, byVehicle: {} };
  }
}

function writeLog(log: RevealLog): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* quota / private mode */
  }
}

export interface PhoneRevealGateResult {
  allowed: boolean;
  reason?: 'login_required' | 'daily_limit' | 'vehicle_limit';
  remainingToday: number;
}

export function canRevealSellerPhone(params: {
  isLoggedIn: boolean;
  vehicleKey: string;
}): PhoneRevealGateResult {
  if (!params.isLoggedIn) {
    return { allowed: false, reason: 'login_required', remainingToday: 0 };
  }

  const log = readLog();
  const vehicleCount = log.byVehicle[params.vehicleKey] || 0;

  if (log.total >= MAX_REVEALS_PER_DAY) {
    return { allowed: false, reason: 'daily_limit', remainingToday: 0 };
  }
  if (vehicleCount >= MAX_REVEALS_PER_VEHICLE) {
    return { allowed: false, reason: 'vehicle_limit', remainingToday: MAX_REVEALS_PER_DAY - log.total };
  }

  return {
    allowed: true,
    remainingToday: MAX_REVEALS_PER_DAY - log.total,
  };
}

export function recordPhoneReveal(vehicleKey: string): void {
  const log = readLog();
  log.total += 1;
  log.byVehicle[vehicleKey] = (log.byVehicle[vehicleKey] || 0) + 1;
  writeLog(log);
}

/** Mask all but last 4 digits for display before explicit reveal. */
export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  return `••••• ${digits.slice(-4)}`;
}

export function getPhoneRevealVehicleKey(vehicle: { id: number; databaseId?: string }): string {
  return (vehicle.databaseId?.trim() || String(vehicle.id)).toLowerCase();
}
