import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types.js';
import PasswordInput from './PasswordInput.js';
import { isTokenLikelyValid, refreshAuthToken } from '../utils/authenticatedFetch.js';

interface ProfileProps {
  currentUser: User;
  onUpdateProfile: (details: Partial<User>) => Promise<void> | void;
  onUpdatePassword: (passwords: { current: string; new: string }) => Promise<boolean>;
}

interface FormErrors {
  name?: string;
  email?: string;
  mobile?: string;
  dealershipName?: string;
  bio?: string;
  avatar?: string;
  logo?: string;
  aadharCard?: string;
  panCard?: string;
  aadharNumber?: string;
  panNumber?: string;
}

interface PasswordStrength {
  score: number; // 0-4
  feedback: string;
  meetsRequirements: boolean;
}

const ProfileInput: React.FC<{ 
  label: string; 
  name: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  type?: string; 
  disabled?: boolean; 
  placeholder?: string;
  error?: string;
  maxLength?: number;
  required?: boolean;
}> = ({ label, name, value, onChange, type = 'text', disabled = false, placeholder, error, maxLength, required }) => {
  const charCount = (value || '').length;
  const showCharCount = maxLength && maxLength > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {showCharCount && (
          <span className={`text-xs ${charCount > maxLength! * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ${
          error 
            ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { score: 0, feedback: '', meetsRequirements: false };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  // Uppercase check
  if (/[A-Z]/.test(password)) score++;
  else feedback.push('One uppercase letter');

  // Lowercase check
  if (/[a-z]/.test(password)) score++;
  else feedback.push('One lowercase letter');

  // Number check
  if (/\d/.test(password)) score++;
  else feedback.push('One number');

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else feedback.push('One special character');

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const meetsRequirements = score >= 4 && password.length >= 8;

  return {
    score,
    feedback: feedback.length > 0 ? `Needs: ${feedback.slice(0, 2).join(', ')}` : strengthLabels[score - 1] || 'Very Weak',
    meetsRequirements
  };
};

const Profile: React.FC<ProfileProps> = ({ currentUser, onUpdateProfile, onUpdatePassword }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [formData, setFormData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    mobile: currentUser.mobile,
    avatarUrl: currentUser.avatarUrl || '',
    dealershipName: (currentUser as any).dealershipName || '',
    bio: (currentUser as any).bio || '',
    logoUrl: (currentUser as any).logoUrl || '',
    aadharNumber: (currentUser as any).aadharCard?.number || '',
    aadharDocumentUrl: (currentUser as any).aadharCard?.documentUrl || '',
    panNumber: (currentUser as any).panCard?.number || '',
    panDocumentUrl: (currentUser as any).panCard?.documentUrl || '',
  });

  const [originalFormData, setOriginalFormData] = useState(formData);
  
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({ score: 0, feedback: '', meetsRequirements: false });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [uploadProgress, setUploadProgress] = useState<{ avatar: boolean; logo: boolean; aadhar: boolean; pan: boolean }>({ 
    avatar: false, 
    logo: false, 
    aadhar: false, 
    pan: false 
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const aadharInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newFormData = {
      name: currentUser.name,
      email: currentUser.email,
      mobile: currentUser.mobile,
      avatarUrl: currentUser.avatarUrl || '',
      dealershipName: (currentUser as any).dealershipName || '',
      bio: (currentUser as any).bio || '',
      logoUrl: (currentUser as any).logoUrl || '',
      aadharNumber: (currentUser as any).aadharCard?.number || '',
      aadharDocumentUrl: (currentUser as any).aadharCard?.documentUrl || '',
      panNumber: (currentUser as any).panCard?.number || '',
      panDocumentUrl: (currentUser as any).panCard?.documentUrl || '',
    };
    setFormData(newFormData);
    setOriginalFormData(newFormData);
  }, [currentUser]);

  useEffect(() => {
    const hasChanged = JSON.stringify(formData) !== JSON.stringify(originalFormData);
    setHasChanges(hasChanged);
  }, [formData, originalFormData]);

  useEffect(() => {
    if (passwordData.new) {
      setPasswordStrength(calculatePasswordStrength(passwordData.new));
    } else {
      setPasswordStrength({ score: 0, feedback: '', meetsRequirements: false });
    }
  }, [passwordData.new]);

  const validateMobile = (mobile: string): string | undefined => {
    if (!mobile.trim()) {
      return 'Mobile number is required';
    }
    // Basic phone validation (supports international formats)
    const phoneRegex = /^[\d\s\-\+\(\)]{10,15}$/;
    if (!phoneRegex.test(mobile.replace(/\s/g, ''))) {
      return 'Please enter a valid mobile number';
    }
    return undefined;
  };

  const validateName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'Name is required';
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.trim().length > 50) {
      return 'Name must be less than 50 characters';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validateAadhar = (aadhar: string): string | undefined => {
    if (!aadhar.trim()) return undefined; // Optional field
    const aadharRegex = /^\d{12}$/;
    if (!aadharRegex.test(aadhar.replace(/\s/g, ''))) {
      return 'Aadhar number must be 12 digits';
    }
    return undefined;
  };

  const validatePAN = (pan: string): string | undefined => {
    if (!pan.trim()) return undefined; // Optional field
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.toUpperCase())) {
      return 'PAN must be in format: ABCDE1234F';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    const nameError = validateName(formData.name);
    if (nameError) errors.name = nameError;

    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;

    const mobileError = validateMobile(formData.mobile);
    if (mobileError) errors.mobile = mobileError;

    if (currentUser.role === 'seller') {
      if (!formData.dealershipName.trim()) {
        errors.dealershipName = 'Dealership name is required';
      } else if (formData.dealershipName.trim().length < 2) {
        errors.dealershipName = 'Dealership name must be at least 2 characters';
      }

      if (formData.bio && formData.bio.length > 500) {
        errors.bio = 'Bio must be less than 500 characters';
      }
    }

    // Validate Aadhar and PAN if provided
    if (formData.aadharNumber) {
      const aadharError = validateAadhar(formData.aadharNumber);
      if (aadharError) errors.aadharNumber = aadharError;
    }

    if (formData.panNumber) {
      const panError = validatePAN(formData.panNumber);
      if (panError) errors.panNumber = panError;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Please upload a valid image (JPEG, PNG, WebP, or GIF)' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: 'Image size must be less than 5MB' };
    }

    return { valid: true };
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'avatar' | 'logo' | 'aadhar' | 'pan'
  ) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const validation = validateImageFile(file);

    if (!validation.valid) {
      setFormErrors(prev => ({ 
        ...prev, 
        [type]: validation.error 
      }));
      return;
    }

    setUploadProgress(prev => ({ ...prev, [type]: true }));
    setFormErrors(prev => ({ ...prev, [type]: undefined }));

    const compressAndSet = async () => {
      try {
        const dataUrl = await compressImageToDataUrl(file, {
          maxWidth: 800,
          maxHeight: 800,
          maxBytes: 300 * 1024,
          mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        });
        if (type === 'avatar') {
          setFormData(prev => ({ ...prev, avatarUrl: dataUrl }));
        } else if (type === 'logo') {
          setFormData(prev => ({ ...prev, logoUrl: dataUrl }));
        } else if (type === 'aadhar') {
          setFormData(prev => ({ ...prev, aadharDocumentUrl: dataUrl }));
        } else if (type === 'pan') {
          setFormData(prev => ({ ...prev, panDocumentUrl: dataUrl }));
        }
      } catch (err) {
        setFormErrors(prev => ({ 
          ...prev, 
          [type]: 'Failed to process image. Please try a different file.' 
        }));
      } finally {
        setUploadProgress(prev => ({ ...prev, [type]: false }));
      }
    };

    compressAndSet();
  };

  async function compressImageToDataUrl(
    file: File,
    opts: { maxWidth: number; maxHeight: number; maxBytes: number; mimeType: string }
  ): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const imgBitmap = await createImageBitmap(blob);

    const scale = Math.min(1, opts.maxWidth / imgBitmap.width, opts.maxHeight / imgBitmap.height);
    const targetWidth = Math.max(1, Math.round(imgBitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(imgBitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas not supported');
    }
    ctx.drawImage(imgBitmap, 0, 0, targetWidth, targetHeight);

    // Iteratively lower quality to fit under maxBytes
    let quality = 0.9;
    let dataUrl = canvas.toDataURL(opts.mimeType, quality);
    const maxIterations = 6;
    let iterations = 0;
    while (dataUrl.length * 0.75 > opts.maxBytes && iterations < maxIterations) {
      quality = Math.max(0.4, quality - 0.15);
      dataUrl = canvas.toDataURL(opts.mimeType, quality);
      iterations++;
    }
    return dataUrl;
  }
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (passwordError) setPasswordError('');
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset to original data
      setFormData(originalFormData);
      setFormErrors({});
      setHasChanges(false);
    }
    setIsEditing(!isEditing);
  };

  const handlePasswordEditToggle = () => {
    if (isEditingPassword) {
      // Reset password fields when canceling
      setPasswordData({ current: '', new: '', confirm: '' });
      setPasswordError('');
      setPasswordStrength({ score: 0, feedback: '', meetsRequirements: false });
    }
    setIsEditingPassword(!isEditingPassword);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const profileData: Partial<User> = {
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        avatarUrl: formData.avatarUrl,
        dealershipName: formData.dealershipName,
        bio: formData.bio,
        logoUrl: formData.logoUrl,
      };

      // Always include aadharCard data to ensure MongoDB saves it
      const existingAadhar = currentUser.aadharCard;
      profileData.aadharCard = {
        number: formData.aadharNumber || '',
        documentUrl: formData.aadharDocumentUrl || '',
        isVerified: existingAadhar?.isVerified ?? false,
        verifiedAt: existingAadhar?.verifiedAt,
        verifiedBy: existingAadhar?.verifiedBy,
        uploadedAt: formData.aadharDocumentUrl && !existingAadhar?.uploadedAt
          ? new Date().toISOString()
          : existingAadhar?.uploadedAt,
      };

      // Always include panCard data to ensure MongoDB saves it
      const existingPAN = currentUser.panCard;
      profileData.panCard = {
        number: formData.panNumber || '',
        documentUrl: formData.panDocumentUrl || '',
        isVerified: existingPAN?.isVerified ?? false,
        verifiedAt: existingPAN?.verifiedAt,
        verifiedBy: existingPAN?.verifiedBy,
        uploadedAt: formData.panDocumentUrl && !existingPAN?.uploadedAt
          ? new Date().toISOString()
          : existingPAN?.uploadedAt,
      };

      await Promise.resolve(onUpdateProfile(profileData));
      setOriginalFormData(formData);
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes. Please try again.';
      
      // Check if it's an authentication error
      if (errorMessage.includes('Authentication expired') || errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        setFormErrors(prev => ({ ...prev, general: 'Authentication expired. Please log in again and try again.' }));
      } else {
        setFormErrors(prev => ({ ...prev, general: errorMessage }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!passwordData.current) {
      setPasswordError('Current password is required');
      return;
    }

    if (!passwordStrength.meetsRequirements) {
      setPasswordError('New password does not meet requirements');
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.current === passwordData.new) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);
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
        setPasswordStrength({ score: 0, feedback: '', meetsRequirements: false });
        setIsEditingPassword(false); // Exit edit mode after successful update
      } else {
        setPasswordError('Current password is incorrect');
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
        
        setPasswordError('Your session has expired. Please log in again.');
        
        // Redirect to login after showing error message
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // Reload page to trigger login redirect
            window.location.reload();
          }
        }, 2000);
      } else {
        // For other errors, show the actual error message
        setPasswordError(errorMessage);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score === 0) return 'bg-gray-200';
    if (score === 1) return 'bg-red-500';
    if (score === 2) return 'bg-orange-500';
    if (score === 3) return 'bg-yellow-500';
    if (score === 4) return 'bg-green-500';
    return 'bg-green-600';
  };

  const [expandedSection, setExpandedSection] = useState<string | null>('personal');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-600">Manage your account settings and preferences</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Account Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                      <p className="text-sm text-gray-600 mt-1">Your basic account details</p>
                    </div>
                    {!isEditing && (
                      <button 
                        onClick={handleEditToggle}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
                        aria-label="Edit profile"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Profile
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">

                <form id="profile-form" onSubmit={handleProfileSave}>
                  {/* Enhanced Profile Picture */}
                  <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-200">
                    <div className="relative group">
                      <div className="relative">
                        <img
                          src={formData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&size=96&background=3b82f6&color=fff&bold=true`}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg transition-transform duration-200 group-hover:scale-105"
                        />
                        {uploadProgress.avatar && (
                          <div className="absolute inset-0 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      {isEditing && (
                        <>
                          <label 
                            htmlFor="avatar-upload" 
                            className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label="Upload profile picture"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </label>
                          <input 
                            id="avatar-upload" 
                            ref={avatarInputRef}
                            type="file" 
                            className="sr-only" 
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" 
                            onChange={(e) => handleImageUpload(e, 'avatar')} 
                          />
                        </>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-base">{formData.name}</p>
                      {!isEditing && (
                        <p className="text-xs text-gray-500 mt-1">{currentUser.email}</p>
                      )}
                      {formErrors.avatar && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.avatar}</p>
                      )}
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                    <ProfileInput
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="Enter your full name"
                      error={formErrors.name}
                      maxLength={50}
                      required
                    />
                    
                    <ProfileInput
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="your.email@example.com"
                      error={formErrors.email}
                      required
                    />
                    
                    <ProfileInput
                      label="Mobile Number"
                      name="mobile"
                      type="tel"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="+91-98765-43210"
                      error={formErrors.mobile}
                      required
                    />

                    {currentUser.role === 'seller' && (
                      <>
                        {/* Seller Share Link & QR Code */}
                        <div className="md:col-span-2 p-5 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-900">Seller Share Link & QR</h3>
                          </div>
                          {(() => {
                            const origin = typeof window !== 'undefined' ? window.location.origin : '';
                            const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                <div className="md:col-span-2">
                                  <label className="text-xs text-gray-500">Public seller URL</label>
                                  <div className="mt-1 flex">
                                    <input
                                      type="text"
                                      readOnly
                                      value={shareUrl}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                                      className="px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-2">Share this link or the QR code to showcase your seller profile and listings.</p>
                                </div>
                                <div className="flex flex-col items-center">
                                  <img src={qrUrl} alt="Seller QR code" className="w-40 h-40 border rounded-lg bg-white" />
                                  <a
                                    href={qrUrl}
                                    download={`seller-qr-${(currentUser.dealershipName || currentUser.name || 'profile').toString().replace(/\\s+/g,'-')}.png`}
                                    className="mt-2 text-xs text-blue-600 hover:underline"
                                  >
                                    Download QR
                                  </a>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="md:col-span-2">
                          <ProfileInput
                            label="Dealership Name"
                            name="dealershipName"
                            value={formData.dealershipName}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            placeholder="Enter dealership name"
                            error={formErrors.dealershipName}
                            maxLength={50}
                            required
                          />
                        </div>
                        
                        {/* Dealership Logo - Use same as profile picture for sellers */}
                        {isEditing && (
                        <div className="md:col-span-2 space-y-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                            <label className="text-sm font-semibold text-gray-700">Dealership Logo (Optional)</label>
                            <div className="flex items-center space-x-4">
                              <div className="relative">
                                <img
                                  src={formData.logoUrl || formData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.dealershipName || 'Logo')}&size=80&background=6366f1&color=fff&bold=true`}
                                  alt="Dealership Logo"
                                className="w-14 h-14 rounded-lg object-cover border-2 border-gray-200 shadow-sm"
                                />
                                {uploadProgress.logo && (
                                  <div className="absolute inset-0 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div>
                                <label 
                                  htmlFor="logo-upload" 
                                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-all duration-200 border border-indigo-200 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  Upload Logo
                                </label>
                                <input 
                                  id="logo-upload" 
                                  ref={logoInputRef}
                                  type="file" 
                                  className="sr-only" 
                                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" 
                                  onChange={(e) => handleImageUpload(e, 'logo')} 
                                />
                                <p className="text-xs text-gray-500 mt-2">JPEG, PNG, WebP, or GIF (Max 5MB)</p>
                              </div>
                              {formErrors.logo && (
                                <p className="text-xs text-red-600">{formErrors.logo}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Enhanced Bio */}
                        <div className="md:col-span-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-700">About Your Dealership</label>
                            <span className={`text-xs ${(formData.bio?.length || 0) > 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                              {formData.bio?.length || 0}/500
                            </span>
                          </div>
                          <textarea
                            name="bio"
                            value={formData.bio}
                            onChange={handleInputChange}
                            disabled={!isEditing}
                            rows={3}
                            maxLength={500}
                            className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed resize-none ${
                              formErrors.bio 
                                ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-300 bg-white hover:border-gray-400'
                            }`}
                            placeholder="Tell customers about your dealership, specialties, and what makes you unique..."
                            aria-invalid={formErrors.bio ? 'true' : 'false'}
                            aria-describedby={formErrors.bio ? 'bio-error' : undefined}
                          />
                          {formErrors.bio && (
                            <p id="bio-error" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {formErrors.bio}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Document Verification Section */}
                    <div className="md:col-span-2 pt-6 mt-6 border-t border-gray-200">
                      <div 
                        className="flex items-center justify-between cursor-pointer mb-4"
                        onClick={() => setExpandedSection(expandedSection === 'documents' ? null : 'documents')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Document Verification</h3>
                            <p className="text-sm text-gray-600">Upload Aadhar Card and PAN Card</p>
                          </div>
                        </div>
                        <svg 
                          className={`w-5 h-5 text-gray-600 transition-transform ${expandedSection === 'documents' ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      
                      {expandedSection === 'documents' && (
                        <div className="space-y-6">
                          {/* Aadhar Card */}
                          <div className="space-y-4 p-5 rounded-xl border border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-700">Aadhar Card</label>
                          {(currentUser as any).aadharCard?.isVerified && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                        <ProfileInput
                          label="Aadhar Number"
                          name="aadharNumber"
                          value={formData.aadharNumber || ''}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          placeholder="1234 5678 9012"
                          error={formErrors.aadharNumber}
                          maxLength={12}
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700">Aadhar Card Document</label>
                          <div className="flex items-center space-x-4">
                            {formData.aadharDocumentUrl && (
                              <div className="relative">
                                {/^data:application\/pdf|\.pdf(\?|$)/i.test(formData.aadharDocumentUrl)
                                  ? (
                                    <iframe
                                      src={formData.aadharDocumentUrl}
                                      title="Aadhar Document"
                                      className="w-40 h-40 border-2 border-gray-200 rounded-lg shadow-sm"
                                    />
                                  ) : (
                                    <img
                                      src={formData.aadharDocumentUrl}
                                      alt="Aadhar Card"
                                      className="w-24 h-32 object-cover border-2 border-gray-200 rounded-lg shadow-sm"
                                    />
                                  )
                                }
                                {uploadProgress.aadhar && (
                                  <div className="absolute inset-0 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  </div>
                                )}
                                <a
                                  href={formData.aadharDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute -bottom-2 left-0 text-xs bg-white px-1 rounded shadow border hover:underline"
                                >
                                  View Document
                                </a>
                              </div>
                            )}
                            {isEditing && (
                              <div>
                                <label 
                                  htmlFor="aadhar-upload" 
                                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-all duration-200 border border-blue-200 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  {formData.aadharDocumentUrl ? 'Change Document' : 'Upload Document'}
                                </label>
                                <input 
                                  id="aadhar-upload" 
                                  ref={aadharInputRef}
                                  type="file" 
                                  className="sr-only" 
                                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" 
                                  onChange={(e) => handleImageUpload(e, 'aadhar')} 
                                />
                                <p className="text-xs text-gray-500 mt-2">JPEG, PNG, PDF (Max 5MB)</p>
                              </div>
                            )}
                          </div>
                          {formErrors.aadharCard && (
                            <p className="text-xs text-red-600">{formErrors.aadharCard}</p>
                          )}
                        </div>
                      </div>

                      {/* PAN Card */}
                      <div className="space-y-4 p-5 rounded-xl border border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-700">PAN Card</label>
                          {(currentUser as any).panCard?.isVerified && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                        <ProfileInput
                          label="PAN Number"
                          name="panNumber"
                          value={(formData.panNumber || '').toUpperCase()}
                          onChange={(e) => {
                            const upperValue = e.target.value.toUpperCase();
                            setFormData(prev => ({ ...prev, panNumber: upperValue }));
                            if (formErrors.panNumber) {
                              setFormErrors(prev => ({ ...prev, panNumber: undefined }));
                            }
                          }}
                          disabled={!isEditing}
                          placeholder="ABCDE1234F"
                          error={formErrors.panNumber}
                          maxLength={10}
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700">PAN Card Document</label>
                          <div className="flex items-center space-x-4">
                            {formData.panDocumentUrl && (
                              <div className="relative">
                                {/^data:application\/pdf|\.pdf(\?|$)/i.test(formData.panDocumentUrl)
                                  ? (
                                    <iframe
                                      src={formData.panDocumentUrl}
                                      title="PAN Document"
                                      className="w-40 h-40 border-2 border-gray-200 rounded-lg shadow-sm"
                                    />
                                  ) : (
                                    <img
                                      src={formData.panDocumentUrl}
                                      alt="PAN Card"
                                      className="w-24 h-32 object-cover border-2 border-gray-200 rounded-lg shadow-sm"
                                    />
                                  )
                                }
                                {uploadProgress.pan && (
                                  <div className="absolute inset-0 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  </div>
                                )}
                                <a
                                  href={formData.panDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute -bottom-2 left-0 text-xs bg-white px-1 rounded shadow border hover:underline"
                                >
                                  View Document
                                </a>
                              </div>
                            )}
                            {isEditing && (
                              <div>
                                <label 
                                  htmlFor="pan-upload" 
                                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-all duration-200 border border-blue-200 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  {formData.panDocumentUrl ? 'Change Document' : 'Upload Document'}
                                </label>
                                <input 
                                  id="pan-upload" 
                                  ref={panInputRef}
                                  type="file" 
                                  className="sr-only" 
                                  accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf" 
                                  onChange={(e) => handleImageUpload(e, 'pan')} 
                                />
                                <p className="text-xs text-gray-500 mt-2">JPEG, PNG, PDF (Max 5MB)</p>
                              </div>
                            )}
                          </div>
                          {formErrors.panCard && (
                            <p className="text-xs text-red-600">{formErrors.panCard}</p>
                          )}
                        </div>
                      </div>
                    </div>
                      )}
                    </div>
                  </div>

                  {formErrors.general && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{formErrors.general}</p>
                    </div>
                  )}
                </form>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Password & Actions */}
            <div className="space-y-6">
              {/* Change Password Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                      <p className="text-sm text-gray-600 mt-1">Update your account password</p>
                    </div>
                    {!isEditingPassword && (
                      <button 
                        onClick={handlePasswordEditToggle}
                        className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
                        aria-label="Edit password"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6">
                  {isEditingPassword ? (
                    <form onSubmit={handlePasswordSave}>
                      <div className="space-y-5">
                        <PasswordInput
                          label="Current Password"
                          name="current"
                          value={passwordData.current}
                          onChange={handlePasswordChange}
                          placeholder="Enter current password"
                          disabled={!isEditingPassword}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                      
                      <div className="space-y-2">
                        <PasswordInput
                          label="New Password"
                          name="new"
                          value={passwordData.new}
                          onChange={handlePasswordChange}
                          placeholder="Enter new password"
                          disabled={!isEditingPassword}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                        
                        {/* Password Strength Indicator */}
                        {passwordData.new && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <div
                                  key={level}
                                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                    passwordStrength.score >= level
                                      ? getPasswordStrengthColor(passwordStrength.score)
                                      : 'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className={`text-xs font-medium ${
                              passwordStrength.score >= 4 
                                ? 'text-green-600' 
                                : passwordStrength.score >= 2 
                                  ? 'text-yellow-600' 
                                  : 'text-red-600'
                            }`}>
                              {passwordStrength.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                      
                        <PasswordInput
                          label="Confirm New Password"
                          name="confirm"
                          value={passwordData.confirm}
                          onChange={handlePasswordChange}
                          placeholder="Confirm new password"
                          disabled={!isEditingPassword}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                      
                      {passwordData.confirm && passwordData.new && passwordData.confirm !== passwordData.new && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Passwords do not match
                        </p>
                      )}
                      
                      {passwordError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {passwordError}
                          </p>
                        </div>
                      )}
                    </div>
                    
                        <div className="mt-6 pt-6 border-t border-gray-200 flex gap-3">
                          <button 
                            type="button"
                            onClick={handlePasswordEditToggle}
                            disabled={isChangingPassword}
                            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={
                              !passwordData.current || 
                              !passwordData.new || 
                              !passwordData.confirm || 
                              !passwordStrength.meetsRequirements ||
                              passwordData.new !== passwordData.confirm ||
                              isChangingPassword
                            }
                            className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md" 
                          >
                            {isChangingPassword ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Updating...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Update Password
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">Click "Edit" to change your password</p>
                      </div>
                    )}
                </div>
              </div>

              {/* Action Buttons Card */}
              {isEditing && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 space-y-3">
                    {formErrors.general && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{formErrors.general}</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-3">
                      <button 
                        type="button" 
                        onClick={handleEditToggle}
                        disabled={isSaving}
                        className="w-full px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        form="profile-form"
                        disabled={isSaving || !hasChanges}
                        className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                      >
                        {isSaving ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
