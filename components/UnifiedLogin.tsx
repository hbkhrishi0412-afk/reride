import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, User } from '../types';
import { login, register } from '../services/userService';
import { signInWithGoogle, syncWithBackend } from '../services/authService';
import { signInWithEmail } from '../services/supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase.js';
import { setRememberMePreference } from '../utils/rememberMe';
import OTPLogin from './OTPLogin';
import PasswordInput from './PasswordInput';
import Logo from './Logo';
import useIsMobileApp from '../hooks/useIsMobileApp';
import { clearSupabaseAuthStorage } from '../utils/authStorage';

interface UnifiedLoginProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onNavigate: (view: View) => void;
  onForgotPassword: () => void;
  /** Completes car-services dashboard login (Supabase + /api/service-providers); parent sets provider state and navigates. */
  onServiceProviderLogin?: (provider: Record<string, unknown>) => void;
  allowedRoles?: UserRole[];
  forcedRole?: UserRole;
  hideRolePicker?: boolean;
}

type UserRole = 'customer' | 'seller' | 'admin' | 'service_provider';
type AuthMode = 'login' | 'register' | 'otp';

async function loginServiceProviderWithEmail(
  email: string,
  password: string,
): Promise<{ ok: true; provider: Record<string, unknown> } | { ok: false; message: string }> {
  const result = await signInWithEmail(email, password);
  if (!result.success || !result.session) {
    return { ok: false, message: result.reason || 'Login failed' };
  }

  const loadProviderDirectly = async (): Promise<Record<string, unknown> | null> => {
    try {
      const supabase = getSupabaseClient();
      const uid = result.session?.user?.id;
      if (uid) {
        const { data: byId } = await supabase
          .from('service_providers')
          .select('*')
          .eq('id', uid)
          .maybeSingle();
        if (byId) return byId as Record<string, unknown>;
      }
      const { data: byEmail } = await supabase
        .from('service_providers')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
      return (byEmail as Record<string, unknown> | null) ?? null;
    } catch {
      return null;
    }
  };

  let resp: Response;
  try {
    resp = await fetch('/api/service-providers', {
      method: 'GET',
      headers: { Authorization: `Bearer ${result.session.access_token}` },
    });
  } catch {
    const provider = await loadProviderDirectly();
    if (provider) return { ok: true, provider };
    return { ok: false, message: 'Unable to reach service provider API. Start local API server or try again.' };
  }

  if (!resp.ok) {
    // If the API errors (4xx/5xx) but Supabase client can read service_providers, still complete login.
    const provider = await loadProviderDirectly();
    if (provider) return { ok: true, provider };
    const data = (await resp.json().catch(() => ({}))) as { error?: string };
    if (resp.status === 404) {
      return {
        ok: false,
        message: 'No service provider profile found for this account. Contact admin.',
      };
    }
    return { ok: false, message: data.error || 'Failed to load provider profile' };
  }
  const provider = (await resp.json()) as Record<string, unknown>;
  return { ok: true, provider };
}

