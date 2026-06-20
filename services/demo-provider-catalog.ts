import {
  CAR_SERVICE_OPTIONS,
  SERVICE_CATEGORY_MAP,
  SERVICE_TEMPLATE_PRESETS,
  type ServiceCategory,
} from '../constants/serviceProviderCatalog.js';
import { CAR_SERVICE_SUB_SERVICES } from '../constants/carServiceSubServices.js';

export type DemoProviderServiceRow = {
  serviceType: string;
  price: number;
  description: string;
  etaMinutes: number;
  active: boolean;
  updatedAt: string;
  includedServices: Array<{ id: string; name: string; price?: number; etaMinutes?: number; active: boolean }>;
};

function buildIncludedServicesForType(serviceType: string) {
  const templates = CAR_SERVICE_SUB_SERVICES[serviceType] || [];
  return templates.map((line) => ({
    id: line.id,
    name: line.name,
    ...(line.suggestedPrice != null && line.suggestedPrice > 0 ? { price: line.suggestedPrice } : {}),
    ...(line.suggestedEtaMinutes != null ? { etaMinutes: line.suggestedEtaMinutes } : {}),
    active: true,
  }));
}

/** Canonical public catalog rows for a demo/test workshop (all 8 customer-facing services). */
export function buildDemoProviderServices(): Record<string, DemoProviderServiceRow> {
  const now = new Date().toISOString();
  const services: Record<string, DemoProviderServiceRow> = {};

  for (const serviceType of CAR_SERVICE_OPTIONS) {
    const preset = SERVICE_TEMPLATE_PRESETS[serviceType];
    services[serviceType] = {
      serviceType,
      price: Number(preset?.price || 999),
      description: preset?.description || serviceType,
      etaMinutes: Number(preset?.etaMinutes || 60),
      active: true,
      updatedAt: now,
      includedServices: buildIncludedServicesForType(serviceType),
    };
  }

  return services;
}

/** High-level categories this demo workshop supports (for legacy category-based matching). */
export function demoProviderServiceCategories(): ServiceCategory[] {
  return (Object.keys(SERVICE_CATEGORY_MAP) as ServiceCategory[]).filter((category) =>
    SERVICE_CATEGORY_MAP[category].some((name) => CAR_SERVICE_OPTIONS.includes(name)),
  );
}
