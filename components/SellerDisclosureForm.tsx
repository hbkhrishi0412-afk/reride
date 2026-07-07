/**
 * Universal Vehicle Listing Checklist — seller form (Core + category add-on).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { VehicleCategory } from '../vehicle-category';
import {
  groupBySection,
  getSellerDefinitions,
  type ChecklistItemResponse,
  type UniversalSellerChecklist,
} from '../lib/universalChecklist';
import {
  finalizeSellerChecklist,
  isSellerItemComplete,
  mergeSellerResponses,
  sellerItemNeedsPhotoUpload,
} from '../lib/universalChecklist/helpers';
import type { VahanSnapshot } from '../lib/vehicleDisclosureChecklist';
import { uploadImages, validateImageFile } from '../services/imageUploadService';

export interface VahanVerifyFeedback {
  verified: boolean;
  message?: string;
}

interface SellerDisclosureFormProps {
  category: VehicleCategory;
  value?: UniversalSellerChecklist | null;
  onChange: (checklist: UniversalSellerChecklist) => void;
  sellerEmail?: string;
  onVerifyVahan?: (registrationNumber: string) => Promise<VahanVerifyFeedback | void>;
  registrationNumber?: string;
  vahanVerified?: boolean;
  vahanSnapshot?: VahanSnapshot | null;
  compact?: boolean;
  /** Hide the inner heading when a parent fieldset already provides the section title. */
  hideTitle?: boolean;
}