const UnifiedLogin: React.FC<UnifiedLoginProps> = ({ 
  onLogin, 
  onRegister, 
  onNavigate, 
  onForgotPassword,
  onServiceProviderLogin,
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
      const raw = errorDescription || authError;
      let readable = raw;
      try {
        readable = decodeURIComponent(raw).replace(/\+/g, ' ');
      } catch {
        readable = raw.replace(/\+/g, ' ');
      }
      setError(readable);
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
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } finally {
          clearSupabaseAuthStorage();
        }
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
      await getSupabaseClient().auth.signOut({ scope: 'local' });
    } catch {
      /* ignore */
    } finally {
      clearSupabaseAuthStorage();
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
        if (selectedRole === 'service_provider') {
          if (!onServiceProviderLogin) {
            throw new Error(t('auth.error.failedAuthenticate'));
          }
          const sp = await loginServiceProviderWithEmail(email, password);
          if (!sp.ok) {
            throw new Error(sp.message);
          }
          if (rememberMe) {
            localStorage.setItem(
              `remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`,
              email,
            );
          } else {
            localStorage.removeItem(
              `remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`,
            );
          }
          setRememberMePreference(rememberMe);
          onServiceProviderLogin(sp.provider);
          return;
        }
        result = await login({ email, password, role: selectedRole });
      } else {
        if (!name || !mobile || !email || !password) throw new Error(t('auth.error.registerFieldsRequired'));
        // Service provider signup uses extended fields on the car-services page
        if (selectedRole === 'service_provider') {
          try {
            sessionStorage.setItem('reride_car_service_auth_mode', 'signup');
          } catch {
            /* ignore storage errors */
          }
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
          setRememberMePreference(rememberMe);
          onLogin(result.user);
        } else {
          setRememberMePreference(true);
          onRegister(result.user);
        }
      } else {
        const errorMessage = result.reason || t('auth.error.unknown');
        if (
          onServiceProviderLogin &&
          /service provider login page/i.test(errorMessage) &&
          email &&
          password
        ) {
          const sp = await loginServiceProviderWithEmail(email, password);
          if (sp.ok) {
            setSelectedRole('service_provider');
            const spKey = `remembered${'service_provider'.charAt(0).toUpperCase() + 'service_provider'.slice(1)}Email`;
            if (rememberMe) {
              localStorage.setItem(spKey, email);
            } else {
              localStorage.removeItem(spKey);
            }
            setRememberMePreference(rememberMe);
            onServiceProviderLogin(sp.provider);
            return;
          }
          setError(sp.message);
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

      try {
        sessionStorage.setItem('reride_oauth_role', selectedRole);
        localStorage.setItem('reride_oauth_role', selectedRole);
      } catch {
        /* ignore */
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

      if (!result.success) {
        try {
          sessionStorage.removeItem('reride_oauth_role');
          localStorage.removeItem('reride_oauth_role');
        } catch {
          /* ignore */
        }
        throw new Error(result.reason || t('auth.error.googleFailed'));
      }

      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      return;
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

    // Service providers should use the dedicated car-services auth page.
    // In register mode, redirect immediately to avoid showing two signup pages.
    if (mode === 'register' && role === 'service_provider') {
      try {
        sessionStorage.setItem('reride_car_service_auth_mode', 'signup');
      } catch {
        /* ignore storage errors */
      }
      onNavigate(View.CAR_SERVICE_LOGIN);
      return;
    }

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

  const accountTypeButtonGroup = (layout: 'mobile' | 'desktop') => {
    if (hideRolePicker || forcedRole || allowedRoles.length <= 1) return null;
    // Same 2-col grid on mobile and desktop: login card is max-w-md, so a single-column
    // stack wastes space on desktop; three columns was too tight. Odd last role spans 2.
    const isMobileLayout = layout === 'mobile';
    const containerClass =
      'grid grid-cols-2 gap-2 [grid-template-columns:repeat(2,minmax(0,1fr))]';
    const roleBtnBase =
      'flex w-full min-w-0 items-center border-2 text-left font-semibold transition-all duration-200 active:scale-[0.98]';
    const roleBtnSizing = isMobileLayout
      ? 'gap-2 rounded-xl px-2.5 py-2 text-[13px] leading-tight min-h-[48px] h-auto'
      : 'gap-2.5 rounded-xl px-3 py-3 text-sm min-h-[44px] h-auto';
    const roleBtnIcon = 'text-lg leading-none shrink-0';
    const roleBtnSelected = isMobileLayout
      ? 'border-orange-500 bg-orange-50 text-gray-900 ring-2 ring-orange-400/60 shadow-sm'
      : 'border-orange-500 bg-orange-50 text-gray-900 shadow-md ring-2 ring-orange-500/30';
    const roleBtnIdle =
      'border-gray-200 bg-white/80 text-gray-700 hover:border-orange-300 hover:bg-white';

    const mobileIconWrap = (selected: boolean) =>
      `flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none ${
        selected ? 'bg-orange-100 ring-2 ring-orange-200/80' : 'bg-gray-100'
      }`;

    return (
      <fieldset className={`border-0 p-0 m-0 min-w-0 ${isMobileLayout ? 'space-y-1.5' : 'space-y-2'}`}>
        <legend className="block text-sm font-semibold text-gray-700 mb-1.5 w-full">
          {isLogin ? t('auth.accountType') : t('auth.iWantTo')} <span className="text-orange-600">*</span>
        </legend>
        <div className={containerClass} role="presentation">
          {allowedRoles.map((role, index) => {
            const rc = roleConfig[role];
            const label = isLogin ? rc.title : registerRoleLabel(role);
            const selected = selectedRole === role;
            const oddLast =
              allowedRoles.length % 2 === 1 && index === allowedRoles.length - 1;
            const oddLastColSpan = oddLast ? 'col-span-2' : '';
            return (
              <button
                key={role}
                type="button"
                aria-pressed={selected}
                onClick={() => handleRoleChange(role)}
                className={`${roleBtnBase} ${roleBtnSizing} ${selected ? roleBtnSelected : roleBtnIdle} ${oddLastColSpan}`}
              >
                <span
                  className={isMobileLayout ? mobileIconWrap(selected) : roleBtnIcon}
                  aria-hidden
                >
                  {rc.icon}
                </span>
                <span className="min-w-0 flex-1 text-left leading-snug break-words">
                  {label}
                </span>
                {isMobileLayout && selected && (
                  <svg
                    className="h-4 w-4 shrink-0 text-orange-600 sm:h-5 sm:w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        {!selectedRole && (
          <p className="text-xs text-gray-500 mt-0.5">{t('auth.selectAccountTypePlaceholder')}</p>
        )}
      </fieldset>
    );
  };

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
  const mobileFormInputClass =
    'w-full px-3.5 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 focus:shadow-sm transition-all duration-200 font-medium';

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
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-6 px-4 sm:py-8 bg-[#0B1020]">
        {/* Ambient gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(600px 400px at 0% 0%, rgba(255,107,53,0.22) 0%, transparent 60%), radial-gradient(600px 400px at 100% 100%, rgba(124,58,237,0.25) 0%, transparent 60%), linear-gradient(160deg, #0B1020 0%, #111834 55%, #1A1240 100%)',
          }}
        />
        {/* Soft floating blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl opacity-50 animate-pulse"
            style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full blur-3xl opacity-50 animate-pulse"
            style={{
              background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
              animationDelay: '2s',
            }}
          />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div
            className="bg-white rounded-3xl border border-white/60 p-5 sm:p-6"
            style={{
              boxShadow:
                '0 24px 60px -16px rgba(8, 10, 30, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)',
            }}
          >
            {/* Logo and Title */}
            <div className="text-center mb-5">
              <div className="flex justify-center mb-3">
                <Logo
                  className="scale-100"
                  showText={true}
                  onClick={() => onNavigate(View.USED_CARS)}
                />
              </div>
              <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">
                {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-medium text-gray-500">
                {isLogin ? t('auth.signInContinue') : t('auth.getStarted')}
              </p>
            </div>
            <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
              {accountTypeButtonGroup('mobile')}
              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="mobile-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
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
                    <label htmlFor="mobile-tel" className="block text-sm font-semibold text-gray-700 mb-1.5">
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
                <label htmlFor="mobile-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
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
                <label htmlFor="mobile-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
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
              className="group relative w-full flex justify-center py-3.5 px-5 border border-transparent rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FF6B35 100%)',
                backgroundSize: '200% 200%',
                boxShadow: '0 8px 20px rgba(255, 107, 53, 0.35)'
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
          <div className="mt-5 sm:mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-3 bg-white text-gray-500 font-medium sm:bg-white/95 sm:backdrop-blur-sm sm:px-4">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || !canUseGoogle}
                title={!canUseGoogle ? t('auth.googleRequiresCustomerOrSeller') : undefined}
                className="group w-full inline-flex justify-center items-center py-2.5 px-3 border border-gray-200 rounded-xl bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 active:scale-[0.98] sm:py-3 sm:px-4 sm:border-2 sm:text-sm sm:bg-white/80 sm:backdrop-blur-sm"
              >
                <svg className="w-4 h-4 mr-1.5 shrink-0 sm:w-5 sm:h-5 sm:mr-2 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                className="group w-full inline-flex justify-center items-center py-2.5 px-3 border border-gray-200 rounded-xl bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 active:scale-[0.98] sm:py-3 sm:px-4 sm:border-2 sm:text-sm sm:bg-white/80 sm:backdrop-blur-sm"
              >
                <svg className="w-4 h-4 mr-1.5 shrink-0 sm:w-5 sm:h-5 sm:mr-2 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {t('auth.phoneOtp')}
              </button>
            </div>
          </div>

          {/* Toggle between Login and Register */}
          <div className="mt-5 text-center sm:mt-6">
            <p className="text-xs text-gray-600 sm:text-sm">
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
          <div className="mt-3 text-center sm:mt-4">
            <button
              type="button"
              onClick={() => onNavigate(View.USED_CARS)}
              className="text-xs text-gray-500 hover:text-gray-700 sm:text-sm"
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

  // Desktop UI - Premium Split-Screen Design
  return (
    <>
      {googleRolePickerOverlay}
    <div className="min-h-screen w-full relative overflow-hidden bg-[#0B1020]">
      {/* Ambient gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1000px 600px at -10% -10%, rgba(255,107,53,0.18) 0%, transparent 60%), radial-gradient(900px 600px at 110% 10%, rgba(124,58,237,0.22) 0%, transparent 60%), radial-gradient(1200px 800px at 50% 120%, rgba(59,130,246,0.18) 0%, transparent 60%), linear-gradient(135deg, #0B1020 0%, #111834 50%, #1A1240 100%)',
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 75%)',
        }}
      />
      {/* Floating blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-40 animate-pulse"
          style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-40 animate-pulse"
          style={{
            background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)',
            animationDelay: '2s',
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-[1.05fr,1fr]">
        {/* Left hero panel — desktop only */}
        <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-2.5 rounded-2xl shadow-lg">
              <Logo
                className="scale-100"
                showText={true}
                onClick={() => onNavigate(View.USED_CARS)}
              />
            </div>
          </div>

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/90 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              India&rsquo;s trusted pre-owned marketplace
            </span>
            <h1 className="mt-5 text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight text-white">
              Drive into your{' '}
              <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-200 bg-clip-text text-transparent">
                next chapter
              </span>
              <span className="block text-white/80 font-semibold text-2xl xl:text-3xl mt-2">
                with ReRide.
              </span>
            </h1>
            <p className="mt-5 text-base xl:text-lg text-white/70 leading-relaxed">
              Buy, sell, and service vehicles with verified listings, transparent pricing,
              and a community built on trust.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  title: 'Verified listings',
                  desc: 'Every vehicle goes through our multi-step verification.',
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ),
                },
                {
                  title: 'Transparent pricing',
                  desc: 'Fair market value, clear paperwork, no hidden fees.',
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v8m0 0v2m0-10V6m9 6a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ),
                },
                {
                  title: 'End-to-end service',
                  desc: 'From discovery to ownership transfer and beyond.',
                  icon: (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  ),
                },
              ].map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/25 to-orange-500/10 border border-orange-300/20 text-orange-300">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {f.icon}
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-white">{f.title}</p>
                    <p className="text-sm text-white/65 leading-relaxed">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 max-w-xl">
            <div className="flex items-center gap-1 text-amber-300" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
                </svg>
              ))}
            </div>
            <p className="mt-2 text-sm text-white/85 leading-relaxed">
              &ldquo;Found my dream car in under a week. The team made the paperwork feel effortless.&rdquo;
            </p>
            <p className="mt-2 text-xs font-semibold text-white/60">
              — Priya S., Bengaluru
            </p>
          </div>
        </aside>

        {/* Right form panel */}
        <main className="flex items-center justify-center px-4 sm:px-6 py-10 lg:py-12 lg:px-10">
          <div className="w-full max-w-md relative">
            {/* Mobile-only logo (above lg) */}
            <div className="flex justify-center mb-5 lg:hidden">
              <div className="bg-white/10 backdrop-blur-md border border-white/15 p-2.5 rounded-2xl shadow-lg">
                <Logo
                  className="scale-100"
                  showText={true}
                  onClick={() => onNavigate(View.USED_CARS)}
                />
              </div>
            </div>

            <div
              className="bg-white/[0.98] backdrop-blur-xl rounded-3xl border border-white/60 p-7 sm:p-8 lg:p-9"
              style={{
                boxShadow:
                  '0 30px 80px -20px rgba(8, 10, 30, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="mb-6">
                <h2 className="text-[26px] sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
                </h2>
                <p className="mt-1.5 text-sm font-medium text-gray-500">
                  {isLogin ? t('auth.signInContinueAccount') : t('auth.getStartedToday')}
                </p>
              </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {accountTypeButtonGroup('desktop')}
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
              className="group relative w-full flex justify-center items-center py-3.5 px-5 rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #FF6B35 0%, #F97316 50%, #FB923C 100%)',
                boxShadow:
                  '0 10px 24px -6px rgba(255, 107, 53, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <span
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/25 opacity-0 group-hover:opacity-100 group-hover:translate-x-[350%] transition-all duration-700 ease-out"
                aria-hidden
              />
              {isLoading ? (
                <span className="relative flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.processing')}
                </span>
              ) : (
                <span className="relative flex items-center">
                  {isLogin ? t('auth.signIn') : t('auth.createAccount')}
                  <svg
                    className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
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
                <span className="px-4 bg-white text-gray-500 font-medium">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || !canUseGoogle}
                title={!canUseGoogle ? t('auth.googleRequiresCustomerOrSeller') : undefined}
                className="group w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
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
                className="group w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500 transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
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
                className="font-semibold text-orange-600 hover:text-orange-700 underline-offset-2 hover:underline"
              >
                {isLogin ? t('auth.createAccount') : t('auth.signIn')}
              </button>
            </p>
          </div>

          {/* Guest Access */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => onNavigate(View.USED_CARS)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('auth.continueGuest')}
            </button>
          </div>
            </div>

            {/* Tiny reassurance line below card on small screens */}
            <p className="mt-4 text-center text-xs text-white/60 lg:hidden">
              Secured by industry-standard encryption
            </p>
          </div>
        </main>
      </div>
    </div>
    </>
  );
};

export default UnifiedLogin;
