import { logInfo } from '../utils/logger.js';
import React, { useState, useRef } from 'react';
import type { User } from '../types';
import PasswordInput from './PasswordInput';
import { isTokenLikelyValid, refreshAuthToken } from '../utils/authenticatedFetch.js';
import { getBrowserAccessTokenForApi } from '../utils/authStorage';
import { logout as rerideLogout } from '../services/userService';
import { saveQrCodePngFromUrl } from '../utils/saveQrCodeImage';
import {
  buildSellerQrCodeUrl,
  buildSellerShareUrl,
  sellerQrDownloadFileName,
} from '../utils/sellerQrCode';
import { downloadProfileExport, requestAccountDeletion } from '../services/accountPrivacyService';
import { userNeedsPasswordSetup } from '../utils/profilePassword';
import { compressImage } from '../utils/mobileFeatures';
import { validateAadharNumber, validatePanNumber } from '../utils/validation';
import { useVisualViewportBottomInset } from '../hooks/useVisualViewportBottomInset';
import { useApp } from './AppProvider';

interface MobileProfileProps {
  currentUser: User;
  onUpdateProfile: (details: Partial<User>) => Promise<void> | void;
  onUpdatePassword: (passwords: { current?: string; new: string }) => Promise<boolean>;
  onBack?: () => void;
  onLogout?: () => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  mobile?: string;
  dealershipName?: string;
  bio?: string;
  location?: string;
  address?: string;
  pincode?: string;
  aadharNumber?: string;
  aadharCard?: string;
  panNumber?: string;
  panCard?: string;
}

const PROFILE_DOC_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';
const isPdfDocumentUrl = (url: string) => /^data:application\/pdf|\.pdf(\?|$)/i.test(url);

function emptyProfileForm(user: User) {
  return {
    name: user.name || '',
    email: user.email || '',
    mobile: user.mobile || '',
    dealershipName: user.dealershipName || '',
    bio: user.bio || '',
    location: user.location || '',
    address: user.address || '',
    pincode: user.pincode || '',
    avatarUrl: user.avatarUrl || '',
    aadharNumber: user.aadharCard?.number || '',
    aadharDocumentUrl: user.aadharCard?.documentUrl || '',
    panNumber: user.panCard?.number || '',
    panDocumentUrl: user.panCard?.documentUrl || '',
  };
}

/**
 * Mobile-Optimized Profile Component
 * Features:
 * - Camera integration for avatar upload
 * - Touch-friendly form inputs
 * - Mobile-optimized settings
 */
