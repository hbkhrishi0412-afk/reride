/**
 * Universal Vehicle Listing Checklist — seller form (Core + category add-on).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { VehicleCategory } from '../vehicle-category';
import {
  groupBySection,
  getSellerDefinitions,
  type ChecklistItemResponse,
  type ChecklistItemStatus,
  type UniversalSellerChecklist,
} from '../lib/universalChecklist';
import {
  finalizeSellerChecklist,
  mergeSellerResponses,
  photoRequiredForItem,
} from '../lib/universalChecklist/helpers';
import { uploadImages, validateImageFile } from '../services/imageUploadService';

const STATUS_OPTIONS: { value: ChecklistItemStatus; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'na', label: 'N/A' },
];

interface SellerDisclosureFormProps {
  category: VehicleCategory;
  value?: UniversalSellerChecklist | null;
  onChange: (checklist: UniversalSellerChecklist) => void;
  sellerEmail?: string;
  onVerifyVahan?: (registrationNumber: string) => Promise<void>;
  registrationNumber?: string;
  vahanVerified?: boolean;
  compact?: boolean;
}

export const SellerDisclosureForm: React.FC<SellerDisclosureFormProps> = ({
  category,
  value,
  onChange,
  sellerEmail,
  onVerifyVahan,
  registrationNumber,
  vahanVerified,
  compact = false,
}) => {
  const [items, setItems] = useState<ChecklistItemResponse[]>(() =>
    mergeSellerResponses(category, value),
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [regInput, setRegInput] = useState(registrationNumber || '');
  const [verifying, setVerifying] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => groupBySection(getSellerDefinitions(category)), [category]);
  const defsById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof getSellerDefinitions>[0]>();
    getSellerDefinitions(category).forEach((d) => m.set(d.id, d));
    return m;
  }, [category]);

  const emitChange = useCallback(
    (next: ChecklistItemResponse[]) => {
      setItems(next);
      onChange(finalizeSellerChecklist(category, next));
    },
    [category, onChange],
  );

  const updateItem = (id: string, patch: Partial<ChecklistItemResponse>) => {
    emitChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const handlePhotoUpload = async (id: string, file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error || 'Invalid image');
      return;
    }
    setUploadingId(id);
    try {
      const results = await uploadImages([file], 'vehicles', sellerEmail);
      if (results[0]?.url) updateItem(id, { photoUrl: results[0].url });
    } catch {
      alert('Failed to upload photo');
    } finally {
      setUploadingId(null);
    }
  };

  const completed = items.filter((i) => {
    const def = defsById.get(i.id);
    if (!def || !i.status) return false;
    if (photoRequiredForItem(def, i.status) && !i.photoUrl) return false;
    return true;
  }).length;
  const total = getSellerDefinitions(category).length;
  const tier = finalizeSellerChecklist(category, items).listingTier;

  return (
    <div className={`rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Universal Vehicle Listing Checklist</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Core + category add-on · Pass / Fail / N/A · Photo where marked (S)
          </p>
          <p className="text-xs text-emerald-800 mt-1 font-medium">
            §1.3 photos and RC/Insurance/PUC uploads sync to your listing gallery automatically.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-bold bg-white px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 block">
            {completed}/{total}
          </span>
          <span
            className={`text-[10px] font-semibold mt-1 inline-block px-2 py-0.5 rounded-full ${
              tier === 'verified'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {tier === 'verified' ? 'Verified Listing' : 'Basic — Self Reported'}
          </span>
        </div>
      </div>

      {onVerifyVahan && (
        <div className="mb-4 p-3 bg-white rounded-xl border border-purple-100">
          <label className="text-xs font-semibold text-gray-700 block mb-1">RC number (VAHAN verify)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={regInput}
              onChange={(e) => setRegInput(e.target.value.toUpperCase())}
              placeholder="MH12AB1234"
              className="flex-1 px-3 py-2 text-sm border rounded-lg uppercase"
            />
            <button
              type="button"
              disabled={verifying || !regInput.trim()}
              onClick={async () => {
                setVerifying(true);
                try {
                  await onVerifyVahan(regInput.trim());
                } finally {
                  setVerifying(false);
                }
              }}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white disabled:opacity-50"
            >
              {verifying ? '…' : vahanVerified ? 'Re-verify' : 'Verify'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
        {sections.map((section) => {
          const isOpen = openSections[section.sectionId] ?? section.sectionId.startsWith('core');
          const sectionDone = section.items.filter((def) => {
            const it = items.find((i) => i.id === def.id);
            return it?.status && (!photoRequiredForItem(def, it.status) || it.photoUrl);
          }).length;
          return (
            <div key={section.sectionId} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-gray-50 hover:bg-gray-100"
                onClick={() =>
                  setOpenSections((p) => ({ ...p, [section.sectionId]: !isOpen }))
                }
              >
                <span className="text-sm font-semibold text-gray-900">{section.sectionTitle}</span>
                <span className="text-xs text-gray-500">
                  {sectionDone}/{section.items.length} · {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {isOpen && (
                <div className="p-2 space-y-2 border-t border-gray-100">
                  {section.items.map((def) => {
                    const item = items.find((i) => i.id === def.id)!;
                    const needsPhoto = item.status && photoRequiredForItem(def, item.status);
                    const done =
                      Boolean(item.status) && (!needsPhoto || Boolean(item.photoUrl));
                    return (
                      <div
                        key={def.id}
                        className={`rounded-lg border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}
                      >
                        <p className="text-xs font-medium text-gray-900 mb-2 leading-snug">{def.label}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateItem(def.id, { status: opt.value })}
                              className={`px-2 py-1 text-xs rounded-md border font-medium ${
                                item.status === opt.value
                                  ? opt.value === 'pass'
                                    ? 'bg-green-600 text-white border-green-600'
                                    : opt.value === 'fail'
                                      ? 'bg-red-600 text-white border-red-600'
                                      : 'bg-gray-500 text-white border-gray-500'
                                  : 'bg-white text-gray-700 border-gray-300'
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
                          placeholder="Notes (optional)"
                          className="w-full mb-2 px-2 py-1 text-xs border rounded-md"
                        />
                        {(def.photoRequired === true || def.photoRequired === 'if_applicable') && (
                          <div className="flex items-center gap-2">
                            {item.photoUrl ? (
                              <img src={item.photoUrl} alt="" className="w-10 h-10 rounded object-cover border" />
                            ) : null}
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingId === def.id}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handlePhotoUpload(def.id, f);
                                  e.target.value = '';
                                }}
                              />
                              <span className="text-xs font-semibold text-emerald-700 underline">
                                {uploadingId === def.id
                                  ? 'Uploading…'
                                  : needsPhoto
                                    ? item.photoUrl
                                      ? 'Change photo'
                                      : '+ Photo required'
                                    : '+ Add photo (optional until Pass/Fail)'}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SellerDisclosureForm;
