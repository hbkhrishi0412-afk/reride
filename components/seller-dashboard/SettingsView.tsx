import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import type { View } from '../../types';
import PaymentStatusCard from '../PaymentStatusCard';
import { PaymentErrorBoundary } from '../ErrorBoundaries';
import { dashboardNotify, type DashboardNotifyFn } from '../dashboard/notify';
import { PlanStatusCard } from './PlanStatusCard';
import { compressImage } from '../../utils/mobileFeatures';
import {
  buildSellerQrCodeUrl,
  buildSellerShareUrl,
  sellerQrDownloadFileName,
} from '../../utils/sellerQrCode';

type ProfileForm = {
  name: string;
  mobile: string;
  dealershipName: string;
  bio: string;
  logoUrl: string;
  location: string;
  address: string;
  pincode: string;
};

function profileFromSeller(seller: User): ProfileForm {
  return {
    name: seller.name || '',
    mobile: seller.mobile || '',
    dealershipName: seller.dealershipName || seller.name || '',
    bio: seller.bio || '',
    logoUrl: seller.logoUrl || seller.avatarUrl || '',
    location: seller.location || '',
    address: seller.address || '',
    pincode: seller.pincode || '',
  };
}

export const SettingsView: React.FC<{
  seller: User;
  onUpdateSeller: (details: Partial<User>) => void | Promise<void>;
  onNotify?: DashboardNotifyFn;
  activeListingsCount: number;
  featuredListingsCount: number;
  onNavigate: (view: View) => void;
}> = ({ seller, onUpdateSeller, onNotify, activeListingsCount, featuredListingsCount, onNavigate }) => {
  const { t } = useTranslation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
      dashboardNotify(onNotify, message, type),
    [onNotify],
  );

  const [profile, setProfile] = useState<ProfileForm>(() => profileFromSeller(seller));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setProfile(profileFromSeller(seller));
  }, [
    seller.email,
    seller.name,
    seller.mobile,
    seller.dealershipName,
    seller.bio,
    seller.logoUrl,
    seller.avatarUrl,
    seller.location,
    seller.address,
    seller.pincode,
  ]);

  if (!seller || !seller.email) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
        <p className="text-gray-600">{t('sellerDashboard.unableLoadSeller')}</p>
      </div>
    );
  }

  const setField = (key: keyof ProfileForm, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setProfileError(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
      setProfileError('Please upload a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image size must be less than 5MB.');
      return;
    }
    setLogoUploading(true);
    setProfileError(null);
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(raw, 800, 800, 0.82);
      setField('logoUrl', compressed);
    } catch {
      setProfileError('Could not process that image. Try another file.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    const dealershipName = profile.dealershipName.trim();
    const name = profile.name.trim();
    const mobile = profile.mobile.trim();
    if (!name) {
      setProfileError('Name is required.');
      return;
    }
    if (!dealershipName) {
      setProfileError('Dealership name is required.');
      return;
    }
    if (!mobile) {
      setProfileError('Mobile number is required.');
      return;
    }
    const pin = profile.pincode.replace(/\D/g, '').slice(0, 6);
    if (profile.pincode.trim() && pin.length !== 6) {
      setProfileError('PIN code must be exactly 6 digits.');
      return;
    }

    setIsSavingProfile(true);
    setProfileSaved(false);
    setProfileError(null);
    try {
      await onUpdateSeller({
        name,
        mobile,
        dealershipName,
        bio: profile.bio.trim(),
        logoUrl: profile.logoUrl,
        avatarUrl: profile.logoUrl || seller.avatarUrl,
        location: profile.location.trim(),
        address: profile.address.trim() || undefined,
        pincode: pin || '',
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError(t('sellerDashboard.settings.saveFailed', { defaultValue: 'Could not save profile. Please try again.' }));
      notify(t('sellerDashboard.settings.saveFailed', { defaultValue: 'Could not save profile. Please try again.' }), 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const logoPreview =
    profile.logoUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.dealershipName || profile.name || 'S')}&size=96&background=6366f1&color=fff&bold=true`;

  const shareUrl = buildSellerShareUrl(seller.email);
  const qrUrl = buildSellerQrCodeUrl(shareUrl, 240);

  const copyShareUrl = () => {
    try {
      void navigator.clipboard?.writeText(shareUrl);
      notify(t('sellerDashboard.shareLinkCopied', { defaultValue: 'Link copied to clipboard.' }), 'success');
    } catch {
      notify(t('sellerDashboard.shareLinkCopyFailed', { defaultValue: 'Could not copy link. Copy it manually.' }), 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <PlanStatusCard
          seller={seller}
          activeListingsCount={activeListingsCount}
          featuredListingsCount={featuredListingsCount}
          onNavigate={onNavigate}
        />

        <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t('sellerDashboard.editProfile', { defaultValue: 'Edit profile' })}
            </h3>
            <p className="text-sm text-gray-600">
              {t('sellerDashboard.editProfileHint', {
                defaultValue: 'Update your name, dealership details, and profile photo shown on listings.',
              })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-5">
            <div className="shrink-0">
              <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
                {logoUploading ? (
                  <div className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-semibold text-slate-600">
                    …
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading || isSavingProfile}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {t('sellerDashboard.uploadLogo', { defaultValue: 'Upload photo' })}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleLogoUpload}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Name</span>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Mobile</span>
                <input
                  type="tel"
                  value={profile.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-gray-700">Dealership name</span>
                <input
                  type="text"
                  value={profile.dealershipName}
                  onChange={(e) => setField('dealershipName', e.target.value)}
                  maxLength={50}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-gray-700">About your dealership</span>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setField('bio', e.target.value.slice(0, 500))}
                  rows={3}
                  maxLength={500}
                  placeholder="Tell buyers about your dealership…"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
                <span className="mt-1 block text-xs text-gray-400">{profile.bio.length}/500</span>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">City or region</span>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder="e.g. Pune, Maharashtra"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">PIN code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={profile.pincode}
                  onChange={(e) => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-gray-700">Street address</span>
                <textarea
                  value={profile.address}
                  onChange={(e) => setField('address', e.target.value)}
                  rows={2}
                  placeholder="Building, street, locality"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </label>
            </div>
          </div>

          {profileError ? (
            <p className="mb-3 text-sm text-red-600">{profileError}</p>
          ) : null}

          <div className="mb-5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              {t('sellerDashboard.shareLinkQrTitle', { defaultValue: 'Seller Share Link & QR' })}
            </h4>
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <div className="flex-1 w-full min-w-0">
                <label className="text-xs text-gray-500">
                  {t('sellerDashboard.publicSellerUrl', { defaultValue: 'Public seller URL' })}
                </label>
                <div className="mt-1 flex">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-l-lg text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    className="px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 shrink-0"
                  >
                    {t('common.copy', { defaultValue: 'Copy' })}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {t('sellerDashboard.shareLinkQrHint', {
                    defaultValue: 'Share this link or the QR code to showcase your seller profile and listings.',
                  })}
                </p>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <img src={qrUrl} alt="Seller QR code" className="w-36 h-36 border rounded-lg bg-white" />
                <a
                  href={qrUrl}
                  download={sellerQrDownloadFileName(profile.dealershipName || profile.name || 'profile')}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  {t('sellerDashboard.downloadQr', { defaultValue: 'Download QR' })}
                </a>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={isSavingProfile || logoUploading}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                isSavingProfile
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : profileSaved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSavingProfile
                ? t('sellerDashboard.saving')
                : profileSaved
                  ? t('sellerDashboard.saved')
                  : t('sellerDashboard.saveProfile', { defaultValue: 'Save profile' })}
            </button>
          </div>
        </div>
      </div>

      <PaymentErrorBoundary>
        <PaymentStatusCard currentUser={seller} />
      </PaymentErrorBoundary>
    </div>
  );
};