export const MobileProfile: React.FC<MobileProfileProps> = ({
  currentUser,
  onUpdateProfile,
  onUpdatePassword,
  onBack,
  onLogout,
  addToast,
}) => {
  const { runIfConfirmed } = useApp();
  const needsPasswordSetup = userNeedsPasswordSetup(currentUser);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [docsOpen, setDocsOpen] = useState(true);
  const [formData, setFormData] = useState(() => emptyProfileForm(currentUser));
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ aadhar: false, pan: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aadharInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useVisualViewportBottomInset();

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePasswordChange = (field: keyof typeof passwordData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, avatar: 'Please select an image file' }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'Image size should be less than 5MB' }));
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadQRCode = async () => {
    const shareUrl = buildSellerShareUrl(currentUser.email);
    const qrUrl = buildSellerQrCodeUrl(shareUrl, 240);
    const fileName = sellerQrDownloadFileName(
      (currentUser.dealershipName || currentUser.name || 'profile').toString(),
    );
    await saveQrCodePngFromUrl(qrUrl, fileName, addToast);
  };

  const validateProfile = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.mobile && !/^[0-9]{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Invalid mobile number';
    }

    if (currentUser.role === 'seller') {
      if (formData.bio && formData.bio.length > 500) {
        newErrors.bio = 'Bio must be less than 500 characters';
      }
      const pc = formData.pincode.replace(/\D/g, '');
      if (formData.pincode.trim() && pc.length !== 6) {
        newErrors.pincode = 'PIN code must be exactly 6 digits';
      }
    }

    const aadharError = validateAadharNumber(formData.aadharNumber);
    if (aadharError) newErrors.aadharNumber = aadharError;
    const panError = validatePanNumber(formData.panNumber);
    if (panError) newErrors.panNumber = panError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'aadhar' | 'pan',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [type === 'aadhar' ? 'aadharCard' : 'panCard']: 'Please upload JPEG, PNG, WebP, or PDF',
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        [type === 'aadhar' ? 'aadharCard' : 'panCard']: 'File size must be less than 5MB',
      }));
      return;
    }

    setUploadProgress((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({
      ...prev,
      [type === 'aadhar' ? 'aadharCard' : 'panCard']: undefined,
    }));

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const finalUrl =
        file.type === 'application/pdf'
          ? dataUrl
          : await compressImage(dataUrl, 1200, 1200, 0.82);
      setFormData((prev) =>
        type === 'aadhar'
          ? { ...prev, aadharDocumentUrl: finalUrl }
          : { ...prev, panDocumentUrl: finalUrl },
      );
    } catch {
      setErrors((prev) => ({
        ...prev,
        [type === 'aadhar' ? 'aadharCard' : 'panCard']:
          'Failed to process file. Please try a different one.',
      }));
    } finally {
      setUploadProgress((prev) => ({ ...prev, [type]: false }));
    }
  };

  const validatePassword = (): boolean => {
    const newErrors: typeof passwordErrors = {};

    if (!needsPasswordSetup && !passwordData.current) {
      newErrors.current = 'Current password is required';
    }

    if (!passwordData.new) {
      newErrors.new = 'New password is required';
    } else if (passwordData.new.length < 8) {
      newErrors.new = 'Password must be at least 8 characters';
    }

    if (passwordData.new !== passwordData.confirm) {
      newErrors.confirm = 'Passwords do not match';
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    setIsSaving(true);
    try {
      const profileData: Partial<User> = {
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        avatarUrl: formData.avatarUrl,
        dealershipName: formData.dealershipName,
        bio: formData.bio,
      };
      if (currentUser.role === 'seller') {
        profileData.location = formData.location.trim();
        profileData.address = formData.address.trim() || undefined;
        const pc = formData.pincode.replace(/\D/g, '').slice(0, 6);
        profileData.pincode = pc || '';
      }

      const existingAadhar = currentUser.aadharCard;
      profileData.aadharCard = {
        number: formData.aadharNumber.replace(/[\s-]/g, ''),
        documentUrl: formData.aadharDocumentUrl || '',
        isVerified: existingAadhar?.isVerified ?? false,
        verifiedAt: existingAadhar?.verifiedAt,
        verifiedBy: existingAadhar?.verifiedBy,
        uploadedAt:
          formData.aadharDocumentUrl && !existingAadhar?.uploadedAt
            ? new Date().toISOString()
            : existingAadhar?.uploadedAt,
      };

      const existingPAN = currentUser.panCard;
      profileData.panCard = {
        number: (formData.panNumber || '').toUpperCase(),
        documentUrl: formData.panDocumentUrl || '',
        isVerified: existingPAN?.isVerified ?? false,
        verifiedAt: existingPAN?.verifiedAt,
        verifiedBy: existingPAN?.verifiedBy,
        uploadedAt:
          formData.panDocumentUrl && !existingPAN?.uploadedAt
            ? new Date().toISOString()
            : existingPAN?.uploadedAt,
      };

      await onUpdateProfile(profileData);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!validatePassword()) return;

    setIsSaving(true);
    try {
      // Attempt to proactively refresh token if it's likely expired
      // But don't block the request if refresh fails - let the API handle it
      if (!isTokenLikelyValid()) {
        logInfo('🔄 Token appears expired, attempting proactive refresh before password update...');
        try {
          const newToken = await refreshAuthToken();
          if (newToken) {
            logInfo('✅ Token refreshed successfully before password update');
          } else {
            console.warn('⚠️ Proactive token refresh returned null, but continuing with request (API will handle 401)');
          }
        } catch (refreshError) {
          // Don't block on proactive refresh failure - might be network issue
          // The API call will handle 401 and retry with token refresh
          console.warn('⚠️ Proactive token refresh failed, but continuing with request:', refreshError);
        }
      }
      
      const success = await onUpdatePassword({
        ...(needsPasswordSetup ? {} : { current: passwordData.current }),
        new: passwordData.new
      });
      if (success) {
        setPasswordData({ current: '', new: '', confirm: '' });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update password:', error);
      const rawError = error instanceof Error ? error.message : '';
      
      // Only show "session expired" if we're CERTAIN it's an authentication error
      // Check for explicit auth error messages from the API
      const isAuthError = rawError.includes('Authentication expired') || 
          rawError.includes('Unauthorized') || 
          rawError.includes('401') ||
          (rawError.includes('session has expired') && rawError.includes('log in again')) ||
          (rawError.includes('Please log in again') && (rawError.includes('expired') || rawError.includes('401')));
      
      if (isAuthError) {
        // Only clear tokens if we're certain it's an auth issue
        // Check if we still have a token - if not, it was already cleared
        const hasToken = !!getBrowserAccessTokenForApi();
        if (hasToken) {
          try {
            rerideLogout();
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem('currentUser');
              sessionStorage.removeItem('accessToken');
            }
          } catch (clearError) {
            console.error('Error clearing tokens:', clearError);
          }
        }
        
        if (addToast) {
          addToast('Your session has expired. Please log in again.', 'error');
        }
        
        // Redirect to login after showing error message
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // Reload page to trigger login redirect
            window.location.reload();
          }
        }, 2000);
      } else {
        // Show user-friendly error message
        if (addToast) {
          addToast('Could not update password. Please try again.', 'error');
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        paddingBottom: `max(6rem, calc(6rem + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px))`,
      }}
    >
      {/* Header */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3 safe-top">
          <button
            onClick={onBack}
            className="p-2 -ml-2"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Profile</h1>
          {isEditing && (
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="ml-auto text-orange-500 font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border-b border-green-200 p-4 text-center">
          <p className="text-green-700 font-semibold">✓ Saved successfully!</p>
        </div>
      )}

      {/* Avatar Section */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              onClick={isEditing ? handleAvatarClick : undefined}
              className={`w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl font-bold ${
                isEditing ? 'cursor-pointer active:scale-95' : ''
              }`}
            >
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt={formData.name || 'User'}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{formData.name?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
            {isEditing && (
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center border-4 border-white">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full font-semibold"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 text-sm font-semibold ${
              activeTab === 'profile'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-600'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-4 text-sm font-semibold ${
              activeTab === 'password'
                ? 'text-orange-500 border-b-2 border-orange-500'
                : 'text-gray-600'
            }`}
          >
            Password
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'profile' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile</label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => handleInputChange('mobile', e.target.value)}
                disabled={!isEditing}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.mobile ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
              />
              {errors.mobile && <p className="text-xs text-red-600 mt-1">{errors.mobile}</p>}
            </div>

            {currentUser.role === 'seller' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dealership Name</label>
                <input
                  type="text"
                  value={formData.dealershipName}
                  onChange={(e) => handleInputChange('dealershipName', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 rounded-xl border ${
                    errors.dealershipName ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                />
                {errors.dealershipName && <p className="text-xs text-red-600 mt-1">{errors.dealershipName}</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {currentUser.role === 'seller' ? 'About Your Dealership' : 'Bio'}
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!isEditing}
                rows={4}
                maxLength={500}
                placeholder={
                  currentUser.role === 'seller'
                    ? 'Tell customers about your dealership...'
                    : 'Tell us about yourself...'
                }
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.bio ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none`}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.bio.length}/500
              </p>
              {errors.bio && <p className="text-xs text-red-600 mt-1">{errors.bio}</p>}
            </div>

            {currentUser.role === 'seller' && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Business location</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    City is shown on listings. PIN code groups you on the dealers map. Street + PIN improves map accuracy.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City or region</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    disabled={!isEditing}
                    placeholder="e.g. Bengaluru, Karnataka"
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.location ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                    } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                  {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Street address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                    rows={2}
                    placeholder="Building, street, locality"
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.address ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                    } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none`}
                  />
                  {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">PIN code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={formData.pincode}
                    onChange={(e) => handleInputChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={!isEditing}
                    placeholder="6-digit PIN"
                    className={`w-full px-4 py-3 rounded-xl border ${
                      errors.pincode ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                    } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  />
                  {errors.pincode && <p className="text-xs text-red-600 mt-1">{errors.pincode}</p>}
                </div>
              </div>
            )}

            {/* Document Verification — parity with desktop Profile */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setDocsOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-gray-50"
                style={{ minHeight: '56px' }}
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Document Verification</h3>
                  <p className="text-xs text-gray-500">Upload Aadhar Card and PAN Card</p>
                </div>
                <svg
                  className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${docsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {docsOpen && (
                <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Aadhar Card</span>
                      {currentUser.aadharCard?.isVerified ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">Aadhar Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={14}
                        value={formData.aadharNumber}
                        onChange={(e) => handleInputChange('aadharNumber', e.target.value)}
                        disabled={!isEditing}
                        placeholder="1234 5678 9012"
                        className={`w-full rounded-xl border px-4 py-3 ${
                          errors.aadharNumber ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                        } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                      />
                      {errors.aadharNumber && (
                        <p className="mt-1 text-xs text-red-600">{errors.aadharNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Aadhar Card Document
                      </label>
                      {formData.aadharDocumentUrl ? (
                        <div className="mb-3 relative inline-block">
                          {isPdfDocumentUrl(formData.aadharDocumentUrl) ? (
                            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600">
                              PDF uploaded
                            </div>
                          ) : (
                            <img
                              src={formData.aadharDocumentUrl}
                              alt="Aadhar Card"
                              className="h-28 w-20 rounded-lg border border-gray-200 object-cover"
                            />
                          )}
                          {uploadProgress.aadhar ? (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-blue-500/20">
                              <span className="text-xs font-semibold text-blue-700">Uploading…</span>
                            </div>
                          ) : null}
                          <a
                            href={formData.aadharDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-xs font-medium text-blue-600 underline"
                          >
                            View document
                          </a>
                        </div>
                      ) : null}
                      {isEditing ? (
                        <div>
                          <label
                            htmlFor="mobile-aadhar-upload"
                            className="inline-flex min-h-[44px] items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 active:bg-blue-100"
                          >
                            {formData.aadharDocumentUrl ? 'Change document' : 'Upload document'}
                          </label>
                          <input
                            id="mobile-aadhar-upload"
                            ref={aadharInputRef}
                            type="file"
                            className="sr-only"
                            accept={PROFILE_DOC_ACCEPT}
                            onChange={(e) => void handleDocumentUpload(e, 'aadhar')}
                          />
                          <p className="mt-2 text-xs text-gray-500">JPEG, PNG, PDF (Max 5MB)</p>
                        </div>
                      ) : null}
                      {errors.aadharCard && (
                        <p className="mt-1 text-xs text-red-600">{errors.aadharCard}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">PAN Card</span>
                      {currentUser.panCard?.isVerified ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Verified
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">PAN Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={(formData.panNumber || '').toUpperCase()}
                        onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                        disabled={!isEditing}
                        placeholder="ABCDE1234F"
                        className={`w-full rounded-xl border px-4 py-3 ${
                          errors.panNumber ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                        } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                      />
                      {errors.panNumber && (
                        <p className="mt-1 text-xs text-red-600">{errors.panNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        PAN Card Document
                      </label>
                      {formData.panDocumentUrl ? (
                        <div className="mb-3 relative inline-block">
                          {isPdfDocumentUrl(formData.panDocumentUrl) ? (
                            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600">
                              PDF uploaded
                            </div>
                          ) : (
                            <img
                              src={formData.panDocumentUrl}
                              alt="PAN Card"
                              className="h-28 w-20 rounded-lg border border-gray-200 object-cover"
                            />
                          )}
                          {uploadProgress.pan ? (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-blue-500/20">
                              <span className="text-xs font-semibold text-blue-700">Uploading…</span>
                            </div>
                          ) : null}
                          <a
                            href={formData.panDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block text-xs font-medium text-blue-600 underline"
                          >
                            View document
                          </a>
                        </div>
                      ) : null}
                      {isEditing ? (
                        <div>
                          <label
                            htmlFor="mobile-pan-upload"
                            className="inline-flex min-h-[44px] items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 active:bg-blue-100"
                          >
                            {formData.panDocumentUrl ? 'Change document' : 'Upload document'}
                          </label>
                          <input
                            id="mobile-pan-upload"
                            ref={panInputRef}
                            type="file"
                            className="sr-only"
                            accept={PROFILE_DOC_ACCEPT}
                            onChange={(e) => void handleDocumentUpload(e, 'pan')}
                          />
                          <p className="mt-2 text-xs text-gray-500">JPEG, PNG, PDF (Max 5MB)</p>
                        </div>
                      ) : null}
                      {errors.panCard && (
                        <p className="mt-1 text-xs text-red-600">{errors.panCard}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seller QR Code Section */}
            {currentUser.role === 'seller' && !isEditing && (() => {
              const shareUrl = buildSellerShareUrl(currentUser.email);
              const qrUrl = buildSellerQrCodeUrl(shareUrl, 240);
              
              return (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Seller Share Link & QR Code</h3>
                  
                  {/* Share URL */}
                  <div className="mb-4">
                    <label className="block text-xs text-gray-600 mb-2">Public seller URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            addToast?.('Link copied to clipboard!', 'success');
                          } catch (err) {
                            // Fallback for browsers that don't support clipboard API
                            const textArea = document.createElement('textarea');
                            textArea.value = shareUrl;
                            textArea.style.position = 'fixed';
                            textArea.style.left = '-999999px';
                            document.body.appendChild(textArea);
                            textArea.select();
                            try {
                              document.execCommand('copy');
                              addToast?.('Link copied to clipboard!', 'success');
                            } catch (e) {
                              addToast?.('Failed to copy link. Please copy manually.', 'error');
                            }
                            document.body.removeChild(textArea);
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg active:scale-95 transition-transform"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Share this link or QR code to showcase your seller profile and listings.</p>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <img 
                      src={qrUrl} 
                      alt="Seller QR code" 
                      className="w-48 h-48 border-2 border-white rounded-xl bg-white shadow-sm"
                    />
                    <button
                      onClick={handleDownloadQRCode}
                      className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold active:scale-95 transition-transform flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download QR Code
                    </button>
                  </div>
                </div>
              );
            })()}

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(emptyProfileForm(currentUser));
                    setErrors({});
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {!needsPasswordSetup && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
              <PasswordInput
                value={passwordData.current}
                onChange={(e) => handlePasswordChange('current', e.target.value)}
                placeholder="Enter current password"
                className={passwordErrors.current ? 'border-red-300 bg-red-50' : ''}
              />
              {passwordErrors.current && (
                <p className="text-xs text-red-600 mt-1">{passwordErrors.current}</p>
              )}
            </div>
            )}

            {needsPasswordSetup && (
              <p className="text-sm text-gray-600">
                Create a password so you can also sign in with email and password.
              </p>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <PasswordInput
                value={passwordData.new}
                onChange={(e) => handlePasswordChange('new', e.target.value)}
                placeholder="Enter new password"
                className={passwordErrors.new ? 'border-red-300 bg-red-50' : ''}
              />
              {passwordErrors.new && (
                <p className="text-xs text-red-600 mt-1">{passwordErrors.new}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
              <PasswordInput
                value={passwordData.confirm}
                onChange={(e) => handlePasswordChange('confirm', e.target.value)}
                placeholder="Confirm new password"
                className={passwordErrors.confirm ? 'border-red-300 bg-red-50' : ''}
              />
              {passwordErrors.confirm && (
                <p className="text-xs text-red-600 mt-1">{passwordErrors.confirm}</p>
              )}
            </div>

            <button
              onClick={handleSavePassword}
              disabled={isSaving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : needsPasswordSetup ? 'Set Password' : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Data & privacy (mobile parity with desktop Profile) */}
      <div className="px-4 py-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Data &amp; privacy</h3>
          <p className="text-xs text-gray-500 mb-3">
            Download a copy of your profile or permanently delete your account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                downloadProfileExport(currentUser);
                addToast?.('Your profile data has been downloaded.', 'success');
              }}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200"
            >
              Download my data (JSON)
            </button>
            <button
              type="button"
              onClick={() => {
                void runIfConfirmed(
                  'Permanently delete your account? This cannot be undone. You will be signed out immediately.',
                  async () => {
                    const needsPassword = Boolean(currentUser.authProvider === 'email' || currentUser.password);
                    if (needsPassword) {
                      setDeletePassword('');
                      setShowDeletePasswordModal(true);
                      return;
                    }
                    const r = await requestAccountDeletion(currentUser.email, {});
                    if (r.success) {
                      addToast?.(r.message || 'Your account has been deleted.', 'success');
                      onLogout?.();
                    } else {
                      addToast?.(r.reason || 'Could not delete your account. Please try again.', 'error');
                    }
                  },
                  { variant: 'danger' },
                );
              }}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-red-700 bg-red-50 border border-red-200"
            >
              Delete my account
            </button>
          </div>
        </div>
      </div>

      {showDeletePasswordModal && (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Confirm deletion</h3>
            <p className="mt-1 text-sm text-gray-600">Enter your password to permanently delete this account.</p>
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
              placeholder="Password"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                onClick={() => {
                  setShowDeletePasswordModal(false);
                  setDeletePassword('');
                }}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isDeletingAccount || !deletePassword}
                onClick={() => {
                  void (async () => {
                    setIsDeletingAccount(true);
                    try {
                      const r = await requestAccountDeletion(currentUser.email, { password: deletePassword });
                      if (r.success) {
                        setShowDeletePasswordModal(false);
                        addToast?.(r.message || 'Your account has been deleted.', 'success');
                        onLogout?.();
                      } else {
                        addToast?.(r.reason || 'Could not delete your account. Please try again.', 'error');
                      }
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  })();
                }}
              >
                {isDeletingAccount ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Section */}
      {onLogout && (
        <div className="px-4 py-6">
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={() => { void Promise.resolve(onLogout()); }}
              className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold border border-red-200 active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileProfile;

