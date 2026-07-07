import type { ComplaintCase, ComplaintCaseStatus } from '../types.js';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch.js';

export async function createComplaintCase(input: {
  subject: string;
  message: string;
  category: ComplaintCase['category'];
  reporterName?: string;
  dealLeadId?: string;
  vehicleId?: string;
}): Promise<ComplaintCase> {
  const response = await authenticatedFetch('/api/complaints?action=create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = await handleApiResponse<{ complaint?: ComplaintCase }>(response);
  if (!parsed.success || !parsed.data?.complaint) {
    throw new Error(parsed.reason || parsed.error || 'Failed to submit complaint');
  }
  return parsed.data.complaint;
}

export async function fetchComplaintCases(params?: {
  status?: ComplaintCaseStatus;
}): Promise<ComplaintCase[]> {
  const qs = new URLSearchParams({ action: 'list' });
  if (params?.status) qs.set('status', params.status);
  const response = await authenticatedFetch(`/api/complaints?${qs}`, { method: 'GET' });
  const parsed = await handleApiResponse<{ complaints?: ComplaintCase[] }>(response);
  if (!parsed.success) {
    throw new Error(parsed.reason || parsed.error || 'Failed to load complaints');
  }
  return parsed.data?.complaints || [];
}

export async function updateComplaintCase(input: {
  id: string;
  status: ComplaintCaseStatus;
  adminNotes?: string;
  resolution?: string;
}): Promise<ComplaintCase> {
  const response = await authenticatedFetch('/api/complaints?action=update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const parsed = await handleApiResponse<{ complaint?: ComplaintCase }>(response);
  if (!parsed.success || !parsed.data?.complaint) {
    throw new Error(parsed.reason || parsed.error || 'Failed to update complaint');
  }
  return parsed.data.complaint;
}
