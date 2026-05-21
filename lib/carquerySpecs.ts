/**
 * Server-side CarQuery API client (avoids browser CORS).
 * Used by /api/vehicle-specs and must not be called directly from the browser.
 */

export interface CarQueryVehicleSpecs {
  engine?: string;
  transmission?: string;
  fuelType?: string;
  fuelEfficiency?: string;
  displacement?: string;
  groundClearance?: string;
  bootSpace?: string;
}

interface CarQueryModel {
  model_id: string;
  model_name: string;
  model_make_id: string;
  model_year: string;
  model_engine_cc?: string;
  model_engine_fuel?: string;
  model_transmission_type?: string;
  model_engine_power_ps?: string;
  model_lkm_mixed?: string;
}

interface CarQueryResponse {
  Models?: CarQueryModel[];
}

const makeNameMap: Record<string, string> = {
  'maruti suzuki': 'suzuki',
  maruti: 'suzuki',
  'tata motors': 'tata',
  'mahindra & mahindra': 'mahindra',
  'm&m': 'mahindra',
  'mercedes benz': 'mercedes-benz',
  mercedes: 'mercedes-benz',
  vw: 'volkswagen',
  chevy: 'chevrolet',
};

const normalizeMakeName = (make: string): string => {
  const lower = make.toLowerCase().trim();
  return makeNameMap[lower] || lower.replace(/\s+/g, '-');
};

const mapFuelType = (apiValue?: string): string => {
  if (!apiValue) return 'Petrol';
  const lower = apiValue.toLowerCase();
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('electric') || lower.includes('ev')) return 'Electric';
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('cng') || lower.includes('gas')) return 'CNG';
  if (lower.includes('petrol') || lower.includes('gasoline')) return 'Petrol';
  return 'Petrol';
};

const mapTransmission = (apiValue?: string): string => {
  if (!apiValue) return 'Manual';
  const lower = apiValue.toLowerCase();
  if (lower.includes('automatic') || lower.includes('auto')) return 'Automatic';
  if (lower.includes('cvt')) return 'CVT';
  if (lower.includes('dct') || lower.includes('dual clutch')) return 'DCT';
  return 'Manual';
};

const formatDisplacement = (cc?: string): string => {
  if (!cc) return '';
  const num = parseInt(cc, 10);
  if (isNaN(num)) return '';
  return `${num} cc`;
};

const formatFuelEfficiency = (lPer100km?: string, fuelType?: string): string => {
  if (fuelType?.toLowerCase().includes('electric')) return '';
  if (!lPer100km) return '';
  const lPer100 = parseFloat(lPer100km);
  if (isNaN(lPer100) || lPer100 <= 0) return '';
  return `${Math.round(100 / lPer100)} KMPL`;
};

const formatEngine = (model: CarQueryModel): string => {
  const parts: string[] = [];
  if (model.model_engine_cc) {
    const cc = parseInt(model.model_engine_cc, 10);
    if (!isNaN(cc)) parts.push(`${(cc / 1000).toFixed(1)}L`);
  }
  if (model.model_engine_fuel) parts.push(mapFuelType(model.model_engine_fuel));
  if (model.model_engine_power_ps) {
    const hp = parseInt(model.model_engine_power_ps, 10);
    if (!isNaN(hp)) parts.push(`${hp} BHP`);
  }
  return parts.join(' ') || '';
};

function parseCarQueryBody(text: string): CarQueryResponse | null {
  let cleaned = text.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('(') || cleaned.startsWith('callback(')) {
    cleaned = cleaned.replace(/^[^{]*/, '').replace(/\);?\s*$/, '');
  }
  try {
    return JSON.parse(cleaned) as CarQueryResponse;
  } catch {
    return null;
  }
}

function specsFromModels(
  models: CarQueryModel[],
  targetModel: string,
): CarQueryVehicleSpecs | null {
  if (!models.length) return null;

  const modelLower = targetModel.toLowerCase();
  let bestMatch =
    models.find((m) => m.model_name.toLowerCase() === modelLower) ||
    models.find(
      (m) =>
        m.model_name.toLowerCase().includes(modelLower) ||
        modelLower.includes(m.model_name.toLowerCase()),
    ) ||
    models[0];

  return {
    engine: formatEngine(bestMatch),
    transmission: mapTransmission(bestMatch.model_transmission_type),
    fuelType: mapFuelType(bestMatch.model_engine_fuel),
    fuelEfficiency: formatFuelEfficiency(
      bestMatch.model_lkm_mixed,
      bestMatch.model_engine_fuel,
    ),
    displacement: formatDisplacement(bestMatch.model_engine_cc),
    groundClearance: '',
    bootSpace: '',
  };
}

/**
 * Fetch and parse vehicle specs from CarQuery (server-side only).
 */
export async function lookupVehicleSpecsFromCarQuery(
  make: string,
  model: string,
  year: number,
): Promise<CarQueryVehicleSpecs | null> {
  if (!make?.trim() || !model?.trim() || !year || year < 1900) {
    return null;
  }

  const normalizedMake = normalizeMakeName(make);
  // CarQuery HTTPS cert is often invalid; HTTP works server-side (browser CORS blocked either way).
  const query = `cmd=getModels&make=${encodeURIComponent(normalizedMake)}&year=${year}&sold_in_us=1&callback=`;
  const candidateUrls = [
    `http://www.carqueryapi.com/api/0.3/?${query}`,
    `https://www.carqueryapi.com/api/0.3/?${query}`,
  ];

  let text: string | null = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json, text/plain, */*' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        text = await response.text();
        if (text && !text.includes('Request not valid')) break;
        text = null;
      }
    } catch {
      /* try next URL */
    }
  }

  if (!text) return null;
  const data = parseCarQueryBody(text);
  if (!data?.Models?.length) return null;

  const specs = specsFromModels(data.Models, model);
  if (!specs?.engine) return null;

  return specs;
}
