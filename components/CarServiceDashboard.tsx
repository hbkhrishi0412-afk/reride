import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getValidAccessToken } from '../services/supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase';
import {
  CAR_SERVICE_OPTIONS,
  DEFAULT_SERVICE_TEMPLATE_NAMES,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_DESCRIPTIONS,
  SERVICE_CATEGORY_MAP,
  SERVICE_TEMPLATE_PRESETS,
  type ServiceCategory,
} from '../constants/serviceProviderCatalog.js';
import {
  getSubServicesFor,
  subServiceIdFromName,
  type SubServiceTemplate,
} from '../constants/carServiceSubServices.js';

interface Provider {
  name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  district?: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
  serviceCategories?: ServiceCategory[];
}

// ---------------------------------------------------------------------------
// Stable presentational helpers for the Profile tab.
//
// IMPORTANT: keep these declared at module scope. Earlier they were defined
// inside the parent component's render callback, which produced a *new*
// component reference on every render. React then treated each render as a
// different component type at the same JSX position and unmounted/remounted
// the underlying <input> on every keystroke, dropping focus and making the
// City / State / District (and other) fields impossible to type into.
// ---------------------------------------------------------------------------
const PROFILE_INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

const PROFILE_USER_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const PROFILE_MAIL_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const PROFILE_PHONE_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
const PROFILE_PIN_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const PROFILE_MAP_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);
const PROFILE_CLOCK_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ServiceCategoriesExplainerBox: React.FC<{ className?: string }> = ({ className = 'mb-4' }) => (
  <div className={`rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left ${className}`}>
    <p className="text-xs font-semibold text-gray-900">What are service categories?</p>
    <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
      These are <span className="text-gray-700">high-level groups</span>. Each group turns on a fixed set of service types
      (bookable in Services &amp; Pricing). This is shown here so you do not have to open &ldquo;Choose
      categories&rdquo; only to read what they mean.
    </p>
    <ul className="space-y-1.5 text-[11px] text-gray-600 border-t border-gray-100 pt-2">
      {SERVICE_CATEGORIES.map((cat) => (
        <li key={cat}>
          <span className="font-medium text-gray-800">{cat}</span>
          <span> — {SERVICE_CATEGORY_DESCRIPTIONS[cat]}</span>
          <div className="text-gray-500 mt-0.5">Service types included: {(SERVICE_CATEGORY_MAP[cat] || []).join(', ')}.</div>
        </li>
      ))}
    </ul>
  </div>
);

const ServiceCategoryEditorPanel: React.FC<{
  selectedCategories: ServiceCategory[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<ServiceCategory[]>>;
  recommendedCategories: ServiceCategory[];
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  savingProfile: boolean;
  className?: string;
}> = ({
  selectedCategories,
  setSelectedCategories,
  recommendedCategories,
  onCancel,
  onSave,
  savingProfile,
  className = 'mt-4',
}) => (
  <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${className}`}>
    <div className="flex items-center justify-between gap-2 mb-2">
      <div>
        <label className="block text-xs font-semibold text-gray-700">Select the categories you offer</label>
        <p className="text-[11px] text-gray-500 mt-0.5 max-w-prose">
          Each category turns on a set of service types you can price under Services. You can select more than one.{' '}
          <span className="text-gray-700 font-medium">
            Click &quot;Save categories&quot; to apply—checking boxes alone does not update your profile.
          </span>
        </p>
      </div>
      {recommendedCategories.length > 0 && (
        <button
          type="button"
          onClick={() => setSelectedCategories(recommendedCategories)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0"
        >
          Auto-select suggested
        </button>
      )}
    </div>
    <div className="space-y-2">
      {SERVICE_CATEGORIES.map((category) => {
        const isSelected = selectedCategories.includes(category);
        const includes = (SERVICE_CATEGORY_MAP[category] || []).join(', ');
        return (
          <label
            key={category}
            className={`block rounded-md border px-3 py-2.5 text-sm cursor-pointer ${
              isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedCategories((prev) => {
                    if (checked) {
                      if (prev.includes(category)) return prev;
                      return [...prev, category];
                    }
                    return prev.filter((c) => c !== category);
                  });
                }}
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0 flex-1">
                <span className="font-medium block">{category}</span>
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">{SERVICE_CATEGORY_DESCRIPTIONS[category]}</p>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  <span className="font-medium text-gray-600">Service types: </span>
                  {includes}
                </p>
              </div>
            </div>
          </label>
        );
      })}
    </div>
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-md"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => {
          void onSave();
        }}
        disabled={savingProfile}
        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
      >
        {savingProfile ? 'Saving...' : 'Save categories'}
      </button>
    </div>
  </div>
);

const ProfileFieldView: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: string;
  emptyHint?: string;
  locked?: boolean;
  helper?: string;
}> = ({ label, icon, value, emptyHint, locked, helper }) => (
  <div>
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
      <span className="text-gray-400">{icon}</span>
      {label}
      {locked && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 normal-case tracking-normal">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Locked
        </span>
      )}
    </label>
    {value ? (
      <div className="px-3.5 py-2.5 bg-white rounded-lg border border-gray-200 text-gray-900 font-medium text-sm">
        {value}
      </div>
    ) : (
      <div className="px-3.5 py-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 text-amber-700 text-sm flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {emptyHint || `Add your ${label.toLowerCase()}`}
      </div>
    )}
    {helper && <p className="mt-1 text-[11px] text-gray-400">{helper}</p>}
  </div>
);

const ProfileFieldEdit: React.FC<{
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  helper?: string;
}> = ({ label, icon, required, children, helper }) => (
  <div>
    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
      <span className="text-gray-400">{icon}</span>
      {label}
      {required && <span className="text-red-500 normal-case tracking-normal">*</span>}
    </label>
    {children}
    {helper && <p className="mt-1 text-[11px] text-gray-400">{helper}</p>}
  </div>
);

type RequestStatus = 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

type ServiceLineItem = { id: string; name: string; quantity?: number; price?: number };
type IncludedServicePrice = { id: string; name: string; price?: number; etaMinutes?: number; active?: boolean };
type ProviderServiceRow = {
  serviceType: string;
  price?: number;
  description?: string;
  etaMinutes?: number;
  active?: boolean;
  updatedAt?: string;
  includedServices?: IncludedServicePrice[];
};

interface ServiceRequest {
  id: string;
  providerId?: string | null;
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status: RequestStatus;
  scheduledAt?: string;
  notes?: string;
  carDetails?: string;
  /** Line items from customer cart (when provided by API). */
  services?: ServiceLineItem[];
  total?: number;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
}

type MatchReason = 'city_match' | 'service_match' | 'new_request';

