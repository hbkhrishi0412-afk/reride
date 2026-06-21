import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import type { BuyerInspectionItem } from '../types.js';

export interface AdminBuyerInspectionRow {
  id: string;
  vehicleId: string;
  buyerEmail: string;
  items: BuyerInspectionItem[];
  flaggedKeys: string[];
  generalNotes: string | null;
  createdAt: string;
  sellerEmail?: string | null;
  disclosureReason?: string | null;
}

export interface AdminBuyerInspectionsResult {
  inspections: AdminBuyerInspectionRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const reason = (data as { reason?: unknown }).reason;
    const message =
      typeof reason === 'string'
        ? reason
        : (data as { message?: string }).message || 'Request failed';
    throw new Error(message);
  }
  if ((data as { success?: boolean }).success === false) {
    const reason = (data as { reason?: unknown }).reason;
    const message =
      typeof reason === 'string'
        ? reason
        : (data as { message?: string }).message || 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export async function fetchAdminBuyerInspections(params?: {
  page?: number;
  limit?: number;
  search?: string;
  flaggedOnly?: boolean;
}): Promise<AdminBuyerInspectionsResult> {
  const qs = new URLSearchParams({ action: 'buyer-inspections' });
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.flaggedOnly) qs.set('flaggedOnly', '1');

  const response = await authenticatedFetch(`/api/admin?${qs.toString()}`);
  const data = await parseJson<{
    success: boolean;
    inspections: AdminBuyerInspectionRow[];
    pagination: AdminBuyerInspectionsResult['pagination'];
  }>(response);

  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const total = data.pagination?.total ?? (data.inspections?.length ?? 0);

  return {
    inspections: data.inspections || [],
    pagination: data.pagination ?? {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
