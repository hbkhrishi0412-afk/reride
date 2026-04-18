import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resetPassword, updatePassword } from '../services/supabase-auth-service';
import { getSupabaseClient } from '../lib/supabase';
import PasswordInput from './PasswordInput';

interface ForgotPasswordProps {
  onBack: () => void;
  /** Optional hook after Supabase accepts the reset email request */
  onResetSent?: (email: string) => void;
}

type Stage = 'request' | 'recovery' | 'requestSent' | 'recoveryComplete';

/**
 * Detect whether the current URL looks like a password-reset callback from Supabase.
 * Supabase PKCE flow puts a `code` query param on the configured redirect; legacy
 * implicit flow puts `type=recovery` in the URL hash. We accept either so users
 * landing here from an old email link still get the "set new password" form.
 */
function detectRecoveryFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const search = new URLSearchParams(window.location.search);
    if (search.get('type') === 'recovery') return true;
    if (search.get('code')) return true;

    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const hashParams = new URLSearchParams(hash.slice(qIdx + 1));
      if (hashParams.get('type') === 'recovery') return true;
      if (hashParams.get('code')) return true;
    }

    // Implicit flow leaves `#access_token=...&type=recovery`
    if (hash.includes('type=recovery')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onResetSent }) => {
  const { t } = useTranslation();

  const initialStage: Stage = detectRecoveryFromUrl() ? 'recovery' : 'request';
  const [stage, setStage] = useState<Stage>(initialStage);

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoRedirectRef = useRef<number | null>(null);

  // Listen for Supabase's PASSWORD_RECOVERY event — fires after PKCE code exchange
  // completes on the redirect page, which is the signal that the user has a valid
  // recovery session and can set a new password.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setStage('recovery');
          setError(null);
        }
      });
      unsubscribe = () => {
        try {
          data.subscription.unsubscribe();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* Supabase not configured — keep the default request form */
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoRedirectRef.current) {
        window.clearTimeout(autoRedirectRef.current);
        autoRedirectRef.current = null;
      }
    };
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setIsLoading(true);
    try {
      const result = await resetPassword(email.trim());
      if (!result.success) {
        setError(result.reason || t('auth.forgotError'));
        return;
      }
      setStage('requestSent');
      onResetSent?.(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgotError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updatePassword(newPassword);
      if (!result.success) {
        setError(result.reason || 'Failed to update password. The reset link may have expired.');
        return;
      }

      // Sign the recovery session out so the user has to log in with the new
      // password; also strip recovery params from the URL so a refresh doesn't
      // drop them back into recovery mode.
      try {
        await getSupabaseClient().auth.signOut();
      } catch {
        /* ignore */
      }
      try {
        const cleanHash = (window.location.hash || '').split('?')[0];
        const clean = `${window.location.origin}${window.location.pathname}${cleanHash}`;
        window.history.replaceState({}, document.title, clean);
      } catch {
        /* ignore */
      }

      setStage('recoveryComplete');
      autoRedirectRef.current = window.setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const formInputClass =
    'appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-300 placeholder-brand-gray-500 text-reride-text-dark dark:text-brand-gray-200 bg-white focus:outline-none focus:z-10 sm:text-sm';

  const showRequest = stage === 'request';
  const showRequestSent = stage === 'requestSent';
  const showRecovery = stage === 'recovery';
  const showRecoveryComplete = stage === 'recoveryComplete';

  const title = showRecovery || showRecoveryComplete
    ? 'Set a New Password'
    : t('auth.forgotTitle');
  const intro = showRecovery
    ? 'Choose a new password for your account. You will be signed in after updating.'
    : t('auth.forgotIntro');

  return (
    <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-reride-text-dark dark:text-reride-text-dark">
          {title}
        </h2>
        {!showRequestSent && !showRecoveryComplete && (
          <p className="mt-2 text-center text-sm text-brand-gray-600 dark:text-reride-text">
            {intro}
          </p>
        )}
      </div>

      {showRequestSent && (
        <div className="text-center p-4 bg-reride-orange-light dark:bg-reride-orange/50 text-reride-orange dark:text-reride-orange rounded-lg">
          <p>{t('auth.forgotSent')}</p>
        </div>
      )}

      {showRecoveryComplete && (
        <div className="text-center p-4 bg-green-50 text-green-700 rounded-lg" role="status">
          <p className="font-semibold">Password updated successfully.</p>
          <p className="text-sm mt-1">Redirecting you to sign in…</p>
        </div>
      )}

      {showRequest && (
        <form className="mt-8 space-y-6" onSubmit={handleRequestReset}>
          {error && (
            <div className="rounded-md bg-red-50 text-red-800 text-sm px-3 py-2" role="alert">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                {t('auth.emailAddress')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`${formInputClass} rounded-md`}
                placeholder={t('auth.placeholder.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white btn-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-60"
            >
              {isLoading ? t('auth.sending') : t('auth.sendResetLink')}
            </button>
          </div>
        </form>
      )}

      {showRecovery && (
        <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
          {error && (
            <div className="rounded-md bg-red-50 text-red-800 text-sm px-3 py-2" role="alert">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                New password
              </label>
              <PasswordInput
                id="new-password"
                name="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                showLabel={false}
                disabled={isLoading}
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
                showLabel={false}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white btn-brand-primary focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      )}

      <div className="text-sm text-center">
        <button
          type="button"
          onClick={onBack}
          className="font-medium transition-colors"
          style={{ color: '#FF6B35' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--reride-blue)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--reride-orange)')}
        >
          &larr; {t('auth.backToLogin')}
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;
