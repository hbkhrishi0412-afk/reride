import React from 'react';
import type { DealLead } from '../types';
import { deriveKanbanStatus, dealKanbanLabel, DEAL_KANBAN_COLUMNS } from '../types';

interface DealStageChipProps {
  lead: DealLead;
  className?: string;
}

function leadStatusDisplay(lead: DealLead): { label: string; color: string } {
  if (lead.chatStatus === 'pending') {
    return { label: 'Awaiting accept', color: 'bg-amber-100 text-amber-800' };
  }
  const kanbanStatus = deriveKanbanStatus(lead);
  const column = DEAL_KANBAN_COLUMNS.find((c) => c.status === kanbanStatus);
  return {
    label: dealKanbanLabel(kanbanStatus),
    color: column?.color || 'bg-slate-100 text-slate-700',
  };
}

/** Compact deal status for chat headers and listing cards. */
export const DealStageChip: React.FC<DealStageChipProps> = ({ lead, className = '' }) => {
  const status = leadStatusDisplay(lead);
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 text-[11px] font-semibold ${className}`}
      data-no-translate
    >
      <span className={`rounded-full px-2 py-0.5 ${status.color}`}>{status.label}</span>
    </div>
  );
};

export default DealStageChip;
