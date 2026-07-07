export function complaintCategoryLabel(
  categories: readonly { value: string; label: string }[],
  cat: string,
): string {
  return categories.find((c) => c.value === cat)?.label ?? cat.replace(/_/g, ' ');
}

export function complaintStatusColor(
  status: string,
  colors: Record<string, string>,
): string {
  return colors[status] ?? 'bg-slate-100 text-slate-600';
}

export const COMPLAINT_CASE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-purple-100 text-purple-800',
};

export const DEAL_COMPLAINT_STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-slate-100 text-slate-600',
};
