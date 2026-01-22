import React, { useState, useRef } from 'react';
import type { User } from '../types';
import PasswordInput from './PasswordInput';
import { isTokenLikelyValid, refreshAuthToken } from '../utils/authenticatedFetch.js';

interface MobileProfileProps {
  currentUser: User;
  onUpdateProfile: (details: Partial<User>) => Promise<void> | void;
  onUpdatePassword: (passwords: { current: string; new: string }) => Promise<boolean>;
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
  addToast
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [formData, setFormData] = useState({
    name: currentUser.name || '',
    email: currentUser.email || '',
    mobile: currentUser.mobile || '',
    dealershipName: currentUser.dealershipName || '',
    bio: currentUser.bio || '',
    avatarUrl: currentUser.avatarUrl || ''
  });
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shareUrl)}`;
      
      // Fetch the QR code image
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch QR code');
      }
      
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `seller-qr-${(currentUser.dealershipName || currentUser.name || 'profile').toString().replace(/\s+/g, '-')}.png`;
      
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      addToast?.('QR code downloaded successfully!', 'success');
    } catch (error) {
      console.error('Failed to download QR code:', error);
      addToast?.('Failed to download QR code. Please try again.', 'error');
      // Fallback: open in new tab if download fails
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shareUrl)}`;
      window.open(qrUrl, '_blank');
    }
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: typeof passwordErrors = {};

    if (!passwordData.current) {
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
      await onUpdateProfile(formData);
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
        console.log('🔄 Token appears expired, attempting proactive refresh before password update...');
        try {
          const newToken = await refreshAuthToken();
          if (newToken) {
            console.log('✅ Token refreshed successfully before password update');
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
        current: passwordData.current,
        new: passwordData.new
      });
      if (success) {
        setPasswordData({ current: '', new: '', confirm: '' });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to update password:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password. Please try again.';
      
      // Only show "session expired" if we're CERTAIN it's an authentication error
      // Check for explicit auth error messages from the API
      const isAuthError = errorMessage.includes('Authentication expired') || 
          errorMessage.includes('Unauthorized') || 
          errorMessage.includes('401') ||
          (errorMessage.includes('session has expired') && errorMessage.includes('log in again')) ||
          (errorMessage.includes('Please log in again') && (errorMessage.includes('expired') || errorMessage.includes('401')));
      
      if (isAuthError) {
        // Only clear tokens if we're certain it's an auth issue
        // Check if we still have a token - if not, it was already cleared
        const hasToken = localStorage.getItem('reRideAccessToken');
        if (hasToken) {
          // Clear all authentication tokens and user data
          try {
            localStorage.removeItem('reRideAccessToken');
            localStorage.removeItem('reRideRefreshToken');
            localStorage.removeItem('reRideCurrentUser');
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
        // For other errors, show the actual error message
        if (addToast) {
          addToast(errorMessage, 'error');
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                disabled={!isEditing}
                rows={4}
                maxLength={500}
                placeholder="Tell us about yourself..."
                className={`w-full px-4 py-3 rounded-xl border ${
                  errors.bio ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                } ${!isEditing ? 'bg-gray-50' : ''} focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none`}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.bio.length}/500
              </p>
            </div>

            {/* Seller QR Code Section */}
            {currentUser.role === 'seller' && !isEditing && (() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;
              
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
                    setFormData({
                      name: currentUser.name || '',
                      email: currentUser.email || '',
                      mobile: currentUser.mobile || '',
                      dealershipName: currentUser.dealershipName || '',
                      bio: currentUser.bio || '',
                      avatarUrl: currentUser.avatarUrl || ''
                    });
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
              {isSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}
      </div>

      {/* Logout Section */}
      {onLogout && (
        <div className="px-4 py-6">
          <div className="border-t border-gray-200 pt-6">
            <button
              onClick={onLogout}
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