function ServiceRequestPackages({ services, total }: { services?: ServiceLineItem[]; total?: number }) {
  const lines = (services ?? []).filter(
    (s): s is ServiceLineItem =>
      !!s &&
      typeof s === 'object' &&
      (typeof s.name === 'string' || typeof s.id === 'string'),
  );
  const computedAmount = lines.reduce((sum, line) => {
    const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
    const unitPrice =
      line.price != null && Number.isFinite(line.price) && line.price > 0 ? line.price : 0;
    return sum + unitPrice * qty;
  }, 0);
  const finalAmount = computedAmount > 0 ? computedAmount : total && total > 0 ? total : null;

  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide mb-2">Packages</p>
      <ul className="space-y-1.5">
        {lines.map((line) => {
          const label = line.name?.trim() || line.id;
          const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
          const price =
            line.price != null && Number.isFinite(line.price) && line.price > 0 ? line.price : null;
          return (
            <li
              key={`${line.id}-${label}`}
              className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm text-gray-800"
            >
              <span className="font-medium text-gray-900">{label}</span>
              <span className="text-gray-600 tabular-nums shrink-0">
                ×{qty}
                {price != null ? ` · ₹${price.toLocaleString('en-IN')}` : ''}
                {price != null ? ` = ₹${(price * qty).toLocaleString('en-IN')}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-indigo-200 pt-2 text-right">
        <span className="text-xs font-semibold text-indigo-700">
          Amount: {finalAmount != null ? `₹${finalAmount.toLocaleString('en-IN')}` : 'Pending quote'}
        </span>
      </div>
    </div>
  );
}

interface CarServiceDashboardProps {
  provider: Provider | null;
}

const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const serviceOptions = CAR_SERVICE_OPTIONS;

// ETA unit helpers — the provider form lets the user express ETA in minutes,
// hours, or days. Internally we always store ETA as minutes to keep the backend
// and downstream consumers unchanged.
type EtaUnit = 'min' | 'hr' | 'day';

const pickEtaUnit = (minutes: number | undefined | null): EtaUnit => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 'min';
  if (minutes >= 1440 && minutes % 1440 === 0) return 'day';
  if (minutes >= 60 && minutes % 60 === 0) return 'hr';
  return 'min';
};

const etaValueInUnit = (minutes: number, unit: EtaUnit): number => {
  if (unit === 'day') return minutes / 1440;
  if (unit === 'hr') return minutes / 60;
  return minutes;
};

const etaToMinutes = (value: number, unit: EtaUnit): number => {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (unit === 'day') return Math.round(value * 1440);
  if (unit === 'hr') return Math.round(value * 60);
  return Math.round(value);
};

const formatEtaReadable = (minutes: number | undefined | null): string => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const d = minutes / 1440;
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  if (minutes >= 1440) {
    const d = Math.floor(minutes / 1440);
    const h = Math.round((minutes - d * 1440) / 60);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hr${h === 1 ? '' : 's'}`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes} min`;
};

// Editable sub-service row used in the provider form. Prices/ETAs are kept as
// strings so empty inputs don't coerce to 0 and providers can type freely.
type IncludedServiceDraft = {
  id: string;
  name: string;
  priceText: string;
  etaText: string;
  etaUnit: EtaUnit;
  active: boolean;
};

const draftFromIncluded = (item: IncludedServicePrice, fallbackIdx: number): IncludedServiceDraft => {
  const unit = pickEtaUnit(item.etaMinutes);
  return {
    id:
      (item.id && String(item.id).trim()) ||
      subServiceIdFromName(item.name) ||
      `line-${fallbackIdx + 1}`,
    name: item.name || '',
    priceText: item.price != null && Number.isFinite(item.price) ? String(item.price) : '',
    etaText:
      item.etaMinutes != null && Number.isFinite(item.etaMinutes)
        ? String(etaValueInUnit(item.etaMinutes, unit))
        : '',
    etaUnit: unit,
    active: item.active !== false,
  };
};

const draftFromTemplate = (tmpl: SubServiceTemplate, fallbackIdx: number): IncludedServiceDraft => {
  const unit = pickEtaUnit(tmpl.suggestedEtaMinutes);
  return {
    id: tmpl.id || subServiceIdFromName(tmpl.name) || `line-${fallbackIdx + 1}`,
    name: tmpl.name,
    priceText:
      tmpl.suggestedPrice != null && Number.isFinite(tmpl.suggestedPrice) && tmpl.suggestedPrice > 0
        ? String(tmpl.suggestedPrice)
        : '',
    etaText:
      tmpl.suggestedEtaMinutes != null && Number.isFinite(tmpl.suggestedEtaMinutes)
        ? String(etaValueInUnit(tmpl.suggestedEtaMinutes, unit))
        : '',
    etaUnit: unit,
    active: true,
  };
};

const buildDraftsForServiceType = (
  serviceType: string,
  existing?: IncludedServicePrice[],
): IncludedServiceDraft[] => {
  const canonical = getSubServicesFor(serviceType);
  const existingByKey = new Map<string, IncludedServicePrice>();
  (existing || []).forEach((item) => {
    const key = subServiceIdFromName(item.name) || String(item.id || '').trim();
    if (key) existingByKey.set(key, item);
  });

  const drafts: IncludedServiceDraft[] = [];
  const used = new Set<string>();

  canonical.forEach((tmpl, idx) => {
    const key = subServiceIdFromName(tmpl.name);
    const match = existingByKey.get(key);
    if (match) {
      drafts.push(draftFromIncluded(match, idx));
      used.add(key);
    } else {
      // If provider hasn't added this canonical sub-service yet, include it as
      // inactive by default so they can opt-in per sub-service.
      drafts.push({
        ...draftFromTemplate(tmpl, idx),
        active: existing && existing.length > 0 ? false : true,
      });
    }
  });

  // Append any custom sub-services the provider previously added that aren't
  // in the canonical list.
  (existing || []).forEach((item, idx) => {
    const key = subServiceIdFromName(item.name) || String(item.id || '').trim();
    if (!key || used.has(key)) return;
    drafts.push(draftFromIncluded(item, canonical.length + idx));
    used.add(key);
  });

  return drafts;
};

const includedDraftsToPayload = (drafts: IncludedServiceDraft[]): IncludedServicePrice[] =>
  drafts
    .map((draft, idx) => {
      const name = (draft.name || '').trim();
      if (!name) return null;
      const priceNum = draft.priceText.trim() ? Number(draft.priceText) : undefined;
      const etaRaw = draft.etaText.trim() ? Number(draft.etaText) : undefined;
      const etaMinutes =
        etaRaw != null && Number.isFinite(etaRaw) && etaRaw >= 0
          ? etaToMinutes(etaRaw, draft.etaUnit || 'min')
          : undefined;
      const entry: IncludedServicePrice = {
        id: draft.id || subServiceIdFromName(name) || `line-${idx + 1}`,
        name,
        active: draft.active,
      };
      if (priceNum != null && Number.isFinite(priceNum) && priceNum >= 0) entry.price = priceNum;
      if (etaMinutes != null) entry.etaMinutes = etaMinutes;
      return entry;
    })
    .filter((entry): entry is IncludedServicePrice => entry !== null);

const CarServiceDashboard: React.FC<CarServiceDashboardProps> = ({ provider }) => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all' | 'due_today' | 'overdue'>('all');
  const [overviewRange, setOverviewRange] = useState<'today' | '7d' | '30d'>('7d');
  const [openFilters, setOpenFilters] = useState({
    // Default to all cities so providers do not accidentally hide request pool.
    city: '',
    serviceType: 'all',
    last24h: false,
  });
  const [lastOpenRefreshAt, setLastOpenRefreshAt] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [providerServices, setProviderServices] = useState<ProviderServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceForm, setServiceForm] = useState<{
    serviceType: string;
    price: string;
    description: string;
    etaMinutes: string;
    etaUnit: EtaUnit;
    includedServices: IncludedServiceDraft[];
    active: boolean;
  }>(() => ({
    serviceType: serviceOptions[0],
    price: '',
    description: '',
    etaMinutes: '',
    etaUnit: 'min',
    includedServices: buildDraftsForServiceType(serviceOptions[0]),
    active: true,
  }));
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingServiceType, setEditingServiceType] = useState<string | null>(null);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingWorkshops, setEditingWorkshops] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [workshopsInput, setWorkshopsInput] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<ServiceCategory[]>(provider?.serviceCategories || []);
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProvider, setLocalProvider] = useState<Provider | null>(provider);
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'services' | 'open' | 'my-requests'>(() => {
    try {
      const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
      if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
        sessionStorage.removeItem('serviceProviderActiveTab');
        return savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests';
      }
    } catch { /* storage unavailable */ }
    // Check URL hash as fallback
    const hash = window.location.hash.slice(1);
    if (hash && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(hash)) {
      return hash as 'overview' | 'profile' | 'services' | 'open' | 'my-requests';
    }
    return 'overview';
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(() => {
    const rawCity = (provider?.city || '').trim();
    const cleanCity = rawCity.toLowerCase() === 'pending setup' ? '' : rawCity;
    return {
      name: provider?.name || '',
      email: provider?.email || '',
      phone: provider?.phone || '',
      city: cleanCity,
      state: provider?.state || '',
      district: provider?.district || '',
      availability: provider?.availability || '',
    };
  });

  useEffect(() => {
    const c = (provider?.city || '').trim();
    if (c.toLowerCase() === 'pending setup') {
      setOpenFilters((prev) =>
        prev.city.trim().toLowerCase() === 'pending setup' ? { ...prev, city: '' } : prev
      );
    }
  }, [provider?.city]);

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const order = ['accepted', 'in_progress', 'completed', 'cancelled'] as RequestStatus[];
        const aIndex = order.indexOf(a.status);
        const bIndex = order.indexOf(b.status);
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }),
    [requests]
  );

  const isScheduledToday = (value?: string) => {
    if (!value) return false;
    const dt = new Date(value);
    if (!Number.isFinite(dt.getTime())) return false;
    const now = new Date();
    return dt.getDate() === now.getDate() && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  };

  const isOverdueRequest = (req: ServiceRequest) => {
    if (!req.scheduledAt || req.status === 'completed' || req.status === 'cancelled') return false;
    const scheduledMs = new Date(req.scheduledAt).getTime();
    return Number.isFinite(scheduledMs) && scheduledMs < Date.now();
  };

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return sortedRequests;
    if (statusFilter === 'due_today') return sortedRequests.filter((req) => isScheduledToday(req.scheduledAt));
    if (statusFilter === 'overdue') return sortedRequests.filter((req) => isOverdueRequest(req));
    return sortedRequests.filter((req) => req.status === statusFilter);
  }, [sortedRequests, statusFilter]);

  const myRequestStats = useMemo(() => {
    // Walk the requests array once; multiple per-status filters were doing
    // N passes over the list and were also recomputed in the chip row below.
    let accepted = 0;
    let inProgress = 0;
    let completed = 0;
    let completedToday = 0;
    let cancelled = 0;
    let dueToday = 0;
    let overdue = 0;
    for (const req of requests) {
      switch (req.status) {
        case 'accepted': accepted++; break;
        case 'in_progress': inProgress++; break;
        case 'completed':
          completed++;
          if (isScheduledToday(req.scheduledAt)) completedToday++;
          break;
        case 'cancelled': cancelled++; break;
        default: break;
      }
      if (isScheduledToday(req.scheduledAt)) dueToday++;
      if (isOverdueRequest(req)) overdue++;
    }
    return {
      total: requests.length,
      accepted,
      inProgress,
      completed,
      completedToday,
      cancelled,
      dueToday,
      overdue,
    };
  }, [requests]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      open: openRequests.length,
      accepted: requests.filter((r) => r.status === 'accepted').length,
      inProgress: requests.filter((r) => r.status === 'in_progress').length,
      completed: requests.filter((r) => r.status === 'completed').length,
    }),
    [requests, openRequests]
  );

  const isWithinOverviewRange = (iso?: string) => {
    if (!iso) return false;
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return false;
    const now = Date.now();
    if (overviewRange === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return ts >= start.getTime() && ts <= now;
    }
    const days = overviewRange === '7d' ? 7 : 30;
    return now - ts <= days * 24 * 60 * 60 * 1000;
  };

  const overviewRequests = useMemo(
    () => requests.filter((r) => isWithinOverviewRange(r.createdAt || r.updatedAt)),
    [overviewRange, requests],
  );

  const overviewOpenRequests = useMemo(
    () => openRequests.filter((r) => isWithinOverviewRange(r.createdAt || r.updatedAt)),
    [openRequests, overviewRange],
  );

  const overviewStats = useMemo(
    () => ({
      total: overviewRequests.length,
      open: overviewOpenRequests.length,
      accepted: overviewRequests.filter((r) => r.status === 'accepted').length,
      inProgress: overviewRequests.filter((r) => r.status === 'in_progress').length,
      completed: overviewRequests.filter((r) => r.status === 'completed').length,
      cancelled: overviewRequests.filter((r) => r.status === 'cancelled').length,
    }),
    // Previously depended on `.length` which missed content changes; depending on
    // the full array keeps KPIs in sync when statuses flip without length changes.
    [overviewOpenRequests, overviewRequests],
  );

  const activeProviderServices = useMemo(
    () => providerServices.filter((svc) => svc.active !== false),
    [providerServices],
  );

  const filteredProviderServices = useMemo(() => {
    return providerServices.filter((svc) => {
      const statusOk =
        serviceStatusFilter === 'all' ||
        (serviceStatusFilter === 'active' ? svc.active !== false : svc.active === false);
      const searchOk = serviceSearch
        ? String(svc.serviceType || '').toLowerCase().includes(serviceSearch.toLowerCase())
        : true;
      return statusOk && searchOk;
    });
  }, [providerServices, serviceSearch, serviceStatusFilter]);

  const providerSetupReady = useMemo(() => {
    const cityReady = Boolean((localProvider?.city || provider?.city || '').trim());
    const serviceReady = activeProviderServices.length > 0;
    return cityReady && serviceReady;
  }, [activeProviderServices.length, localProvider?.city, provider?.city]);

  const recommendedCategories = useMemo(() => {
    const activeNames = new Set(
      activeProviderServices.map((svc) => String(svc.serviceType || '').trim().toLowerCase()).filter(Boolean),
    );
    return SERVICE_CATEGORIES.filter((category) =>
      SERVICE_CATEGORY_MAP[category].some((service) => activeNames.has(service.toLowerCase())),
    );
  }, [activeProviderServices]);

  const effectiveSelectedCategories = useMemo(
    () => ((localProvider?.serviceCategories?.length ? localProvider.serviceCategories : selectedCategories) as ServiceCategory[]),
    [localProvider?.serviceCategories, selectedCategories],
  );

  const suggestedServiceTemplateNames = useMemo(() => {
    const names = effectiveSelectedCategories.flatMap((category) => SERVICE_CATEGORY_MAP[category] || []);
    const deduped = Array.from(new Set(names));
    return deduped.length > 0 ? deduped : DEFAULT_SERVICE_TEMPLATE_NAMES;
  }, [effectiveSelectedCategories]);

  const suggestedServiceTemplates = useMemo(
    () =>
      suggestedServiceTemplateNames.map((serviceType) => ({
        serviceType,
        ...SERVICE_TEMPLATE_PRESETS[serviceType],
      })),
    [suggestedServiceTemplateNames],
  );

  const profileReadiness = useMemo(() => {
    const hasSavedCategories = Boolean((localProvider?.serviceCategories || []).length);
    const hasPendingCategorySelection = editingCategories && selectedCategories.length > 0;
    const checks = [
      Boolean((localProvider?.city || '').trim()),
      Boolean((localProvider?.availability || '').trim()),
      Boolean(localProvider?.skills?.length),
      Boolean(localProvider?.workshops?.length),
      activeProviderServices.length > 0,
      hasSavedCategories || hasPendingCategorySelection,
    ];
    const completed = checks.filter(Boolean).length;
    return {
      percent: Math.round((completed / checks.length) * 100),
      completed,
      total: checks.length,
      checks,
    };
  }, [activeProviderServices.length, localProvider, editingCategories, selectedCategories.length]);

  const avgServicePrice = useMemo(() => {
    const priced = activeProviderServices
      .map((s) => s.price)
      .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
    if (priced.length === 0) return null;
    return Math.round(priced.reduce((sum, p) => sum + p, 0) / priced.length);
  }, [activeProviderServices]);

  const acceptanceRate = useMemo(() => {
    const actionable = overviewStats.accepted + overviewStats.inProgress + overviewStats.completed;
    if (actionable === 0) return 0;
    return Math.round((overviewStats.completed / actionable) * 100);
  }, [overviewStats.accepted, overviewStats.completed, overviewStats.inProgress]);

  const priorityAlerts = useMemo(() => {
    const alerts: Array<{ level: 'warn' | 'critical'; message: string }> = [];
    if (!(localProvider?.availability || '').trim()) {
      alerts.push({ level: 'warn', message: 'Availability is not set. You may miss matching opportunities.' });
    }
    if (activeProviderServices.length === 0) {
      alerts.push({ level: 'critical', message: 'No active services. You are unlikely to receive requests.' });
    }
    const staleOpen = openRequests.filter((req) => {
      if (!req.createdAt) return false;
      const ts = new Date(req.createdAt).getTime();
      return Number.isFinite(ts) && Date.now() - ts > 2 * 60 * 60 * 1000;
    }).length;
    if (staleOpen > 0) {
      alerts.push({ level: 'warn', message: `${staleOpen} open requests are older than 2h.` });
    }
    return alerts;
  }, [activeProviderServices.length, localProvider?.availability, openRequests]);

  const recentActivity = useMemo(() => {
    return [...overviewRequests]
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .slice(0, 5)
      .map((req) => ({
        id: req.id,
        title: req.title,
        when: req.updatedAt || req.createdAt,
        status: req.status,
      }));
  }, [overviewRequests]);

  const nextBestAction = useMemo(() => {
    if (!(localProvider?.availability || '').trim()) {
      return 'Set your availability to appear in more customer matches.';
    }
    if (activeProviderServices.length < 3) {
      return 'Add or activate at least 3 services to increase discoverability.';
    }
    if (!(localProvider?.serviceCategories || []).length) {
      return 'Select service categories so jobs are routed accurately.';
    }
    if (!(localProvider?.workshops || []).length) {
      return 'Add workshop locations to improve local request targeting.';
    }
    return 'Great setup. Keep response time low to maximize acceptance rate.';
  }, [activeProviderServices.length, localProvider]);

  const enrichedOpenRequests = useMemo(() => {
    const providerCity = (localProvider?.city || provider?.city || '').trim().toLowerCase();
    const activeServiceNames = new Set(
      activeProviderServices.map((svc) => String(svc.serviceType || '').trim().toLowerCase()).filter(Boolean),
    );
    const now = Date.now();
    return [...openRequests]
      .map((req) => {
        let score = 0;
        const reasons: MatchReason[] = [];
        const reqCity = (req.city || '').trim().toLowerCase();
        if (providerCity && reqCity && providerCity === reqCity) {
          score += 50;
          reasons.push('city_match');
        }
        const reqService = String(req.serviceType || '').trim().toLowerCase();
        if (reqService && activeServiceNames.has(reqService)) {
          score += 35;
          reasons.push('service_match');
        }
        const createdAt = req.createdAt ? new Date(req.createdAt).getTime() : Number.NaN;
        if (!Number.isNaN(createdAt)) {
          const mins = (now - createdAt) / 60000;
          if (mins <= 10) {
            score += 25;
            reasons.push('new_request');
          } else if (mins <= 60) {
            score += 10;
          }
        }
        return { ...req, _matchScore: score, _matchReasons: reasons };
      })
      .sort((a, b) => b._matchScore - a._matchScore);
  }, [activeProviderServices, localProvider?.city, openRequests, provider?.city]);

  const openRequestInsights = useMemo(() => {
    const total = enrichedOpenRequests.length;
    const strongMatches = enrichedOpenRequests.filter((req) => req._matchScore >= 60).length;
    const newPool = enrichedOpenRequests.filter((req) => req._matchReasons.includes('new_request')).length;
    const cityMatched = enrichedOpenRequests.filter((req) => req._matchReasons.includes('city_match')).length;
    return { total, strongMatches, newPool, cityMatched };
  }, [enrichedOpenRequests]);

  const formatDateTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const normalizeVehicleText = (vehicle: unknown): string => {
    if (typeof vehicle === 'string') return vehicle.trim();
    if (!vehicle || typeof vehicle !== 'object') return '';
    const raw = vehicle as Record<string, unknown>;
    const makeModel = [raw.make, raw.model]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim())
      .join(' ');
    const year = typeof raw.year === 'number' || typeof raw.year === 'string' ? String(raw.year).trim() : '';
    const reg = typeof raw.reg === 'string' ? raw.reg.trim() : '';
    const city = typeof raw.city === 'string' ? raw.city.trim() : '';
    const fuel = typeof raw.fuel === 'string' ? raw.fuel.trim() : '';
    const label = [makeModel, year ? `(${year})` : '', fuel, reg ? `· ${reg}` : '', city ? `· ${city}` : '']
      .filter(Boolean)
      .join(' ')
      .replace(/\s+·/g, ' ·')
      .trim();
    if (label) return label;
    try {
      return JSON.stringify(vehicle);
    } catch {
      return '';
    }
  };

  const normalizeServiceRequest = (req: ServiceRequest): ServiceRequest => ({
    ...req,
    vehicle: normalizeVehicleText(req.vehicle),
    carDetails: normalizeVehicleText(req.carDetails),
    city: typeof req.city === 'string' ? req.city : '',
  });

  const formatRelative = (value?: string) => {
    if (!value) return 'just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'just now';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const formatSlaRemaining = (createdAt?: string) => {
    if (!createdAt) return null;
    const created = new Date(createdAt).getTime();
    if (Number.isNaN(created)) return null;
    const SLA_MINUTES = 120;
    const remaining = SLA_MINUTES - Math.floor((Date.now() - created) / 60000);
    if (remaining <= 0) return 'Expired';
    if (remaining < 60) return `${remaining}m left`;
    return `${Math.floor(remaining / 60)}h ${remaining % 60}m left`;
  };

  const statusBadge = (status: RequestStatus) => {
    const base = 'px-3 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm';
    if (status === 'open') return `${base} bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border-amber-300`;
    if (status === 'accepted') return `${base} bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-300`;
    if (status === 'in_progress') return `${base} bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 border-indigo-300`;
    if (status === 'cancelled') return `${base} bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-red-300`;
    return `${base} bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-300`;
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const t = await getValidAccessToken();
    if (t.success && t.accessToken) {
      return { Authorization: `Bearer ${t.accessToken}` };
    }
    throw new Error(t.reason || 'Not authenticated. Please sign in again.');
  };

  // Dummy data helpers for quick UI checks (dev only)
  const buildSampleRequests = (assigned: boolean): ServiceRequest[] => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    const baseCity = provider?.city || 'Mock City';
    return [
      {
        id: `sample-${Date.now()}-1`,
        title: 'Oil change & filter',
        serviceType: 'General',
        services: [
          { id: 'pkg-oil', name: 'Standard oil change', quantity: 1, price: 2499 },
          { id: 'pkg-filter', name: 'Air filter replacement', quantity: 1, price: 450 },
        ],
        customerName: 'Demo User',
        customerPhone: '9999999999',
        vehicle: 'Honda City',
        city: baseCity,
        status: assigned ? 'accepted' : 'open',
        scheduledAt: fmt(now),
        notes: 'Please pick up from doorstep',
        providerId: assigned ? provider?.name || 'demo-provider' : null,
      },
      {
        id: `sample-${Date.now()}-2`,
        title: 'Brake inspection',
        serviceType: 'Brakes & Suspension',
        services: [{ id: 'pkg-brake', name: 'Brake inspection', quantity: 1 }],
        customerName: 'Alex Rider',
        customerPhone: '8888888888',
        vehicle: 'Hyundai i20',
        city: baseCity,
        status: assigned ? 'in_progress' : 'open',
        scheduledAt: fmt(new Date(now.getTime() + 3600 * 1000)),
        notes: 'Has minor squeak',
        providerId: assigned ? provider?.name || 'demo-provider' : null,
      },
    ];
  };

  const loadSampleOpenRequests = () => {
    setOpenRequests(buildSampleRequests(false));
  };

  const loadSampleMyRequests = () => {
    setRequests(buildSampleRequests(true));
  };

  const fetchProviderServices = async () => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/provider-services?scope=mine', { headers });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load services');
      }
      const data = await resp.json();
      setProviderServices(data);
      setEditingServiceType(null);
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setServicesLoading(false);
    }
  };

  const upsertService = async () => {
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const etaRaw = serviceForm.etaMinutes ? Number(serviceForm.etaMinutes) : undefined;
      const etaMinutesPayload =
        etaRaw != null && Number.isFinite(etaRaw) && etaRaw >= 0
          ? etaToMinutes(etaRaw, serviceForm.etaUnit || 'min')
          : undefined;
      const body = {
        serviceType: serviceForm.serviceType,
        price: serviceForm.price ? Number(serviceForm.price) : undefined,
        description: serviceForm.description,
        etaMinutes: etaMinutesPayload,
        includedServices: includedDraftsToPayload(serviceForm.includedServices),
        active: serviceForm.active,
      };
      const resp = await fetch('/api/provider-services', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save service');
      }
      const data = await resp.json();
      setProviderServices(data);
      
      // Reset form after successful save
      clearServiceForm();
      
      // Dispatch event to notify admin panel of service update
      window.dispatchEvent(new CustomEvent('serviceProviderServicesUpdated', {
        detail: { providerId: provider?.email || provider?.name, services: data }
      }));
      
      // Also update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderServicesLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Error saving service:', err);
      setServicesError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setSavingService(false);
    }
  };

  const toggleServiceActive = async (serviceType: string, active: boolean) => {
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const body = { serviceType, active };
      const resp = await fetch('/api/provider-services', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service');
      }
      const data = await resp.json();
      setProviderServices(data);
      
      // Dispatch event to notify admin panel of service update
      window.dispatchEvent(new CustomEvent('serviceProviderServicesUpdated', {
        detail: { providerId: provider?.email || provider?.name, services: data }
      }));
      
      // Also update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderServicesLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      console.error('Error toggling service:', err);
      setServicesError(err instanceof Error ? err.message : 'Failed to update service');
      // Revert the checkbox state on error
      const updatedServices = providerServices.map(svc => 
        svc.serviceType === serviceType ? { ...svc, active: !active } : svc
      );
      setProviderServices(updatedServices);
    } finally {
      setSavingService(false);
    }
  };

  const startEditService = (service: {
    serviceType: string;
    price?: number;
    description?: string;
    etaMinutes?: number;
    active?: boolean;
    includedServices?: IncludedServicePrice[];
  }) => {
    setEditingServiceType(service.serviceType);
    const unit = pickEtaUnit(service.etaMinutes);
    setServiceForm({
      serviceType: service.serviceType,
      price: service.price != null ? String(service.price) : '',
      description: service.description || '',
      etaMinutes:
        service.etaMinutes != null ? String(etaValueInUnit(service.etaMinutes, unit)) : '',
      etaUnit: unit,
      includedServices: buildDraftsForServiceType(service.serviceType, service.includedServices),
      active: service.active !== false,
    });
  };

  const clearServiceForm = () => {
    const nextType = suggestedServiceTemplateNames[0] || serviceOptions[0];
    setEditingServiceType(null);
    setServiceForm({
      serviceType: nextType,
      price: '',
      description: '',
      etaMinutes: '',
      etaUnit: 'min',
      includedServices: buildDraftsForServiceType(nextType),
      active: true,
    });
  };

  const applyServiceTemplate = (template: { serviceType: string; price: string; etaMinutes: string; description: string }) => {
    setEditingServiceType(null);
    // Template ETA values are provided in minutes; pick a natural unit for display.
    const etaMin = template.etaMinutes ? Number(template.etaMinutes) : NaN;
    const unit = Number.isFinite(etaMin) ? pickEtaUnit(etaMin) : 'min';
    const etaText = Number.isFinite(etaMin) ? String(etaValueInUnit(etaMin, unit)) : template.etaMinutes;
    setServiceForm({
      serviceType: template.serviceType,
      price: template.price,
      description: template.description,
      etaMinutes: etaText,
      etaUnit: unit,
      includedServices: buildDraftsForServiceType(template.serviceType),
      active: true,
    });
  };

  // When the provider changes the service type in the form, show ONLY the
  // sub-services that belong to the newly selected service. Sub-services from
  // the previously selected service type are dropped so they don't leak across
  // services. Prices/ETAs are preserved only for items whose names are present
  // in the new service type's canonical list.
  const changeServiceTypeInForm = (nextType: string) => {
    setServiceForm((prev) => {
      const canonicalForNext = getSubServicesFor(nextType);
      const canonicalKeys = new Set(canonicalForNext.map((t) => subServiceIdFromName(t.name)));

      // Index previously-entered drafts by canonical slug for price/ETA preservation.
      const prevByKey = new Map<string, IncludedServiceDraft>();
      prev.includedServices.forEach((d) => {
        const key = subServiceIdFromName(d.name);
        if (key && canonicalKeys.has(key)) prevByKey.set(key, d);
      });

      const drafts: IncludedServiceDraft[] = canonicalForNext.map((tmpl, idx) => {
        const key = subServiceIdFromName(tmpl.name);
        const preservedDraft = prevByKey.get(key);
        const base = draftFromTemplate(tmpl, idx);
        if (preservedDraft) {
          return {
            ...base,
            priceText: preservedDraft.priceText || base.priceText,
            etaText: preservedDraft.etaText || base.etaText,
            etaUnit: preservedDraft.etaText ? preservedDraft.etaUnit : base.etaUnit,
            active: true,
          };
        }
        return { ...base, active: true };
      });

      return {
        ...prev,
        serviceType: nextType,
        includedServices: drafts,
      };
    });
  };

  const updateSubServiceDraft = (idx: number, patch: Partial<IncludedServiceDraft>) => {
    setServiceForm((prev) => {
      const next = prev.includedServices.slice();
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, includedServices: next };
    });
  };

  const removeSubServiceDraft = (idx: number) => {
    setServiceForm((prev) => {
      const next = prev.includedServices.slice();
      next.splice(idx, 1);
      return { ...prev, includedServices: next };
    });
  };

  const addCustomSubServiceDraft = () => {
    setServiceForm((prev) => ({
      ...prev,
      includedServices: [
        ...prev.includedServices,
        {
          id: `custom-${Date.now()}`,
          name: '',
          priceText: '',
          etaText: '',
          etaUnit: 'min',
          active: true,
        },
      ],
    }));
  };

  const toggleAllSubServiceDrafts = (active: boolean) => {
    setServiceForm((prev) => ({
      ...prev,
      includedServices: prev.includedServices.map((d) => ({ ...d, active })),
    }));
  };

  const subServiceTotal = useMemo(() => {
    return serviceForm.includedServices
      .filter((d) => d.active)
      .reduce((sum, d) => {
        const n = Number(d.priceText);
        return Number.isFinite(n) && n > 0 ? sum + n : sum;
      }, 0);
  }, [serviceForm.includedServices]);

  const applySubServiceTotalAsBase = () => {
    if (subServiceTotal <= 0) return;
    setServiceForm((prev) => ({ ...prev, price: String(subServiceTotal) }));
  };

  const deleteService = async (serviceType: string) => {
    if (!window.confirm(`Delete "${serviceType}" from your service list?`)) return;
    setSavingService(true);
    setServicesError(null);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`/api/provider-services?serviceType=${encodeURIComponent(serviceType)}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete service');
      }
      const data = await resp.json();
      setProviderServices(Array.isArray(data) ? data : []);
      if (editingServiceType === serviceType) {
        clearServiceForm();
      }
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setSavingService(false);
    }
  };

  const withToken = async (): Promise<string> => {
    const t = await getValidAccessToken();
    if (t.success && t.accessToken) {
      return t.accessToken;
    }
    throw new Error(t.reason || 'Not authenticated. Please sign in again.');
  };

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load requests');
      }
      const data = await resp.json();
      const normalized = Array.isArray(data) ? data.map((req) => normalizeServiceRequest(req as ServiceRequest)) : [];
      setRequests(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenRequests = async () => {
    setOpenLoading(true);
    try {
      const token = await withToken();
      const params = new URLSearchParams();
      params.set('scope', 'open');
      const cityRaw = openFilters.city.trim();
      const cityQuery =
        cityRaw.toLowerCase() === 'pending setup' ? '' : cityRaw;
      if (cityQuery) params.set('city', cityQuery);
      if (openFilters.serviceType !== 'all') params.set('serviceType', openFilters.serviceType);
      if (openFilters.last24h) params.set('recentHours', '24');
      const resp = await fetch(`/api/service-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load open requests');
      }
      const data = await resp.json();
      const normalized = Array.isArray(data) ? data.map((req) => normalizeServiceRequest(req as ServiceRequest)) : [];
      // Dev-only telemetry hook (avoid noisy localhost calls in production).
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0a2ed1' },
          body: JSON.stringify({
            sessionId: '0a2ed1',
            runId: 'post-fix',
            hypothesisId: 'H1-H5',
            location: 'CarServiceDashboard.tsx:fetchOpenRequests',
            message: 'open pool client response',
            data: {
              query: params.toString(),
              cityFilterSent: Boolean(cityQuery),
              cityFilterRawLen: cityRaw.length,
              isPlaceholderCityFilter: cityRaw.toLowerCase() === 'pending setup',
              serviceType: openFilters.serviceType,
              ok: resp.ok,
              resultCount: normalized.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      setOpenRequests(normalized);
      setLastOpenRefreshAt(new Date().toISOString());
      setRefreshNotice(`Open requests refreshed (${normalized.length})`);
      window.setTimeout(() => setRefreshNotice(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load open requests');
    } finally {
      setOpenLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchRequests();
    fetchOpenRequests();
  };

  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    if (!provider) return;
    const tick = () => handleRefreshRef.current();
    const interval = window.setInterval(tick, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    let active = true;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`provider-open-requests-${provider.email || provider.name || 'unknown'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests' },
        () => {
          if (!active) return;
          handleRefreshRef.current();
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [provider]);

  const claimRequest = async (id: string) => {
    setClaimingId(id);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'claim' }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to claim request');
      }
      const updated = normalizeServiceRequest(await resp.json());
      setRequests((prev) => [updated, ...prev]);
      setOpenRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim request');
    } finally {
      setClaimingId(null);
    }
  };

  const updateStatus = async (id: string, status: RequestStatus) => {
    try {
      const currentRequest = requests.find((req) => req.id === id);
      if (currentRequest?.status === 'cancelled' || currentRequest?.status === 'completed') {
        setError('This request is locked and its status cannot be changed.');
        window.setTimeout(() => {
          setError((prev) =>
            prev === 'This request is locked and its status cannot be changed.' ? null : prev,
          );
        }, 2500);
        return;
      }
      const token = await withToken();
      const resp = await fetch('/api/service-requests', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update status');
      }
      const updated = normalizeServiceRequest(await resp.json());
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const deleteCancelledRequest = async (id: string) => {
    if (!window.confirm('Delete this cancelled request permanently?')) return;
    setDeletingId(id);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch(`/api/service-requests?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete request');
      }
      setRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete request');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (provider) {
      setLocalProvider(provider);
      // Do not overwrite a draft while the categories panel is open.
      setSelectedCategories((prev) => (editingCategories ? prev : (provider.serviceCategories || [])));
      setSkillsInput(provider.skills?.join(', ') || '');
      setWorkshopsInput(provider.workshops?.join(', ') || '');
      setProfileForm({
        name: provider.name || '',
        email: provider.email || '',
        phone: provider.phone || '',
        city: provider.city || '',
        state: provider.state || '',
        district: provider.district || '',
        availability: provider.availability || '',
      });
      fetchRequests();
      fetchOpenRequests();
      fetchProviderServices();
    }
  }, [provider, editingCategories]);

  // Listen for profile updates from other tabs/windows
  useEffect(() => {
    const handleProfileUpdate = async () => {
      // Refresh provider data when updated elsewhere
      try {
        const token = await withToken();
        const resp = await fetch('/api/service-providers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const updated = await resp.json();
          setLocalProvider(updated);
          setProfileForm({
            name: updated.name || '',
            email: updated.email || '',
            phone: updated.phone || '',
            city: updated.city || '',
            state: updated.state || '',
            district: updated.district || '',
            availability: updated.availability || '',
          });
          setSelectedCategories(updated.serviceCategories || []);
        }
      } catch (err) {
        console.warn('Failed to refresh provider data:', err);
      }
    };
    
    window.addEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'serviceProviderProfileLastUpdate') {
        handleProfileUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      window.removeEventListener('serviceProviderProfileUpdated', handleProfileUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Listen for tab changes from external sources (e.g., header dropdown)
  useEffect(() => {
    const checkTab = () => {
      try {
        const savedTab = sessionStorage.getItem('serviceProviderActiveTab');
        if (savedTab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(savedTab)) {
          setActiveTab(savedTab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests');
          sessionStorage.removeItem('serviceProviderActiveTab');
        }
      } catch { /* storage unavailable */ }
    };
    
    // Listen for custom event from header
    const handleTabChange = (e: CustomEvent) => {
      const tab = e.detail?.tab;
      if (tab && ['overview', 'profile', 'services', 'open', 'my-requests'].includes(tab)) {
        setActiveTab(tab as 'overview' | 'profile' | 'services' | 'open' | 'my-requests');
      }
    };
    
    // Check on mount
    checkTab();
    
    // Listen for custom event
    window.addEventListener('serviceProviderTabChange', handleTabChange as EventListener);
    
    return () => {
      window.removeEventListener('serviceProviderTabChange', handleTabChange as EventListener);
    };
  }, []);

  const saveProfile = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localProvider.email,
          name: profileForm.name,
          phone: profileForm.phone,
          city: profileForm.city,
          state: profileForm.state,
          district: profileForm.district,
          availability: profileForm.availability,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update profile');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingProfile(false);
      
      // Dispatch event to notify admin panel and other components
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      
      // Update localStorage to trigger cross-tab sync
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
        window.dispatchEvent(new Event('storage'));
      }
      
      // Refresh provider data to ensure sync
      try {
        const refreshResp = await fetch('/api/service-providers', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshResp.ok) {
          const refreshed = await refreshResp.json();
          setLocalProvider(refreshed);
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh provider data:', refreshErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSkills = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: localProvider.email, skills: skillsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update skills');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingSkills(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skills');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveWorkshops = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const workshopsArray = workshopsInput.split(',').map(w => w.trim()).filter(Boolean);
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: localProvider.email, workshops: workshopsArray }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update workshops');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingWorkshops(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workshops');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveCategories = async () => {
    if (!localProvider) return;
    setSavingProfile(true);
    setError(null);
    try {
      const token = await withToken();
      const resp = await fetch('/api/service-providers', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: localProvider.email, serviceCategories: selectedCategories }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update service categories');
      }
      const updated = await resp.json();
      setLocalProvider(updated);
      setEditingCategories(false);
      
      // Notify admin panel of update
      window.dispatchEvent(new CustomEvent('serviceProviderProfileUpdated', {
        detail: { providerId: updated?.email || updated?.name, profile: updated }
      }));
      localStorage.setItem('serviceProviderProfileLastUpdate', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service categories');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
          <p className="text-gray-700 font-semibold">No provider data. Please log in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <header className="bg-gradient-to-r from-white via-blue-50/30 to-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Service Dashboard</h1>
                {(() => {
                  const rawCity = (localProvider?.city || '').trim();
                  const hasRealCity = rawCity && rawCity.toLowerCase() !== 'pending setup';
                  return (
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {hasRealCity ? (
                        rawCity
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('profile');
                            setEditingProfile(true);
                          }}
                          className="text-amber-700 hover:text-amber-800 underline decoration-dotted underline-offset-2"
                        >
                          Set your city
                        </button>
                      )}
                    </p>
                  );
                })()}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || openLoading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white text-sm font-semibold hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 disabled:opacity-60 shadow-md transition-all flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading || openLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading || openLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Enhanced Tab Navigation — semantic tablist with keyboard support */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-1.5">
          {(() => {
            const providerTabs: Array<{
              id: 'overview' | 'services' | 'open' | 'my-requests';
              label: string;
              badge?: number;
              badgeColor?: string;
              icon: React.ReactNode;
            }> = [
              {
                id: 'overview',
                label: 'Overview',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
              {
                id: 'services',
                label: 'Services & Pricing',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                ),
              },
              {
                id: 'open',
                label: 'Open Requests',
                badge: stats.open,
                badgeColor: 'bg-amber-500',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                id: 'my-requests',
                label: 'My Requests',
                badge: stats.total,
                badgeColor: 'bg-blue-500',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                ),
              },
            ];
            return (
              <div
                role="tablist"
                aria-label="Service provider dashboard"
                className="flex space-x-2 overflow-x-auto"
              >
                {providerTabs.map((tab, i) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      type="button"
                      id={`csd-tab-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls={`csd-panel-${tab.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
                        e.preventDefault();
                        let nextIdx = i;
                        if (e.key === 'ArrowRight') nextIdx = (i + 1) % providerTabs.length;
                        else if (e.key === 'ArrowLeft') nextIdx = (i - 1 + providerTabs.length) % providerTabs.length;
                        else if (e.key === 'Home') nextIdx = 0;
                        else if (e.key === 'End') nextIdx = providerTabs.length - 1;
                        const next = providerTabs[nextIdx];
                        if (next) setActiveTab(next.id);
                      }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span
                          aria-label={`${tab.badge} items`}
                          className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                            isActive ? 'bg-white/20 text-white' : `${tab.badgeColor ?? 'bg-gray-500'} text-white`
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {priorityAlerts.some((a) => a.level === 'critical') && (
                <section className="mb-6">
                  {priorityAlerts
                    .filter((a) => a.level === 'critical')
                    .slice(0, 1)
                    .map((alert, idx) => (
                      <div
                        key={`${alert.message}-${idx}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 flex-shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
                          </svg>
                          <p className="text-sm font-medium text-red-800">{alert.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('services')}
                          className="flex-shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Add services
                        </button>
                      </div>
                    ))}
                </section>
              )}

              {profileReadiness.percent < 100 && (
                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Finish setting up your profile</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {profileReadiness.completed} of {profileReadiness.total} steps complete · helps you get more requests
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{profileReadiness.percent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-5">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${profileReadiness.percent}%` }}
                    />
                  </div>
                  <ServiceCategoriesExplainerBox />
                  <ul className="divide-y divide-gray-100">
                    {[
                      {
                        label: 'City',
                        done: profileReadiness.checks[0],
                        value: localProvider?.city,
                        action: () => {
                          setActiveTab('profile');
                          setEditingProfile(true);
                        },
                        actionLabel: 'Set city',
                      },
                      {
                        label: 'Availability',
                        done: profileReadiness.checks[1],
                        value: localProvider?.availability,
                        action: () => {
                          setActiveTab('profile');
                          setEditingProfile(true);
                        },
                        actionLabel: 'Set availability',
                      },
                      {
                        label: 'Skills',
                        done: profileReadiness.checks[2],
                        value: localProvider?.skills?.join(', '),
                        action: () => setEditingSkills(true),
                        actionLabel: 'Add skills',
                      },
                      {
                        label: 'Workshops',
                        done: profileReadiness.checks[3],
                        value: localProvider?.workshops?.join(', '),
                        action: () => setEditingWorkshops(true),
                        actionLabel: 'Add workshop',
                      },
                      {
                        label: 'Active services',
                        done: profileReadiness.checks[4],
                        value: activeProviderServices.length ? `${activeProviderServices.length} active` : undefined,
                        action: () => setActiveTab('services'),
                        actionLabel: 'Add services',
                      },
                      {
                        label: 'Service categories',
                        done: profileReadiness.checks[5],
                        value: (editingCategories
                          ? selectedCategories
                          : localProvider?.serviceCategories || []
                        ).join(', '),
                        action: () => {
                          setSelectedCategories(localProvider?.serviceCategories || recommendedCategories);
                          setEditingCategories(true);
                        },
                        actionLabel: 'Choose categories',
                        /** Was hidden once "done"—users could not reopen the editor. */
                        alwaysShowAction: true,
                      },
                    ].map((item) => {
                      const showCta = !item.done || ('alwaysShowAction' in item && item.alwaysShowAction);
                      const ctaLabel =
                        'alwaysShowAction' in item && item.alwaysShowAction && item.done
                          ? 'Change'
                          : item.actionLabel;
                      return (
                      <li key={item.label} className="flex items-center gap-3 py-3">
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                            item.done ? 'bg-emerald-100 text-emerald-700' : 'border-2 border-gray-200 bg-white'
                          }`}
                        >
                          {item.done ? (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${item.done ? 'text-gray-900' : 'text-gray-700'}`}>{item.label}</p>
                          {item.done && item.value ? (
                            <p className="text-xs text-gray-500 truncate">{item.value}</p>
                          ) : null}
                        </div>
                        {showCta && (
                          <button
                            type="button"
                            onClick={item.action}
                            className="flex-shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            {ctaLabel}
                          </button>
                        )}
                      </li>
                    );
                    })}
                  </ul>

                  {editingSkills && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Skills (comma-separated)</label>
                      <input
                        type="text"
                        value={skillsInput}
                        onChange={(e) => setSkillsInput(e.target.value)}
                        placeholder="e.g. Engine repair, AC service, Detailing"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSkills(false);
                            setSkillsInput(localProvider?.skills?.join(', ') || '');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSkills}
                          disabled={savingProfile}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingProfile ? 'Saving...' : 'Save skills'}
                        </button>
                      </div>
                    </div>
                  )}

                  {editingWorkshops && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Workshop locations (comma-separated)</label>
                      <input
                        type="text"
                        value={workshopsInput}
                        onChange={(e) => setWorkshopsInput(e.target.value)}
                        placeholder="e.g. Koramangala, Indiranagar"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWorkshops(false);
                            setWorkshopsInput(localProvider?.workshops?.join(', ') || '');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveWorkshops}
                          disabled={savingProfile}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                        >
                          {savingProfile ? 'Saving...' : 'Save workshops'}
                        </button>
                      </div>
                    </div>
                  )}

                  {editingCategories && (
                    <ServiceCategoryEditorPanel
                      className="mt-4"
                      selectedCategories={selectedCategories}
                      setSelectedCategories={setSelectedCategories}
                      recommendedCategories={recommendedCategories}
                      savingProfile={savingProfile}
                      onSave={saveCategories}
                      onCancel={() => {
                        setEditingCategories(false);
                        setSelectedCategories(localProvider?.serviceCategories || []);
                      }}
                    />
                  )}
                </section>
              )}

              {profileReadiness.percent >= 100 && (
                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Service categories</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Review what each group includes, or change your selection. Same options as in profile setup.
                    </p>
                  </div>
                  <ServiceCategoriesExplainerBox className="mb-3" />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 border-t border-gray-100 pt-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500">Your current selection</p>
                      <p className="text-sm text-gray-900 break-words">
                        {(localProvider?.serviceCategories || []).length
                          ? (localProvider?.serviceCategories || []).join(', ')
                          : 'None — choose categories to match your workshop.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategories(localProvider?.serviceCategories || recommendedCategories);
                        setEditingCategories(true);
                      }}
                      className="flex-shrink-0 self-start rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      {editingCategories ? 'Editing…' : 'Change categories'}
                    </button>
                  </div>
                  {editingCategories && (
                    <ServiceCategoryEditorPanel
                      className="mt-4"
                      selectedCategories={selectedCategories}
                      setSelectedCategories={setSelectedCategories}
                      recommendedCategories={recommendedCategories}
                      savingProfile={savingProfile}
                      onSave={saveCategories}
                      onCancel={() => {
                        setEditingCategories(false);
                        setSelectedCategories(localProvider?.serviceCategories || []);
                      }}
                    />
                  )}
                </section>
              )}

              {/* KPI Stats */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">At a glance</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Your activity and performance</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                    {(['today', '7d', '30d'] as const).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setOverviewRange(range)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                          overviewRange === range
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {range === 'today' ? 'Today' : range === '7d' ? '7 days' : '30 days'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('open')}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-amber-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open jobs</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 leading-none">{overviewStats.open}</p>
                    <p className="text-xs text-gray-500 mt-2">Available to claim</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-requests');
                      setStatusFilter('accepted');
                    }}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accepted</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 leading-none">{overviewStats.accepted}</p>
                    <p className="text-xs text-gray-500 mt-2">{overviewStats.inProgress} in progress</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('my-requests');
                      setStatusFilter('completed');
                    }}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 leading-none">{overviewStats.completed}</p>
                    <p className="text-xs text-gray-500 mt-2">{acceptanceRate}% completion rate</p>
                  </button>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. revenue</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 text-violet-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 leading-none">
                      ₹{((avgServicePrice || 0) * overviewStats.completed).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Avg job: {avgServicePrice ? `₹${avgServicePrice.toLocaleString('en-IN')}` : 'NA'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Activity + Next action */}
              <section className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Recent activity</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('my-requests')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      View all
                    </button>
                  </div>
                  {recentActivity.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <div className="mx-auto h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">No activity yet</p>
                      <p className="text-xs text-gray-400 mt-1">New requests will appear here</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {recentActivity.map((item) => {
                        const statusStyles: Record<string, string> = {
                          open: 'bg-amber-50 text-amber-700',
                          accepted: 'bg-blue-50 text-blue-700',
                          in_progress: 'bg-violet-50 text-violet-700',
                          completed: 'bg-emerald-50 text-emerald-700',
                          cancelled: 'bg-gray-100 text-gray-600',
                        };
                        return (
                          <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{formatRelative(item.when)}</p>
                            </div>
                            <span
                              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                statusStyles[item.status] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </span>
                    <h3 className="text-sm font-semibold text-blue-900">Suggested next step</h3>
                  </div>
                  <p className="text-sm text-blue-900 mb-4">{nextBestAction}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('services')}
                    className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Take action
                  </button>
                  {overviewStats.cancelled > 0 && (
                    <p className="mt-4 pt-4 border-t border-blue-200 text-xs text-blue-800">
                      Cancellation rate: <span className="font-semibold">{overviewStats.total ? Math.round((overviewStats.cancelled / overviewStats.total) * 100) : 0}%</span>
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (() => {
            // Normalize placeholder values so "Pending setup" and "0000000000" are
            // treated as missing rather than real data.
            const cleanValue = (raw?: string): string => {
              const v = (raw || '').trim();
              if (!v) return '';
              if (v.toLowerCase() === 'pending setup') return '';
              if (v === '0000000000') return '';
              return v;
            };
            const cName = cleanValue(localProvider?.name);
            const cEmail = cleanValue(localProvider?.email);
            const cPhone = cleanValue(localProvider?.phone);
            const cCity = cleanValue(localProvider?.city);
            const cState = cleanValue(localProvider?.state);
            const cDistrict = cleanValue(localProvider?.district);
            const cAvailability = cleanValue(localProvider?.availability);

            const profileFields = [
              { key: 'name', filled: !!cName },
              { key: 'phone', filled: !!cPhone },
              { key: 'city', filled: !!cCity },
              { key: 'state', filled: !!cState },
              { key: 'district', filled: !!cDistrict },
              { key: 'availability', filled: !!cAvailability },
            ];
            const filledCount = profileFields.filter((f) => f.filled).length;
            const completion = Math.round((filledCount / profileFields.length) * 100);
            const isComplete = completion === 100;
            const initial = (cName || cEmail || 'P').trim().charAt(0).toUpperCase();

            const availabilityOptions = [
              { value: '', label: 'Select availability' },
              { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
              { value: 'weekends', label: 'Weekends (Sat–Sun)' },
              { value: 'daily', label: 'All week (Mon–Sun)' },
              { value: '24x7', label: '24 × 7' },
            ];
            const availabilityLabel = (val: string) => {
              const match = availabilityOptions.find((o) => o.value === val.toLowerCase());
              return match ? match.label : val;
            };

            // FieldView / FieldEdit and the icon constants are intentionally
            // declared at module scope (see top of file) so the <input>
            // elements keep their identity across renders and don't lose
            // focus on every keystroke.
            const FieldView = ProfileFieldView;
            const FieldEdit = ProfileFieldEdit;
            const userIcon = PROFILE_USER_ICON;
            const mailIcon = PROFILE_MAIL_ICON;
            const phoneIcon = PROFILE_PHONE_ICON;
            const pinIcon = PROFILE_PIN_ICON;
            const mapIcon = PROFILE_MAP_ICON;
            const clockIcon = PROFILE_CLOCK_ICON;
            const inputCls = PROFILE_INPUT_CLS;

            return (
              <section className="space-y-5">
                {/* Hero / Summary card */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                  <div className="relative px-5 sm:px-8 pt-6 pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
                      <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white shadow-lg ring-4 ring-white flex items-center justify-center">
                        <div className="h-full w-full rounded-[14px] bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white flex items-center justify-center text-3xl font-bold">
                          {initial}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 sm:pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                            {cName || 'Service Provider'}
                          </h2>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-[11px] font-semibold">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2L3 5v6c0 4.5 3 8.5 7 9 4-0.5 7-4.5 7-9V5l-7-3z" />
                            </svg>
                            Service Provider
                          </span>
                          {isComplete && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Complete
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">{mailIcon}{cEmail || 'No email'}</span>
                          {cCity && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="inline-flex items-center gap-1">{pinIcon}{cCity}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 sm:pb-1">
                        {!editingProfile ? (
                          <button
                            onClick={() => setEditingProfile(true)}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Profile
                          </button>
                        ) : (
                          <span className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Editing
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Completion progress */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                        <span className="font-medium">Profile completion</span>
                        <span className="font-semibold text-gray-900">
                          {filledCount} / {profileFields.length} fields · {completion}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isComplete
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                              : completion >= 50
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                              : 'bg-gradient-to-r from-amber-400 to-amber-500'
                          }`}
                          style={{ width: `${Math.max(completion, 4)}%` }}
                        />
                      </div>
                      {!isComplete && (
                        <p className="mt-2 text-[11px] text-gray-500">
                          Complete your profile so customers can find and trust you.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* Personal information */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Personal information</h3>
                      <p className="text-xs text-gray-500">Your contact details shown to customers.</p>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {editingProfile ? (
                      <>
                        <FieldEdit label="Full name" icon={userIcon} required>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            className={inputCls}
                            placeholder="e.g., Rahul Kumar"
                          />
                        </FieldEdit>
                        <FieldEdit label="Email" icon={mailIcon} helper="Email is used for sign-in and cannot be changed.">
                          <div className="px-3.5 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-gray-500 text-sm flex items-center justify-between gap-2">
                            <span className="truncate">{cEmail || '—'}</span>
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                        </FieldEdit>
                        <FieldEdit label="Phone" icon={phoneIcon} required helper="Used for booking confirmations.">
                          <input
                            type="tel"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            className={inputCls}
                            placeholder="e.g., 9876543210"
                          />
                        </FieldEdit>
                      </>
                    ) : (
                      <>
                        <FieldView label="Full name" icon={userIcon} value={cName} emptyHint="Add your full name" />
                        <FieldView label="Email" icon={mailIcon} value={cEmail} locked />
                        <FieldView label="Phone" icon={phoneIcon} value={cPhone} emptyHint="Add a contact number" />
                      </>
                    )}
                  </div>
                </div>

                {/* Service location */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
                    <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Service location</h3>
                      <p className="text-xs text-gray-500">Where you offer services. Used to match nearby customers.</p>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {editingProfile ? (
                      <>
                        <FieldEdit label="City" icon={pinIcon} required>
                          <input
                            type="text"
                            value={profileForm.city}
                            onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                            className={inputCls}
                            placeholder="e.g., Mumbai"
                          />
                        </FieldEdit>
                        <FieldEdit label="State" icon={mapIcon}>
                          <input
                            type="text"
                            value={profileForm.state}
                            onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                            className={inputCls}
                            placeholder="e.g., Maharashtra"
                          />
                        </FieldEdit>
                        <FieldEdit label="District" icon={mapIcon}>
                          <input
                            type="text"
                            value={profileForm.district}
                            onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                            className={inputCls}
                            placeholder="e.g., Mumbai Suburban"
                          />
                        </FieldEdit>
                      </>
                    ) : (
                      <>
                        <FieldView label="City" icon={pinIcon} value={cCity} emptyHint="Add your city" />
                        <FieldView label="State" icon={mapIcon} value={cState} emptyHint="Add your state" />
                        <FieldView label="District" icon={mapIcon} value={cDistrict} emptyHint="Add your district" />
                      </>
                    )}
                  </div>
                </div>

                {/* Availability */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
                    <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Working availability</h3>
                      <p className="text-xs text-gray-500">When you're available to take service bookings.</p>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    {editingProfile ? (
                      <FieldEdit label="Availability" icon={clockIcon}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {availabilityOptions
                            .filter((o) => o.value !== '')
                            .map((opt) => {
                              const selected =
                                (profileForm.availability || '').toLowerCase() === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    setProfileForm({ ...profileForm, availability: opt.value })
                                  }
                                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                                    selected
                                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                        </div>
                      </FieldEdit>
                    ) : (
                      <FieldView
                        label="Availability"
                        icon={clockIcon}
                        value={cAvailability ? availabilityLabel(cAvailability) : ''}
                        emptyHint="Set your working days"
                      />
                    )}
                  </div>
                </div>

                {/* Sticky action bar when editing */}
                {editingProfile && (
                  <div className="sticky bottom-4 z-10">
                    <div className="rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500 hidden sm:block">
                        Review your changes, then save to update your public profile.
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={() => {
                            setEditingProfile(false);
                            setProfileForm({
                              name: cName,
                              email: cEmail,
                              phone: cPhone,
                              city: cCity,
                              state: cState,
                              district: cDistrict,
                              availability: cAvailability,
                            });
                          }}
                          className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveProfile}
                          disabled={savingProfile}
                          className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 shadow-sm transition flex items-center gap-2"
                        >
                          {savingProfile ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* Services & Pricing Tab */}
          {activeTab === 'services' && (
            <section className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {editingServiceType ? `Edit ${editingServiceType}` : 'Add a service'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Set price, ETA and what's included. Customers see this when matching.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                    <span className={`h-1.5 w-1.5 rounded-full ${activeProviderServices.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {activeProviderServices.length} active
                  </span>
                </div>
                {suggestedServiceTemplates.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 mr-1">Suggested:</span>
                    {suggestedServiceTemplates.slice(0, 6).map((template) => (
                      <button
                        key={template.serviceType}
                        type="button"
                        onClick={() => applyServiceTemplate(template)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        + {template.serviceType}
                      </button>
                    ))}
                  </div>
                )}
                {servicesError && (
                  <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                    {servicesError}
                  </div>
                )}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Service</label>
                    <select
                      value={serviceForm.serviceType}
                      onChange={(e) => changeServiceTypeInForm(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {serviceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Full service price (₹)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1999"
                      />
                      {subServiceTotal > 0 && (
                        <button
                          type="button"
                          onClick={applySubServiceTotalAsBase}
                          title="Use the sum of active sub-service prices as the full service price"
                          className="whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Use ₹{subServiceTotal.toLocaleString('en-IN')}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Charged when a customer books the entire service bundle.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">ETA</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={serviceForm.etaMinutes}
                        onChange={(e) => setServiceForm({ ...serviceForm, etaMinutes: e.target.value })}
                        className="flex-1 min-w-0 px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={
                          serviceForm.etaUnit === 'day' ? '1' : serviceForm.etaUnit === 'hr' ? '2' : '120'
                        }
                      />
                      <select
                        value={serviceForm.etaUnit}
                        onChange={(e) =>
                          setServiceForm({ ...serviceForm, etaUnit: e.target.value as EtaUnit })
                        }
                        className="px-3 py-2 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        aria-label="ETA unit"
                      >
                        <option value="min">minutes</option>
                        <option value="hr">hours</option>
                        <option value="day">days</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Optional details or inclusions"
                    rows={2}
                  />
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Sub-services &amp; per-item pricing
                      </label>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Set a price for each sub-service. Customers can book the full service or only the sub-services they need.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleAllSubServiceDrafts(true)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Enable all
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAllSubServiceDrafts(false)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Disable all
                      </button>
                      <button
                        type="button"
                        onClick={addCustomSubServiceDraft}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        + Add custom
                      </button>
                    </div>
                  </div>

                  {serviceForm.includedServices.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-xs text-gray-600">
                      No sub-services defined yet. Click "+ Add custom" to add one.
                    </div>
                  ) : (
                    <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
                      <div className="hidden sm:grid grid-cols-[24px_1fr_110px_150px_80px] gap-2 px-3 py-2 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        <span></span>
                        <span>Sub-service</span>
                        <span>Price (₹)</span>
                        <span>ETA</span>
                        <span className="text-right">Remove</span>
                      </div>
                      {serviceForm.includedServices.map((draft, idx) => (
                        <div
                          key={draft.id || `row-${idx}`}
                          className={`grid grid-cols-1 sm:grid-cols-[24px_1fr_110px_150px_80px] gap-2 px-3 py-2 items-center ${
                            draft.active ? '' : 'opacity-60'
                          }`}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={draft.active}
                              onChange={(e) => updateSubServiceDraft(idx, { active: e.target.checked })}
                              title={draft.active ? 'Active – visible to customers' : 'Inactive – hidden from customers'}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(e) => updateSubServiceDraft(idx, { name: e.target.value })}
                            placeholder="Sub-service name"
                            className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <input
                            type="number"
                            min="0"
                            value={draft.priceText}
                            onChange={(e) => updateSubServiceDraft(idx, { priceText: e.target.value })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums"
                          />
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={draft.etaText}
                              onChange={(e) => updateSubServiceDraft(idx, { etaText: e.target.value })}
                              placeholder={draft.etaUnit === 'day' ? '1' : draft.etaUnit === 'hr' ? '2' : '30'}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tabular-nums"
                            />
                            <select
                              value={draft.etaUnit || 'min'}
                              onChange={(e) =>
                                updateSubServiceDraft(idx, { etaUnit: e.target.value as EtaUnit })
                              }
                              className="px-1.5 py-1.5 rounded-md border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              aria-label="ETA unit"
                            >
                              <option value="min">min</option>
                              <option value="hr">hr</option>
                              <option value="day">day</option>
                            </select>
                          </div>
                          <div className="flex sm:justify-end">
                            <button
                              type="button"
                              onClick={() => removeSubServiceDraft(idx)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              title="Remove this sub-service"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      {subServiceTotal > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-xs text-gray-700">
                          <span>Sum of active sub-service prices</span>
                          <span className="font-semibold tabular-nums">
                            ₹{subServiceTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serviceForm.active}
                      onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Active (visible to customers)
                  </label>
                  <div className="flex items-center gap-2">
                    {editingServiceType && (
                      <button
                        type="button"
                        onClick={clearServiceForm}
                        className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={upsertService}
                      disabled={savingService}
                      className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {savingService
                        ? 'Saving…'
                        : editingServiceType
                        ? 'Update service'
                        : 'Save service'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Your services
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({filteredProviderServices.length})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Search…"
                      aria-label="Search services"
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-sm w-full sm:w-40 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                    <select
                      value={serviceStatusFilter}
                      onChange={(e) => setServiceStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                      aria-label="Filter services by status"
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-sm bg-white flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Service</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Price</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">ETA</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Included</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Updated</th>
                  <th className="py-2.5 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                  <th className="py-2.5 px-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {servicesLoading ? (
                  <tr>
                    <td className="py-8 px-4 text-center text-gray-500" colSpan={8}>
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      Loading services...
                      </div>
                    </td>
                  </tr>
                ) : filteredProviderServices.length === 0 ? (
                  <tr>
                    <td className="py-12 px-4 text-center" colSpan={8}>
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700">No services added yet</p>
                        <p className="text-xs text-gray-500 mt-1">Add your first service using the form above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProviderServices.map((svc) => (
                    <tr key={svc.serviceType} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{svc.serviceType}</td>
                      <td className="py-3 px-4 text-gray-800 tabular-nums">{svc.price !== undefined && svc.price !== null ? `₹${svc.price.toLocaleString('en-IN')}` : <span className="text-gray-400 italic">NA</span>}</td>
                      <td className="py-3 px-4 text-gray-700 tabular-nums">{svc.etaMinutes ? formatEtaReadable(svc.etaMinutes) : <span className="text-gray-400 italic">NA</span>}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{svc.description && svc.description.trim() ? svc.description : <span className="text-gray-400 italic">NA</span>}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {svc.includedServices && svc.includedServices.length > 0 ? (
                          (() => {
                            const actives = svc.includedServices.filter((line) => line.active !== false);
                            const priced = actives.filter(
                              (line) => line.price != null && Number.isFinite(line.price) && (line.price as number) > 0,
                            ).length;
                            return (
                              <span title={`${priced} priced / ${actives.length} active`}>
                                {actives.length} active · {priced} priced
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400 italic">NA</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">{svc.updatedAt ? formatDateTime(svc.updatedAt) : <span className="text-gray-400 italic">NA</span>}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleServiceActive(svc.serviceType, !(svc.active !== false))}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            svc.active !== false
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${svc.active !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {svc.active !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditService(svc)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteService(svc.serviceType)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </section>
          )}

          {/* Open Requests Tab */}
          {activeTab === 'open' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-gray-900">Open requests</h2>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="hidden sm:inline">
                      <span className="font-semibold text-gray-900">{openRequestInsights.total}</span> total
                      {openRequestInsights.strongMatches > 0 && (
                        <> · <span className="font-semibold text-emerald-700">{openRequestInsights.strongMatches}</span> strong match{openRequestInsights.strongMatches === 1 ? '' : 'es'}</>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={fetchOpenRequests}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <svg className={`h-3.5 w-3.5 ${openLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Jobs you can claim · last refreshed {lastOpenRefreshAt ? formatRelative(lastOpenRefreshAt) : 'not yet'}
                  {refreshNotice && <span className="ml-2 text-emerald-700 font-medium">· {refreshNotice}</span>}
                </p>
              </div>

              {(() => {
                // Build city suggestions from currently-loaded open requests plus
                // the provider's own city so the dropdown always has something useful.
                const seen = new Set<string>();
                const citySuggestions: string[] = [];
                const pushCity = (c?: string) => {
                  const trimmed = (c || '').trim();
                  if (!trimmed) return;
                  const key = trimmed.toLowerCase();
                  if (key === 'pending setup' || seen.has(key)) return;
                  seen.add(key);
                  citySuggestions.push(trimmed);
                };
                pushCity(localProvider?.city);
                openRequests.forEach((req) => pushCity(req.city));
                citySuggestions.sort((a, b) => a.localeCompare(b));

                const applyFilterChange = (patch: Partial<typeof openFilters>) => {
                  setOpenFilters((prev) => ({ ...prev, ...patch }));
                };
                // Auto-refresh on discrete filter changes (select / checkbox).
                // The city text input debounces via the Apply button below.
                const onServiceTypeChange = (v: string) => {
                  applyFilterChange({ serviceType: v });
                  window.setTimeout(fetchOpenRequests, 0);
                };
                const onLast24hChange = (v: boolean) => {
                  applyFilterChange({ last24h: v });
                  window.setTimeout(fetchOpenRequests, 0);
                };
                const onCitySelect = (v: string) => {
                  applyFilterChange({ city: v });
                  window.setTimeout(fetchOpenRequests, 0);
                };

                const hasAnyFilter =
                  !!openFilters.city || openFilters.serviceType !== 'all' || openFilters.last24h;

                return (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                    {/* City — text input + datalist so it's searchable AND a dropdown */}
                    <div className="relative flex-1 min-w-[180px]">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        type="text"
                        list="open-city-suggestions"
                        value={openFilters.city}
                        onChange={(e) => applyFilterChange({ city: e.target.value })}
                        onBlur={fetchOpenRequests}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            fetchOpenRequests();
                          }
                        }}
                        placeholder="Any city — type or choose"
                        className="w-full pl-8 pr-8 py-1.5 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <datalist id="open-city-suggestions">
                        {citySuggestions.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    {/* Quick city chips — fastest way to pick from known cities */}
                    {citySuggestions.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {citySuggestions.slice(0, 3).map((c) => {
                          const selected = openFilters.city.trim().toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => onCitySelect(selected ? '' : c)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                                selected
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <select
                      value={openFilters.serviceType}
                      onChange={(e) => onServiceTypeChange(e.target.value)}
                      className="px-3 py-1.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All services</option>
                      {serviceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={openFilters.last24h}
                        onChange={(e) => onLast24hChange(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Last 24h
                    </label>
                    {hasAnyFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenFilters({ city: '', serviceType: 'all', last24h: false });
                          window.setTimeout(fetchOpenRequests, 0);
                        }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={fetchOpenRequests}
                      className="ml-auto px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 inline-flex items-center gap-1.5"
                    >
                      <svg className={`w-3.5 h-3.5 ${openLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {openLoading ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                );
              })()}

              {!providerSetupReady && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Add your city and at least one active service to receive better matches.</span>
                </div>
              )}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          <div className="space-y-4">
            {openLoading ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Loading open requests...</span>
                </div>
              </div>
            ) : enrichedOpenRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">No open requests right now</p>
                  <p className="text-xs text-gray-500 mb-4">Try clearing filters or check back soon.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenFilters({ city: '', serviceType: 'all', last24h: false })}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Clear filters
                    </button>
                    <button
                      type="button"
                      onClick={loadSampleOpenRequests}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline"
                    >
                      Load sample requests
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              enrichedOpenRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Raised {formatRelative(req.createdAt)} · {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => claimRequest(req.id)}
                      disabled={claimingId === req.id}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {claimingId === req.id ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Claiming...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Claim
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {req.serviceType || 'General'}
                    </span>
                    {req._matchReasons.includes('city_match') && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        City match
                      </span>
                    )}
                    {req._matchReasons.includes('service_match') && (
                      <span className="rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                        Service match
                      </span>
                    )}
                    {req._matchReasons.includes('new_request') && (
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                        New request
                      </span>
                    )}
                    <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      Score {req._matchScore}
                    </span>
                    {req.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {req.city}
                      </span>
                    )}
                    {normalizeVehicleText(req.vehicle) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {normalizeVehicleText(req.vehicle)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                      <ServiceRequestPackages services={req.services} total={req.total} />
                      {req.notes && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="flex items-start gap-2 text-xs font-medium text-amber-800">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Notes: {req.notes}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer & Visit Details</p>
                      <div className="space-y-2">
                        {formatSlaRemaining(req.createdAt) && (
                          <p className="text-xs font-semibold text-amber-700">Claim window: {formatSlaRemaining(req.createdAt)}</p>
                        )}
                        {req.customerName && (
                          <p className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                          </p>
                        )}
                        {req.customerPhone && <p className="text-xs text-gray-600">Phone: {req.customerPhone}</p>}
                        {req.customerEmail && <p className="text-xs text-gray-600">Email: {req.customerEmail}</p>}
                        {req.addressLine && (
                          <p className="flex items-start gap-2 text-xs text-gray-600">
                            <svg className="mt-0.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{req.addressLine}{req.pincode ? `, ${req.pincode}` : ''}</span>
                          </p>
                        )}
                        {normalizeVehicleText(req.carDetails) && (
                          <p className="text-xs text-gray-600">Vehicle: {normalizeVehicleText(req.carDetails)}</p>
                        )}
                        {req.scheduledAt && (
                          <p className="text-xs text-gray-600">Scheduled: {formatDateTime(req.scheduledAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
          )}

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">My requests</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {myRequestStats.total} total
                    {myRequestStats.inProgress > 0 && <> · <span className="text-amber-700 font-medium">{myRequestStats.inProgress} in progress</span></>}
                    {myRequestStats.overdue > 0 && <> · <span className="text-red-700 font-medium">{myRequestStats.overdue} overdue</span></>}
                  </p>
                </div>
              </div>

              <div className="sticky top-16 z-10 mb-5 -mx-5 px-5 py-3 bg-white border-b border-gray-100">
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: 'All', count: myRequestStats.total },
                    { key: 'accepted', label: 'Accepted', count: myRequestStats.accepted },
                    { key: 'in_progress', label: 'In progress', count: myRequestStats.inProgress },
                    { key: 'completed', label: 'Completed', count: myRequestStats.completed },
                    { key: 'cancelled', label: 'Cancelled', count: myRequestStats.cancelled },
                    { key: 'due_today', label: 'Due today', count: myRequestStats.dueToday },
                    { key: 'overdue', label: 'Overdue', count: myRequestStats.overdue },
                  ].map((status) => {
                    const isActive = statusFilter === status.key;
                    return (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => setStatusFilter(status.key as RequestStatus | 'all' | 'due_today' | 'overdue')}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status.label}
                        <span
                          className={`tabular-nums ${
                            isActive ? 'text-white/80' : 'text-gray-500'
                          }`}
                        >
                          {status.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center gap-3 text-gray-600">
                  <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-medium">Loading requests...</span>
                </div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    {statusFilter === 'all'
                      ? 'No requests yet'
                      : statusFilter === 'due_today'
                      ? 'No requests due today'
                      : statusFilter === 'overdue'
                      ? 'No overdue requests'
                      : `No ${String(statusFilter).replace('_', ' ')} requests`}
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    {statusFilter === 'all'
                      ? 'Claim requests from the open pool to get started.'
                      : 'Try another filter or view all requests.'}
                  </p>
                  <div className="flex items-center gap-2">
                    {statusFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View all
                      </button>
                    )}
                    {statusFilter === 'all' && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('open')}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Browse open requests
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={loadSampleMyRequests}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                    >
                      Load samples
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-bold text-gray-900">{req.title}</h3>
                        <span className={statusBadge(req.status)}>
                          {statusOptions.find((s) => s.value === req.status)?.label || req.status}
                        </span>
                        {isOverdueRequest(req) && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Created {formatRelative(req.createdAt)} {req.createdAt ? `(${formatDateTime(req.createdAt)})` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status !== 'cancelled' && req.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              req.id,
                              req.status === 'accepted'
                                ? 'in_progress'
                                : req.status === 'in_progress'
                                ? 'completed'
                                : req.status
                            )
                          }
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          {req.status === 'accepted' ? 'Start job' : 'Mark complete'}
                        </button>
                      )}
                      {req.status === 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => deleteCancelledRequest(req.id)}
                          disabled={deletingId === req.id}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingId === req.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                      {req.status !== 'completed' && req.status !== 'cancelled' && (
                        <select
                          value={req.status}
                          onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                          disabled={deletingId === req.id}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                          {(req.status === 'accepted'
                            ? statusOptions.filter((opt) => ['accepted', 'in_progress'].includes(opt.value))
                            : statusOptions.filter((opt) => ['in_progress', 'completed'].includes(opt.value))
                          ).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                      {req.serviceType || 'General'}
                    </span>
                    {req.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {req.city}
                      </span>
                    )}
                    {normalizeVehicleText(req.vehicle) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {normalizeVehicleText(req.vehicle)}
                      </span>
                    )}
                    {req.scheduledAt && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        Scheduled {formatDateTime(req.scheduledAt)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                      <ServiceRequestPackages services={req.services} total={req.total} />
                      {req.notes && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                          <p className="flex items-start gap-2 text-xs font-medium text-amber-800">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Notes: {req.notes}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer Details</p>
                      <div className="space-y-2">
                        {req.customerName && (
                          <p className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="font-medium">{req.customerName}</span>
                          </p>
                        )}
                        {req.customerPhone && <p className="text-xs text-gray-600">Phone: {req.customerPhone}</p>}
                        {req.customerEmail && <p className="text-xs text-gray-600">Email: {req.customerEmail}</p>}
                        {req.addressLine && (
                          <p className="text-xs text-gray-600">
                            Address: {req.addressLine}
                            {req.pincode ? `, ${req.pincode}` : ''}
                          </p>
                        )}
                        {normalizeVehicleText(req.carDetails) && (
                          <p className="text-xs text-gray-600">Vehicle: {normalizeVehicleText(req.carDetails)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default CarServiceDashboard;


