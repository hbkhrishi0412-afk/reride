import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { dashboardNotify, type DashboardNotifyFn } from '../dashboard/notify';

const AVAILABLE_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India (SBI)',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Bajaj Finserv',
  'Tata Capital',
  'Mahindra Finance',
  'Yes Bank',
  'IDFC First Bank',
  'Bank of Baroda',
  'Punjab National Bank (PNB)',
  'Union Bank of India',
  'Canara Bank',
  'Indian Bank',
] as const;

export const FinancePartnersView: React.FC<{
  seller: User;
  onUpdateSeller: (details: Partial<User>) => void | Promise<void>;
  onNotify?: DashboardNotifyFn;
}> = ({ seller, onUpdateSeller, onNotify }) => {
  const { t } = useTranslation();
  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
      dashboardNotify(onNotify, message, type),
    [onNotify],
  );

  const [selectedBanks, setSelectedBanks] = useState<string[]>(seller?.partnerBanks || []);
  const [isSavingBanks, setIsSavingBanks] = useState(false);
  const [banksSaved, setBanksSaved] = useState(false);

  useEffect(() => {
    setSelectedBanks(seller?.partnerBanks || []);
  }, [seller?.partnerBanks]);

  const handleBankToggle = (bankName: string) => {
    setSelectedBanks((prev) =>
      prev.includes(bankName) ? prev.filter((b) => b !== bankName) : [...prev, bankName],
    );
  };

  const handleSaveBanks = async () => {
    setIsSavingBanks(true);
    setBanksSaved(false);
    try {
      await onUpdateSeller({
        dealershipName: seller.dealershipName || seller.name,
        bio: seller.bio || '',
        logoUrl: seller.logoUrl || '',
        partnerBanks: selectedBanks,
      });
      setBanksSaved(true);
      setTimeout(() => setBanksSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save bank partners:', error);
      notify(t('sellerDashboard.saveBanksFailed'), 'error');
    } finally {
      setIsSavingBanks(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {t('sellerDashboard.financePartnerBanks')}
        </h3>
        <p className="text-sm text-gray-600">{t('sellerDashboard.financePartnerHint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {AVAILABLE_BANKS.map((bank) => {
          const isSelected = selectedBanks.includes(bank);
          return (
            <label
              key={bank}
              className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleBankToggle(bank)}
                className="sr-only"
              />
              <div
                className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                  isSelected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                {bank}
              </span>
            </label>
          );
        })}
      </div>

      {selectedBanks.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm font-medium text-purple-900 mb-2">
            {t('sellerDashboard.selectedPartners', { count: selectedBanks.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedBanks.map((bank) => (
              <span
                key={bank}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200"
              >
                {bank}
                <button
                  type="button"
                  onClick={() => handleBankToggle(bank)}
                  className="ml-2 text-purple-600 hover:text-purple-800"
                  aria-label={t('sellerDashboard.removeBankAria', { bank })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">
          {selectedBanks.length === 0
            ? t('sellerDashboard.hintNoBanks')
            : t('sellerDashboard.hintListingsShow')}
        </p>
        <button
          type="button"
          onClick={() => void handleSaveBanks()}
          disabled={isSavingBanks}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            isSavingBanks
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : banksSaved
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {isSavingBanks
            ? t('sellerDashboard.saving')
            : banksSaved
              ? t('sellerDashboard.saved')
              : t('sellerDashboard.saveChanges')}
        </button>
      </div>
    </div>
  );
};
