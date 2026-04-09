import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, User } from '../types';
import { login, register } from '../services/userService';
import { signInWithGoogle, syncWithBackend } from '../services/authService';
import { getSupabaseClient } from '../lib/supabase.js';
import OTPLogin from './OTPLogin';
import PasswordInput from './PasswordInput';
import Logo from './Logo';
import useIsMobileApp from '../hooks/useIsMobileApp';

interface UnifiedLoginProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onNavigate: (view: View) => void;
  onForgotPassword: () => void;
  allowedRoles?: UserRole[];
  forcedRole?: UserRole;
  hideRolePicker?: boolean;
}

type UserRole = 'customer' | 'seller' | 'admin' | 'service_provider';
type AuthMode = 'login' | 'register' | 'otp';

const UnifiedLogin: React.FC<UnifiedLoginProps> = ({ 
  onLogin, 
  onRegister, 
  onNavigate, 
  onForgotPassword,
  allowedRoles = ['customer', 'seller', 'service_provider'],
  forcedRole,
  hideRolePicker
}) => {
  const { t, i18n } = useTranslation();
  const { isMobileApp } = useIsMobileApp();
  const initialRole: UserRole | null =
    forcedRole ?? (allowedRoles.length === 1 ? (allowedRoles[0] as UserRole) : null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [showGoogleRolePicker, setShowGoogleRolePicker] = useState(false);
  const [oauthPickLoading, setOauthPickLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleConfig = useMemo(
    () => ({
      customer: {
        title: t('auth.role.customer.title'),
        description: t('auth.role.customer.description'),
        icon: '🛒',
        color: 'bg-blue-500',
        loginTitle: t('auth.role.customer.loginTitle'),
        registerTitle: t('auth.role.customer.registerTitle'),
      },
      seller: {
        title: t('auth.role.seller.title'),
        description: t('auth.role.seller.description'),
        icon: '🏪',
        color: 'bg-green-500',
        loginTitle: t('auth.role.seller.loginTitle'),
        registerTitle: t('auth.role.seller.registerTitle'),
      },
      admin: {
        title: t('auth.role.admin.title'),
        description: t('auth.role.admin.description'),
        icon: '⚙️',
        color: 'bg-purple-500',
        loginTitle: t('auth.role.admin.loginTitle'),
        registerTitle: t('auth.role.admin.registerTitle'),
      },
      service_provider: {
        title: t('auth.role.service_provider.title'),
        description: t('auth.role.service_provider.description'),
        icon: '🛠️',
        color: 'bg-blue-500',
        loginTitle: t('auth.role.service_provider.loginTitle'),
        registerTitle: t('auth.role.service_provider.registerTitle'),
      },
    }),
    [t, i18n.language]
  );

  const registerRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'customer':
        return t('auth.roleRegister.customer');
      case 'seller':
        return t('auth.roleRegister.seller');
      case 'service_provider':
        return t('auth.roleRegister.service');
      case 'admin':
        return t('auth.roleRegister.admin');
      default: {
        const _exhaustiveCheck: never = role;
        return String(_exhaustiveCheck);
      }
    }
  };

  useEffect(() => {
    if (!selectedRole) {
      setEmail('');
      setRememberMe(false);
      return;
    }
    const rememberedEmail = localStorage.getItem(
      `remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`,
    );
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setRememberMe(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('reride_oauth_pick_role') === '1') {
        setShowGoogleRolePicker(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const canUseGoogle =
    selectedRole === 'customer' ||
    selectedRole === 'seller' ||
    selectedRole === 'service_provider';
  const canUseOtp = selectedRole === 'customer' || selectedRole === 'seller';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parseUrlParams = () => {
      const fromSearch = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      const hashQueryIndex = hash.indexOf('?');
      const fromHash =
        hashQueryIndex >= 0
          ? new URLSearchParams(hash.slice(hashQueryIndex + 1))
          : new URLSearchParams();

      const getParam = (key: string): string =>
        fromSearch.get(key) || fromHash.get(key) || '';

      return {
        type: getParam('type'),
        error: getParam('error'),
        errorDescription: getParam('error_description'),
        accessToken: getParam('access_token'),
      };
    };

    const { type, error: authError, errorDescription, accessToken } = parseUrlParams();

    if (authError) {
      setSuccessMessage('');
      setError(
        decodeURIComponent(errorDescription || authError).replace(/\+/g, ' ')
      );
      return;
    }

    if (mode === 'login' && (type === 'signup' || (type === 'recovery' && accessToken))) {
      setSuccessMessage('Email confirmed successfully. Please sign in to continue.');
      try {
        const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash.split('?')[0] || ''}`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch {
        /* ignore */
      }
    }
  }, [mode]);

  const completeGoogleRolePick = async (role: 'customer' | 'seller') => {
    setOauthPickLoading(true);
    setError('');
    try {
      try {
        sessionStorage.removeItem('reride_oauth_pick_role');
      } catch {
        /* ignore */
      }
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setError(t('auth.error.googleSignInFailed'));
        await supabase.auth.signOut();
        setShowGoogleRolePicker(false);
        return;
      }
      const result = await syncWithBackend(
        session.user as unknown as Record<string, unknown>,
        role,
        'google',
      );
      if (result.success && result.user) {
        setShowGoogleRolePicker(false);
        onLogin(result.user);
      } else {
        setError(result.reason || t('auth.error.googleSignInFailed'));
      }
    } catch {
      setError(t('auth.error.googleSignInFailed'));
    } finally {
      setOauthPickLoading(false);
    }
  };

  const cancelGoogleRolePick = async () => {
    try {
      sessionStorage.removeItem('reride_oauth_pick_role');
    } catch {
      /* ignore */
    }
    setShowGoogleRolePicker(false);
    try {
      await getSupabaseClient().auth.signOut();
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!selectedRole) {
        throw new Error(t('auth.error.selectAccountType'));
      }
      let result: { success: boolean, user?: User, reason?: string, detectedRole?: string };

      if (mode === 'login') {
        if (!email || !password) throw new Error(t('auth.error.emailPasswordRequired'));
        // Prevent submit for service provider placeholder
        if (selectedRole === 'service_provider') {
          onNavigate(View.CAR_SERVICE_LOGIN);
          return;
        }
        result = await login({ email, password, role: selectedRole });
      } else {
        if (!name || !mobile || !email || !password) throw new Error(t('auth.error.registerFieldsRequired'));
        // Prevent register for service provider placeholder
        if (selectedRole === 'service_provider') {
          onNavigate(View.CAR_SERVICE_LOGIN);
          return;
        }
        result = await register({ name, email, password, mobile, role: selectedRole });
      }

      if (result.success && result.user) {
        if (mode === 'login') {
          if (rememberMe) {
            localStorage.setItem(`remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`, email);
          } else {
            localStorage.removeItem(`remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`);
          }
          onLogin(result.user);
        } else {
          onRegister(result.user);
        }
      } else {
        // Check if user is a service provider trying to login through regular form
        const errorMessage = result.reason || t('auth.error.unknown');
        const isServiceProvider = (result as any).isServiceProvider;
        
        if (isServiceProvider) {
          // Redirect to service provider login page
          setError(t('auth.error.serviceProviderLogin'));
          setTimeout(() => {
            onNavigate(View.CAR_SERVICE_LOGIN);
          }, 2000);
          return;
        }
        
        // Check if error includes detected role hint
        const detectedRole = result.detectedRole;
        if (detectedRole && allowedRoles.includes(detectedRole as UserRole)) {
          // Auto-switch to detected role and show helpful message
          setSelectedRole(detectedRole as UserRole);
          const dr = detectedRole as UserRole;
          setError(
            t('auth.error.selectRoleTryAgain', {
              roleLabel: roleConfig[dr]?.title ?? detectedRole,
            })
          );
        } else {
          throw new Error(errorMessage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.failedAuthenticate'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (!selectedRole) {
        throw new Error(t('auth.error.selectAccountType'));
      }
      // Google sign-in is not available for admin
      if (selectedRole === 'admin') {
        throw new Error(t('auth.error.googleNotAdmin'));
      }

      const result = await signInWithGoogle();

      // Supabase OAuth is redirect-based: API returns a URL to Google, not a user object.
      const redirectUrl =
        result.user &&
        typeof result.user === 'object' &&
        'redirectUrl' in result.user &&
        typeof (result.user as { redirectUrl?: string }).redirectUrl === 'string'
          ? (result.user as { redirectUrl: string }).redirectUrl
          : null;

      if (result.success && redirectUrl) {
        try {
          sessionStorage.setItem('reride_oauth_role', selectedRole);
        } catch {
          /* ignore */
        }
        window.location.assign(redirectUrl);
        return;
      }

      if (result.success && !redirectUrl) {
        try {
          sessionStorage.setItem('reride_oauth_role', selectedRole);
        } catch {
          /* ignore */
        }
        return;
      }

      throw new Error(result.reason || t('auth.error.googleFailed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.googleSignInFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setError('');
    setName('');
    setMobile('');
    setPassword('');
    setMode(prev => prev === 'login' ? 'register' : 'login');
  };

  const handleRoleChange = (role: UserRole) => {
    if (forcedRole) return;
    setSelectedRole(role);
    setError('');
    // Only clear form fields if we're in login mode
    // During registration, keep the form data so user doesn't lose their input
    if (mode === 'login') {
      setName('');
      setMobile('');
      setPassword('');
    }
    // Don't change the mode - keep it as is (login or register)
  };

  const isLogin = mode === 'login';

  const googleRolePickerOverlay =
    showGoogleRolePicker ? (
      <div
        className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oauth-pick-role-title"
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-gray-100">
          <h3 id="oauth-pick-role-title" className="text-lg font-bold text-gray-900">
            {t('auth.oauthPickRoleTitle')}
          </h3>
          <p className="text-sm text-gray-600">{t('auth.oauthPickRoleBody')}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={oauthPickLoading}
              onClick={() => void completeGoogleRolePick('customer')}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {roleConfig.customer.title}
            </button>
            <button
              type="button"
              disabled={oauthPickLoading}
              onClick={() => void completeGoogleRolePick('seller')}
              className="flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {roleConfig.seller.title}
            </button>
          </div>
          <button
            type="button"
            disabled={oauthPickLoading}
            onClick={() => void cancelGoogleRolePick()}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t('auth.oauthPickRoleSignOut')}
          </button>
        </div>
      </div>
    ) : null;

  // Premium form input styling with glassmorphism and depth
  const formInputClass = "w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 bg-white/80 backdrop-blur-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white focus:shadow-lg transition-all duration-300 text-sm font-medium";
  const mobileFormInputClass = "w-full px-4 py-3.5 text-sm bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white focus:shadow-lg transition-all duration-300 font-medium";
  const selectInputClass = "w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-900 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:bg-white focus:shadow-lg transition-all duration-300 text-sm cursor-pointer font-medium";

  // Handle OTP mode
  if (mode === 'otp') {
    // OTP login is only available for customer and seller roles
    if (selectedRole === 'admin') {
      return (
        <>
          {googleRolePickerOverlay}
          <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('auth.otpNotAvailableTitle')}</h2>
              <p className="text-gray-600 mb-6">{t('auth.otpNotAvailableBody')}</p>
              <button
                onClick={() => setMode('login')}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (!selectedRole) {
      return (
        <>
          {googleRolePickerOverlay}
          <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('auth.error.selectAccountType')}</h2>
              <p className="text-gray-600 mb-6 text-sm">{t('auth.googleRequiresCustomerOrSeller')}</p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (selectedRole === 'service_provider') {
      return (
        <>
          {googleRolePickerOverlay}
          <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('auth.otpNotAvailableServiceProviderTitle')}</h2>
              <p className="text-gray-600 mb-6 text-sm">{t('auth.otpNotAvailableServiceProviderBody')}</p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {t('auth.backToLogin')}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (isMobileApp) {
      return (
        <>
          {googleRolePickerOverlay}
          <div
            className="w-full min-h-screen flex items-center justify-center p-6"
            style={{
              background: 'linear-gradient(180deg, #6366F1 0%, #8B5CF6 40%, #A855F7 70%, #EC4899 100%)',
            }}
          >
            <div className="w-full max-w-md">
              <OTPLogin
                onLogin={onLogin}
                role={selectedRole as 'customer' | 'seller'}
                onCancel={() => setMode('login')}
              />
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        {googleRolePickerOverlay}
        <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
          <OTPLogin
            onLogin={onLogin}
            role={selectedRole as 'customer' | 'seller'}
            onCancel={() => setMode('login')}
          />
        </div>
      </>
    );
  }

  // Mobile App UI - Premium Design
  if (isMobileApp) {
    return (
      <>
        {googleRolePickerOverlay}
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8 px-4"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradient 15s ease infinite'
        }}>
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6"
            style={{
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}>
            {/* Logo and Title - Premium Design */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-purple-600 rounded-xl blur-md opacity-50"></div>
                  <div className="relative bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg">
                    <Logo 
                      className="scale-100" 
                      showText={true}
                      onClick={() => onNavigate(View.USED_CARS)}
                    />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-1">
                {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-600">
                {isLogin ? t('auth.signInContinue') : t('auth.getStarted')}
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Role Selection Dropdown - Show during both login and registration */}
              {!hideRolePicker && !forcedRole && allowedRoles.length > 1 && (
                <div>
                  <label htmlFor="mobile-account-type" className="block text-sm font-semibold text-gray-700 mb-2">
                    {isLogin ? t('auth.accountType') : t('auth.iWantTo')} <span className="text-orange-600">*</span>
                  </label>
                  <select
                    id="mobile-account-type"
                    name="account-type"
                    value={selectedRole ?? ''}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className={mobileFormInputClass}
                    required
                  >
                    <option value="" disabled>
                      {t('auth.selectAccountTypePlaceholder')}
                    </option>
                    {allowedRoles.map((role) => {
                      const displayText = isLogin
                        ? roleConfig[role].title
                        : registerRoleLabel(role);
                      return (
                        <option key={role} value={role}>
                          {displayText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="mobile-name" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('auth.fullName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mobile-name"
                      type="text"
                      autoComplete="name"
                      required
                      className={mobileFormInputClass}
                      placeholder={t('auth.placeholder.fullName')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="mobile-tel" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t('auth.mobileNumber')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mobile-tel"
                      type="tel"
                      autoComplete="tel"
                      required
                      className={mobileFormInputClass}
                      placeholder={t('auth.placeholder.mobile')}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="mobile-email" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('auth.emailAddress')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="mobile-email"
                  type="email"
                  autoComplete="email"
                  required
                  className={mobileFormInputClass}
                  placeholder={t('auth.placeholder.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="mobile-password" className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('auth.password')} <span className="text-red-500">*</span>
                </label>
                <PasswordInput
                  id="mobile-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.placeholder.password')}
                  className={mobileFormInputClass}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  showLabel={false}
                />
              </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center cursor-pointer">
                  <input
                    id="mobile-remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-2 text-gray-700">{t('auth.rememberMe')}</span>
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && !error && (
              <div className="bg-green-50 border-l-4 border-green-500 rounded-md p-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-4 px-6 border border-transparent rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FF6B35 100%)',
                backgroundSize: '200% 200%',
                boxShadow: '0 10px 25px rgba(255, 107, 53, 0.4)'
              }}
            >
              <span className="relative z-10 flex items-center">
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('auth.processing')}
                  </>
                ) : (
                  <>
                    {isLogin ? t('auth.signIn') : t('auth.createAccount')}
                    <svg className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Social Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/95 backdrop-blur-sm text-gray-500 font-medium">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || !canUseGoogle}
                title={!canUseGoogle ? t('auth.googleRequiresCustomerOrSeller') : undefined}
                className="group w-full inline-flex justify-center items-center py-3 px-4 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm text-sm font-semibold text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-300 disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.google')}
              </button>

              <button
                type="button"
                onClick={() => setMode('otp')}
                disabled={isLoading || !canUseOtp}
                title={!canUseOtp ? t('auth.otpRequiresCustomerOrSeller') : undefined}
                className="group w-full inline-flex justify-center items-center py-3 px-4 border-2 border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm text-sm font-semibold text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-300 disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {t('auth.phoneOtp')}
              </button>
            </div>
          </div>

          {/* Toggle between Login and Register */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
              <button
                type="button"
                onClick={toggleMode}
                className="font-semibold text-orange-600 hover:text-orange-700"
              >
                {isLogin ? t('auth.createAccount') : t('auth.signIn')}
              </button>
            </p>
          </div>

          {/* Guest Access */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => onNavigate(View.USED_CARS)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('auth.continueGuest')}
            </button>
          </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Desktop UI - Premium Design
  return (
    <>
      {googleRolePickerOverlay}
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)',
        backgroundSize: '400% 400%',
        animation: 'gradient 15s ease infinite'
      }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10"
          style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
          }}>
          {/* Logo and Title - Premium Design */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-purple-600 rounded-2xl blur-lg opacity-50 animate-pulse"></div>
                <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
                  <Logo 
                    className="scale-110" 
                    showText={true}
                    onClick={() => onNavigate(View.USED_CARS)}
                  />
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-2">
              {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-600">
              {isLogin ? t('auth.signInContinueAccount') : t('auth.getStartedToday')}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Role Selection Dropdown - Show during both login and registration */}
            {!hideRolePicker && !forcedRole && allowedRoles.length > 1 && (
              <div>
                <label htmlFor="account-type" className="block text-sm font-semibold text-gray-700 mb-2">
                  {isLogin ? t('auth.accountType') : t('auth.iWantTo')} <span className="text-orange-600">*</span>
                </label>
                <select
                  id="account-type"
                  name="account-type"
                  value={selectedRole ?? ''}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className={selectInputClass}
                  required
                >
                  <option value="" disabled>
                    {t('auth.selectAccountTypePlaceholder')}
                  </option>
                  {allowedRoles.map((role) => {
                    const displayText = isLogin
                      ? roleConfig[role].title
                      : registerRoleLabel(role);
                    return (
                      <option key={role} value={role}>
                        {displayText}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {!isLogin && (
              <>
                <div>
                  <label htmlFor="full-name" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.fullName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="full-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    className={formInputClass}
                    placeholder={t('auth.placeholder.fullName')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="mobile-number" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('auth.mobileNumber')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="mobile-number"
                    name="mobile"
                    type="tel"
                    autoComplete="tel"
                    required
                    className={formInputClass}
                    placeholder={t('auth.placeholder.mobile')}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('auth.emailAddress')} <span className="text-red-500">*</span>
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={formInputClass}
                placeholder={t('auth.placeholder.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                {t('auth.password')} <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.placeholder.password')}
                className={formInputClass}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                showLabel={false}
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center cursor-pointer">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
                  />
                  <span className="ml-2 text-gray-700">{t('auth.rememberMe')}</span>
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {successMessage && !error && (
              <div className="bg-green-50 border-l-4 border-green-500 rounded-md p-4">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.processing')}
                </span>
              ) : (
                isLogin ? t('auth.signIn') : t('auth.createAccount')
              )}
            </button>
          </form>

          {/* Social Login Options */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/95 backdrop-blur-sm text-gray-500 font-medium">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || !canUseGoogle}
                title={!canUseGoogle ? t('auth.googleRequiresCustomerOrSeller') : undefined}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('auth.google')}
              </button>

              <button
                type="button"
                onClick={() => setMode('otp')}
                disabled={isLoading || !canUseOtp}
                title={!canUseOtp ? t('auth.otpRequiresCustomerOrSeller') : undefined}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {t('auth.phoneOtp')}
              </button>
            </div>
          </div>

          {/* Toggle between Login and Register */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
              <button
                type="button"
                onClick={toggleMode}
                className="font-semibold text-orange-600 hover:text-orange-700"
              >
                {isLogin ? t('auth.createAccount') : t('auth.signIn')}
              </button>
            </p>
          </div>

          {/* Guest Access */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => onNavigate(View.USED_CARS)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('auth.continueGuest')}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UnifiedLogin;
