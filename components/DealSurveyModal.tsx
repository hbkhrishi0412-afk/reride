import React, { useState } from 'react';
import { submitDealSurvey } from '../services/dealService.js';
import { DEAL_ASSISTANCE_PACKAGES } from '../types.js';
import { useApp } from './AppProvider';

interface DealSurveyModalProps {
  surveyId: string;
  leadId: string;
  vehicleName?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export const DealSurveyModal: React.FC<DealSurveyModalProps> = ({
  surveyId,
  leadId,
  vehicleName,
  onClose,
  onSubmitted,
}) => {
  const { addToast } = useApp();
  const [step, setStep] = useState<'purchase' | 'services'>('purchase');
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handlePurchaseResponse = async (response: 'yes' | 'no' | 'negotiating') => {
    if (response === 'yes') {
      setStep('services');
      return;
    }
    setLoading(true);
    try {
      await submitDealSurvey(surveyId, response);
      onSubmitted();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to submit', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleServicesSubmit = async () => {
    setLoading(true);
    try {
      await submitDealSurvey(surveyId, 'yes', selectedServices);
      onSubmitted();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to submit', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-brand-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        {step === 'purchase' ? (
          <>
            <h2 className="text-lg font-bold text-reride-text-dark dark:text-white mb-2">
              Quick Check-in
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {vehicleName
                ? `Did you purchase the ${vehicleName}?`
                : 'Did you purchase this vehicle?'}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handlePurchaseResponse('yes')}
                disabled={loading}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                Yes
              </button>
              <button
                onClick={() => handlePurchaseResponse('no')}
                disabled={loading}
                className="w-full py-2.5 bg-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-300"
              >
                No
              </button>
              <button
                onClick={() => handlePurchaseResponse('negotiating')}
                disabled={loading}
                className="w-full py-2.5 border border-reride-orange text-reride-orange rounded-lg font-semibold"
              >
                Still Negotiating
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-reride-text-dark dark:text-white mb-2">
              Need Help?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Would you like assistance with any of these?
            </p>
            <div className="space-y-2 mb-4">
              {[
                { id: 'rc_transfer', label: 'RC Transfer' },
                { id: 'sale_agreement', label: 'Sale Agreement' },
                { id: 'complaint_support', label: 'Complaint Support' },
                { id: 'insurance_transfer', label: 'Insurance Transfer' },
                ...DEAL_ASSISTANCE_PACKAGES.map((p) => ({ id: p.id, label: `${p.name} (₹${p.price})` })),
              ].map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(svc.id)}
                    onChange={() => toggleService(svc.id)}
                    className="rounded text-reride-orange"
                  />
                  <span className="text-sm">{svc.label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleServicesSubmit}
              disabled={loading}
              className="w-full py-2.5 bg-reride-orange text-white rounded-lg font-semibold"
            >
              Submit
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700">
          Dismiss
        </button>
        <p className="text-xs text-slate-400 mt-2 text-center">Lead: {leadId}</p>
      </div>
    </div>
  );
};

export default DealSurveyModal;
