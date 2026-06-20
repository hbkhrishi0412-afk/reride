/**
 * Buyer verification checklist — same Universal Checklist (B / S/B / B/P items).
 */
import React, { useMemo, useState } from 'react';
import { VehicleCategory } from '../vehicle-category';
import {
  groupBySection,
  getBuyerDefinitions,
  type ChecklistItemStatus,
  type UniversalSellerChecklist,
  type BuyerInspectionItem,
} from '../lib/universalChecklist';
import { mergeBuyerResponses } from '../lib/universalChecklist/helpers';
import { submitBuyerInspection } from '../services/vehicleTrustService';
import { uploadImages, validateImageFile } from '../services/imageUploadService';

const STATUS_OPTIONS: { value: ChecklistItemStatus; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
];

interface BuyerInspectionFormProps {
  vehicleId: number | string;
  category: VehicleCategory;
  sellerChecklist?: UniversalSellerChecklist | null;
  buyerEmail?: string;
  onSubmitted?: (flaggedCount: number) => void;
  onRequireLogin?: () => void;
}

export const BuyerInspectionForm: React.FC<BuyerInspectionFormProps> = ({
  vehicleId,
  category,
  sellerChecklist,
  buyerEmail,
  onSubmitted,
  onRequireLogin,
}) => {
  const [items, setItems] = useState<BuyerInspectionItem[]>(() =>
    mergeBuyerResponses(category, sellerChecklist),
  );
  const [generalNotes, setGeneralNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ 'core.docs': true });

  const sections = useMemo(() => groupBySection(getBuyerDefinitions(category)), [category]);

  if (!buyerEmail) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-amber-900 font-medium">Log in to verify this vehicle in person</p>
        {onRequireLogin && (
          <button type="button" onClick={onRequireLogin} className="mt-2 text-sm font-semibold text-reride-orange underline">
            Log in
          </button>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">Inspection saved</p>
        {flaggedCount > 0 ? (
          <p className="text-xs text-amber-700 mt-1">
            {flaggedCount} item(s) flagged vs seller disclosure — seller trust updated.
          </p>
        ) : (
          <p className="text-xs text-emerald-700 mt-1">No discrepancies flagged.</p>
        )}
      </div>
    );
  }

  const updateItem = (id: string, patch: Partial<BuyerInspectionItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const handlePhoto = async (id: string, file: File) => {
    const v = validateImageFile(file);
    if (!v.valid) {
      alert(v.error);
      return;
    }
    setUploadingId(id);
    try {
      const res = await uploadImages([file], 'vehicles', buyerEmail);
      if (res[0]?.url) updateItem(id, { photoUrl: res[0].url });
    } finally {
      setUploadingId(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await submitBuyerInspection(vehicleId, items, generalNotes, category);
      setFlaggedCount(result.flaggedCount);
      setDone(true);
      onSubmitted?.(result.flaggedCount);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save inspection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div>
        <h3 className="font-bold text-gray-900">Buyer verification checklist</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Same Universal Checklist — verify in person before you buy. Flag anything the seller did not disclose.
        </p>
      </div>

      <div className="space-y-2 max-h-[min(60vh,520px)] overflow-y-auto">
        {sections.map((section) => {
          const isOpen = openSections[section.sectionId] ?? false;
          return (
            <div key={section.sectionId} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-semibold bg-gray-50 flex justify-between"
                onClick={() =>
                  setOpenSections((p) => ({ ...p, [section.sectionId]: !isOpen }))
                }
              >
                {section.sectionTitle}
                <span>{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="p-2 space-y-2">
                  {section.items.map((def) => {
                    const item = items.find((i) => i.id === def.id)!;
                    const sellerItem = sellerChecklist?.items.find((s) => s.id === def.id);
                    return (
                      <div key={def.id} className="border border-gray-100 rounded-lg p-2">
                        <div className="flex justify-between gap-2 mb-1">
                          <p className="text-xs font-medium text-gray-900">{def.label}</p>
                          <label className="flex items-center gap-1 text-[10px] shrink-0">
                            <input
                              type="checkbox"
                              checked={item.matchesSellerClaim}
                              onChange={(e) =>
                                updateItem(def.id, { matchesSellerClaim: e.target.checked })
                              }
                            />
                            Matches seller
                          </label>
                        </div>
                        {def.buyerHint && (
                          <p className="text-[10px] text-gray-500 mb-1">{def.buyerHint}</p>
                        )}
                        {sellerItem?.status && (
                          <p className="text-[10px] text-gray-600 mb-1 bg-gray-50 px-1.5 py-0.5 rounded">
                            Seller: <strong className="uppercase">{sellerItem.status}</strong>
                            {sellerItem.notes ? ` — ${sellerItem.notes}` : ''}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateItem(def.id, { status: opt.value })}
                              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                item.status === opt.value
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white border-gray-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItem(def.id, { notes: e.target.value })}
                          placeholder="Your notes"
                          className="w-full text-xs border rounded px-2 py-1 mb-1"
                        />
                        <label className="text-[10px] cursor-pointer text-blue-600">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingId === def.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handlePhoto(def.id, f);
                              e.target.value = '';
                            }}
                          />
                          {uploadingId === def.id ? 'Uploading…' : item.photoUrl ? '📷 Photo added' : '+ Photo'}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <textarea
        value={generalNotes}
        onChange={(e) => setGeneralNotes(e.target.value)}
        placeholder="Overall notes or non-disclosure details…"
        rows={2}
        className="w-full px-3 py-2 text-sm border rounded-lg"
      />

      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="w-full py-2.5 rounded-xl bg-reride-orange text-white font-semibold text-sm disabled:opacity-50"
      >
        {submitting ? 'Saving…' : 'Save verification & flag discrepancies'}
      </button>
    </div>
  );
};

export default BuyerInspectionForm;
