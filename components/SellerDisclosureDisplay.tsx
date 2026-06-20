/**
 * Read-only Universal Checklist disclosure on listing detail.
 */
import React, { useMemo } from 'react';
import { VehicleCategory } from '../vehicle-category';
import { groupBySection, getSellerDefinitions } from '../lib/universalChecklist';
import type { UniversalSellerChecklist, VahanSnapshot } from '../lib/vehicleDisclosureChecklist';
import type { ListingChecklistTier } from '../lib/universalChecklist/types';
import { computeListingTier } from '../lib/universalChecklist/helpers';

interface SellerDisclosureDisplayProps {
  checklist?: UniversalSellerChecklist | null;
  category?: VehicleCategory;
  vahanSnapshot?: VahanSnapshot | null;
}

export const SellerDisclosureDisplay: React.FC<SellerDisclosureDisplayProps> = ({
  checklist,
  category = VehicleCategory.FOUR_WHEELER,
  vahanSnapshot,
}) => {
  const tier: ListingChecklistTier | null = useMemo(() => {
    if (!checklist?.items?.length) return null;
    return checklist.listingTier ?? computeListingTier(checklist, category);
  }, [checklist, category]);

  const sections = useMemo(() => {
    if (!checklist?.items?.length) return [];
    const defs = getSellerDefinitions(category);
    const answered = defs.filter((d) => {
      const it = checklist.items.find((i) => i.id === d.id);
      return it?.status;
    });
    return groupBySection(answered);
  }, [checklist, category]);

  if (!sections.length && !vahanSnapshot) return null;

  return (
    <div className="space-y-4">
      {tier && (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            tier === 'verified'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}
        >
          {tier === 'verified' ? '✓ Verified Listing' : 'Basic Listing — Self Reported'}
        </div>
      )}

      {sections.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <h4 className="font-bold text-gray-900 text-sm mb-3">Seller disclosure (Universal Checklist)</h4>
          {sections.map((section) => (
            <div key={section.sectionId} className="mb-4 last:mb-0">
              <p className="text-xs font-semibold text-gray-700 mb-2">{section.sectionTitle}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.items.map((def) => {
                  const item = checklist!.items.find((i) => i.id === def.id);
                  if (!item?.status) return null;
                  return (
                    <div
                      key={def.id}
                      className="flex gap-2 items-start bg-white rounded-lg p-2 border border-emerald-100"
                    >
                      {item.photoUrl && (
                        <img src={item.photoUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 leading-tight">{def.label}</p>
                        <p
                          className={`text-sm font-bold uppercase ${
                            item.status === 'pass'
                              ? 'text-green-700'
                              : item.status === 'fail'
                                ? 'text-red-700'
                                : 'text-gray-600'
                          }`}
                        >
                          {item.status}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-gray-600 truncate">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {checklist?.completedAt && (
            <p className="text-xs text-gray-500 mt-2">
              Completed {new Date(checklist.completedAt).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>
      )}

      {vahanSnapshot && (
        <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
          <h4 className="font-bold text-gray-900 text-sm mb-2">Government RC data</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {vahanSnapshot.ownerCount != null && (
              <div>
                <dt className="text-gray-500">Owners</dt>
                <dd className="font-medium">{vahanSnapshot.ownerCount}</dd>
              </div>
            )}
            {vahanSnapshot.fitnessUpto && (
              <div>
                <dt className="text-gray-500">Fitness upto</dt>
                <dd className="font-medium">{vahanSnapshot.fitnessUpto}</dd>
              </div>
            )}
            {vahanSnapshot.insuranceUpto && (
              <div>
                <dt className="text-gray-500">Insurance upto</dt>
                <dd className="font-medium">{vahanSnapshot.insuranceUpto}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Hypothecation</dt>
              <dd className="font-medium">
                {vahanSnapshot.hypothecation
                  ? vahanSnapshot.hypothecationBank || 'Yes'
                  : 'None'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
};

export default SellerDisclosureDisplay;