export const SellerDisclosureForm: React.FC<SellerDisclosureFormProps> = ({
  category,
  value,
  onChange,
  sellerEmail,
  onVerifyVahan,
  registrationNumber,
  vahanVerified,
  vahanSnapshot,
  compact = false,
  hideTitle = false,
}) => {
  const [items, setItems] = useState<ChecklistItemResponse[]>(() =>
    mergeSellerResponses(category, value),
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [regInput, setRegInput] = useState(registrationNumber || '');
  const [verifying, setVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<VahanVerifyFeedback | null>(null);
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

  const handleNotesChange = (id: string, notes: string) => {
    updateItem(id, {
      notes,
      status: notes.trim() ? 'pass' : '',
    });
  };

  const handleMarkNotApplicable = (id: string) => {
    updateItem(id, { status: 'na', notes: '', photoUrl: '' });
  };

  const handleClearPhoto = (id: string) => {
    updateItem(id, { photoUrl: '', status: '' });
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
      if (results[0]?.url) {
        updateItem(id, { photoUrl: results[0].url, status: 'pass' });
      }
    } catch {
      alert('Failed to upload photo');
    } finally {
      setUploadingId(null);
    }
  };

  const completed = items.filter((i) => {
    const def = defsById.get(i.id);
    return def ? isSellerItemComplete(def, i) : false;
  }).length;
  const total = getSellerDefinitions(category).length;
  const tier = finalizeSellerChecklist(category, items).listingTier;

  return (
    <div className={`rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {!hideTitle && (
            <h3 className="font-bold text-gray-900 text-base">Inspection & trust checklist</h3>
          )}
          <p className={`text-xs text-gray-600 ${hideTitle ? '' : 'mt-0.5'}`}>
            Upload photos or enter details for each item below to create a trustworthy listing.
          </p>
          <p className="text-xs text-emerald-800 mt-1 font-medium">
            RC, insurance, PUC, and checklist photos sync to your listing gallery automatically.
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
                  const result = await onVerifyVahan(regInput.trim());
                  if (result) {
                    setVerifyFeedback(result);
                  }
                } finally {
                  setVerifying(false);
                }
              }}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white disabled:opacity-50"
            >
              {verifying ? '…' : vahanVerified ? 'Re-verify' : 'Verify'}
            </button>
          </div>
          {verifyFeedback && (
            <p
              className={`text-xs mt-2 ${
                verifyFeedback.verified ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {verifyFeedback.message}
            </p>
          )}
          {vahanSnapshot && (
            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wide">
                  {vahanVerified && vahanSnapshot.source === 'surepass'
                    ? '✓ Vahan Verified'
                    : 'RC Details (not verified)'}
                </span>
                {vahanSnapshot.source === 'surepass' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                    Govt. records
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {vahanSnapshot.registrationNumber && (
                  <div>
                    <dt className="text-gray-500">Registration</dt>
                    <dd className="font-semibold text-gray-900 uppercase">{vahanSnapshot.registrationNumber}</dd>
                  </div>
                )}
                {vahanSnapshot.ownerName && (
                  <div>
                    <dt className="text-gray-500">Owner</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.ownerName}</dd>
                  </div>
                )}
                {vahanSnapshot.manufacturer && (
                  <div>
                    <dt className="text-gray-500">Make</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.manufacturer}</dd>
                  </div>
                )}
                {vahanSnapshot.model && (
                  <div>
                    <dt className="text-gray-500">Model</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.model}</dd>
                  </div>
                )}
                {vahanSnapshot.fuelType && (
                  <div>
                    <dt className="text-gray-500">Fuel</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.fuelType}</dd>
                  </div>
                )}
                {vahanSnapshot.engineNumber && (
                  <div>
                    <dt className="text-gray-500">Engine No.</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{vahanSnapshot.engineNumber}</dd>
                  </div>
                )}
                {vahanSnapshot.chassisNumber && (
                  <div>
                    <dt className="text-gray-500">Chassis No.</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{vahanSnapshot.chassisNumber}</dd>
                  </div>
                )}
                {vahanSnapshot.ownerCount != null && (
                  <div>
                    <dt className="text-gray-500">Owners</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.ownerCount}</dd>
                  </div>
                )}
                {vahanSnapshot.registrationDate && (
                  <div>
                    <dt className="text-gray-500">Reg. Date</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.registrationDate}</dd>
                  </div>
                )}
                {vahanSnapshot.fitnessUpto && (
                  <div>
                    <dt className="text-gray-500">Fitness upto</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.fitnessUpto}</dd>
                  </div>
                )}
                {vahanSnapshot.insuranceUpto && (
                  <div>
                    <dt className="text-gray-500">Insurance upto</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.insuranceUpto}</dd>
                  </div>
                )}
                {vahanSnapshot.rtoCode && (
                  <div>
                    <dt className="text-gray-500">RTO</dt>
                    <dd className="font-semibold text-gray-900">{vahanSnapshot.rtoCode}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Hypothecation</dt>
                  <dd className="font-semibold text-gray-900">
                    {vahanSnapshot.hypothecation
                      ? vahanSnapshot.hypothecationBank || 'Yes'
                      : 'None'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
        {sections.map((section) => {
          const isOpen = openSections[section.sectionId] ?? section.sectionId.startsWith('core');
          const sectionDone = section.items.filter((def) => {
            const it = items.find((i) => i.id === def.id);
            return isSellerItemComplete(def, it);
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
                    const done = isSellerItemComplete(def, item);
                    const needsPhoto = sellerItemNeedsPhotoUpload(def);
                    const isNa = item.status === 'na';

                    return (
                      <div
                        key={def.id}
                        className={`rounded-lg border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'}`}
                      >
                        <p className="text-xs font-medium text-gray-900 mb-2 leading-snug">{def.label}</p>

                        {isNa ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500 italic">Marked as not applicable</span>
                            <button
                              type="button"
                              onClick={() => updateItem(def.id, { status: '', notes: '', photoUrl: '' })}
                              className="text-xs font-semibold text-emerald-700 underline"
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <>
                            {needsPhoto && (
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                {item.photoUrl ? (
                                  <>
                                    <img
                                      src={item.photoUrl}
                                      alt=""
                                      className="w-14 h-14 rounded-lg object-cover border"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleClearPhoto(def.id)}
                                      className="text-xs font-semibold text-red-600 underline"
                                    >
                                      Remove photo
                                    </button>
                                  </>
                                ) : (
                                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 active:scale-[0.98]">
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
                                    {uploadingId === def.id ? 'Uploading…' : 'Upload photo'}
                                  </label>
                                )}
                                {def.photoRequired === 'if_applicable' && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkNotApplicable(def.id)}
                                    className="text-xs text-gray-500 underline"
                                  >
                                    Not applicable
                                  </button>
                                )}
                              </div>
                            )}

                            {!needsPhoto && (
                              <input
                                type="text"
                                value={item.notes || ''}
                                onChange={(e) => handleNotesChange(def.id, e.target.value)}
                                placeholder="Enter details"
                                className="w-full px-2.5 py-2 text-xs border rounded-md"
                              />
                            )}

                            {needsPhoto && def.photoRequired === true && !item.photoUrl && (
                              <p className="text-[11px] text-gray-500 mt-1">Photo required</p>
                            )}
                          </>
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
