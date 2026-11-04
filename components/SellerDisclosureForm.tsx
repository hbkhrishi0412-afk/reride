/**
 * Universal Vehicle Listing Checklist — seller form (3 clear steps, same fields).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VehicleCategory } from '../vehicle-category';
import {
  groupSellerFormSteps,
  getSellerDefinitions,
  type ChecklistItemResponse,
  type UniversalChecklistItemDef,
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
import { useApp } from './AppProvider';

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

function shortLabel(label: string): string {
  return label.length > 42 ? `${label.slice(0, 40)}…` : label;
}

function checklistAnswersKey(
  category: VehicleCategory,
  checklist?: UniversalSellerChecklist | null,
): string {
  return `${category}:${(checklist?.items ?? [])
    .map((i) => `${i.id}:${i.status}:${i.notes ?? ''}:${i.photoUrl ?? ''}`)
    .join('|')}`;
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
  const { addToast } = useApp();
  const [items, setItems] = useState<ChecklistItemResponse[]>(() =>
    mergeSellerResponses(category, value),
  );
  const valueKey = checklistAnswersKey(category, value);
  // Sync when parent checklist answers change (load/edit), without fighting local clicks.
  useEffect(() => {
    setItems(mergeSellerResponses(category, value));
  }, [category, valueKey]); // eslint-disable-line react-hooks/exhaustive-deps -- valueKey fingerprints value
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [regInput, setRegInput] = useState(registrationNumber || '');
  const [verifying, setVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<VahanVerifyFeedback | null>(null);

  const steps = useMemo(() => groupSellerFormSteps(category), [category]);
  const defsById = useMemo(() => {
    const m = new Map<string, UniversalChecklistItemDef>();
    getSellerDefinitions(category).forEach((d) => m.set(d.id, d));
    return m;
  }, [category]);

  const stepProgress = useMemo(
    () =>
      steps.map((step) => {
        const done = step.items.filter((def) => {
          const it = items.find((i) => i.id === def.id);
          return isSellerItemComplete(def, it);
        }).length;
        return { id: step.id, done, total: step.items.length, complete: done === step.items.length };
      }),
    [steps, items],
  );

  const firstIncomplete = stepProgress.find((s) => !s.complete)?.id ?? steps[0]?.id ?? 'docs';
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const openStepId = activeStep ?? firstIncomplete;

  const updateItem = useCallback(
    (id: string, patch: Partial<ChecklistItemResponse>) => {
      // Pin the open step so completing the last answer doesn't jump the UI away.
      setActiveStep((s) => s ?? openStepId);
      const base = mergeSellerResponses(category, {
        version: '1.0',
        category,
        items,
      });
      const next = base.map((i) => (i.id === id ? { ...i, ...patch } : i));
      setItems(next);
      onChange(finalizeSellerChecklist(category, next));
    },
    [category, items, onChange, openStepId],
  );

  const handleNotesChange = (id: string, notes: string) => {
    updateItem(id, {
      notes,
      status: notes.trim() ? 'pass' : '',
    });
  };

  const handleYesNo = (id: string, yes: boolean) => {
    updateItem(id, {
      status: yes ? 'pass' : 'fail',
      notes: yes ? 'Yes' : 'No',
    });
  };

  const isYesNoItem = (def: UniversalChecklistItemDef) =>
    def.answerType === 'yes_no' || def.label.trimEnd().endsWith('?');

  const handleMarkNotApplicable = (id: string) => {
    updateItem(id, { status: 'na', notes: '', photoUrl: '' });
  };

  const handleClearPhoto = (id: string) => {
    updateItem(id, { photoUrl: '', status: '' });
  };

  const handlePhotoUpload = async (id: string, file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      addToast(validation.error || 'Invalid image', 'error');
      return;
    }
    setUploadingId(id);
    try {
      const results = await uploadImages([file], 'vehicles', sellerEmail);
      if (results[0]?.url) {
        updateItem(id, { photoUrl: results[0].url, status: 'pass' });
      }
    } catch {
      addToast('Failed to upload photo', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const completed = items.filter((i) => {
    const def = defsById.get(i.id);
    return def ? isSellerItemComplete(def, i) : false;
  }).length;
  const total = getSellerDefinitions(category).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const tier = finalizeSellerChecklist(category, items).listingTier;

  const renderItem = (def: UniversalChecklistItemDef, photoTile = false) => {
    const item = items.find((i) => i.id === def.id) ?? {
      id: def.id,
      status: '' as const,
      notes: '',
      photoUrl: '',
    };
    const done = isSellerItemComplete(def, item);
    const needsPhoto = sellerItemNeedsPhotoUpload(def);
    const isNa = item.status === 'na';
    const yesNo = !needsPhoto && isYesNoItem(def);

    if (photoTile && needsPhoto) {
      return (
        <div
          key={def.id}
          className={`flex min-h-[6.5rem] flex-col gap-1 rounded-lg border p-1.5 ${
            done ? 'border-emerald-300 bg-emerald-50/40' : 'border-stone-200 bg-white'
          }`}
        >
          <p className="text-[11px] font-semibold leading-snug text-stone-800">{shortLabel(def.label)}</p>
          {isNa ? (
            <div className="mt-auto flex items-center justify-between gap-1">
              <span className="text-[10px] text-gray-500 italic">N/A</span>
              <button
                type="button"
                onClick={() => updateItem(def.id, { status: '', notes: '', photoUrl: '' })}
                className="text-[10px] font-semibold text-emerald-700 underline"
              >
                Undo
              </button>
            </div>
          ) : item.photoUrl ? (
            <div className="mt-auto relative">
              <img src={item.photoUrl} alt="" className="w-full h-16 rounded-lg object-cover border" />
              <button
                type="button"
                onClick={() => handleClearPhoto(def.id)}
                className="absolute top-1 right-1 text-[10px] font-semibold bg-white/90 px-1.5 py-0.5 rounded text-red-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-auto flex flex-col gap-1">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-emerald-400 bg-emerald-50/80 px-2 py-2.5 text-[11px] font-semibold text-emerald-800 active:scale-[0.98]">
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
                {uploadingId === def.id ? 'Uploading…' : 'Upload'}
              </label>
              {def.photoRequired === 'if_applicable' && (
                <button
                  type="button"
                  onClick={() => handleMarkNotApplicable(def.id)}
                  className="self-start text-[10px] font-semibold text-stone-600 underline"
                >
                  Not applicable
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={def.id}
        className={`rounded-lg border p-2.5 ${done ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 bg-white'}`}
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

            {!needsPhoto && yesNo && (
              <div className="flex items-center gap-2" role="group" aria-label={def.label}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleYesNo(def.id, true);
                  }}
                  className={`min-w-[4.5rem] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    item.status === 'pass'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleYesNo(def.id, false);
                  }}
                  className={`min-w-[4.5rem] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    item.status === 'fail'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400'
                  }`}
                >
                  No
                </button>
              </div>
            )}

            {!needsPhoto && !yesNo && (
              <input
                type="text"
                value={item.notes || ''}
                onChange={(e) => handleNotesChange(def.id, e.target.value)}
                placeholder="Type a short answer"
                className="w-full px-2.5 py-2 text-xs border rounded-md"
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-2.5">
        {!hideTitle && (
          <h3 className="font-bold text-gray-900 text-base">Inspection & trust checklist</h3>
        )}
        <p className={`text-xs font-medium text-stone-700 ${hideTitle ? '' : 'mt-0.5'}`}>
          Three short steps. Upload where you can, answer where you must — then Save to store progress.
        </p>

        <div className="mt-2 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-white/80 border border-emerald-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-emerald-900 tabular-nums shrink-0">
            {completed}/{total}
          </span>
          <span
            className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
              tier === 'verified'
                ? 'bg-emerald-100 text-emerald-900'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {tier === 'verified' ? 'Full disclosure' : 'In progress'}
          </span>
        </div>
      </div>

      {onVerifyVahan && (
        <div className="mb-2.5 p-2.5 bg-white rounded-xl border border-emerald-100">
          <label className="text-xs font-semibold text-stone-800 block mb-1">
            Quick start — verify RC on VAHAN
          </label>
          <p className="text-[11px] font-medium text-stone-600 mb-1.5">
            Optional. Fills make, owners, insurance dates from govt records.
          </p>
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
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-700 text-white disabled:opacity-50"
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
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  {vahanVerified && vahanSnapshot.source === 'surepass'
                    ? '✓ Vahan Verified'
                    : 'RC Details (not verified)'}
                </span>
                {vahanSnapshot.source === 'surepass' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
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

      {/* Step picker — 3 clear buckets instead of 7 numbered rows */}
      <div className="mb-2.5 grid grid-cols-3 gap-1.5">
        {steps.map((step, idx) => {
          const prog = stepProgress.find((p) => p.id === step.id)!;
          const isOpen = openStepId === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`rounded-lg px-2 py-1.5 text-left border transition-colors ${
                isOpen
                  ? 'bg-white border-emerald-400 shadow-sm'
                  : 'bg-white/60 border-transparent hover:border-emerald-200'
              }`}
            >
              <span className="text-[10px] font-bold text-emerald-800 block">
                Step {idx + 1}
                {prog.complete ? ' · ✓' : ''}
              </span>
              <span className="text-xs font-semibold text-stone-900 block leading-tight">{step.title}</span>
              <span className="text-[10px] font-semibold text-stone-600 tabular-nums">
                {prog.done}/{prog.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[min(70vh,560px)] overflow-y-auto pr-1">
        {steps.map((step) => {
          if (openStepId !== step.id) return null;
          const photoItems = step.items.filter((d) => sellerItemNeedsPhotoUpload(d));
          const textItems = step.items.filter((d) => !sellerItemNeedsPhotoUpload(d));
          const usePhotoGrid = step.id === 'photos' || (step.id === 'docs' && photoItems.length >= 3);

          return (
            <div key={step.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-sm font-semibold text-stone-900">{step.title}</p>
                <p className="mt-0.5 text-[11px] font-medium text-stone-600">{step.subtitle}</p>
              </div>
              <div className="space-y-2.5 p-2.5">
                {usePhotoGrid && photoItems.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-700">
                      Upload
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {photoItems.map((def) => renderItem(def, true))}
                    </div>
                  </div>
                )}

                {!usePhotoGrid && photoItems.length > 0 && (
                  <div className="space-y-1.5">
                    {photoItems.map((def) => renderItem(def, false))}
                  </div>
                )}

                {textItems.length > 0 && (
                  <div>
                    {(usePhotoGrid || photoItems.length > 0 || step.id === 'condition') && (
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-700">
                        {step.id === 'condition' ? 'Condition check' : 'Quick answers'}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {textItems.map((def) => renderItem(def, false))}
                    </div>
                  </div>
                )}

                {stepProgress.findIndex((p) => p.id === step.id) < steps.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = steps[steps.findIndex((s) => s.id === step.id) + 1];
                      if (next) setActiveStep(next.id);
                    }}
                    className="mt-0.5 w-full rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white"
                  >
                    Continue to {steps[steps.findIndex((s) => s.id === step.id) + 1]?.title}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SellerDisclosureForm;
