import React, { useEffect, useState } from 'react';
import { signInWithEmail, resetPassword } from '../services/supabase-auth-service';
import { setRememberMePreference } from '../utils/rememberMe';
import { View as ViewEnum } from '../types';

const REMEMBER_EMAIL_KEY = 'rememberedService_providerEmail';

interface CarServiceLoginProps {
  onNavigate: (view: ViewEnum) => void;
  onLoginSuccess: (provider: any) => void;
}

const CarServiceLogin: React.FC<CarServiceLoginProps> = ({ onNavigate, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [workshops, setWorkshops] = useState('');
  const [skills, setSkills] = useState('');
  const [availability, setAvailability] = useState('weekdays');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (remembered) {
        setEmail(remembered);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistRememberedEmail = () => {
    try {
      if (rememberMe && email.trim()) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  };

  const handleMockLogin = () => {
    // Quick dev-only path to view the dashboard without hitting auth
    const mockProvider = {
      name: name || 'Mock Provider',
      email: email || 'mock-provider@example.com',
      phone: phone || '0000000000',
      city: city || 'Mock City',
      workshops: workshops ? workshops.split(',').map(s => s.trim()).filter(Boolean) : [],
      skills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      availability,
    };
    onLoginSuccess(mockProvider);
    onNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);
    try {
      const result = await signInWithEmail(email, password);
      
      if (!result.success || !result.session) {
        throw new Error(result.reason || 'Login failed');
      }

      const loadProviderDirectly = async (): Promise<any | null> => {
        try {
          const { getSupabaseClient } = await import('../lib/supabase.js');
          const supabase = getSupabaseClient();
          const uid = result.session?.user?.id;
          if (uid) {
            const { data: byId } = await supabase
              .from('service_providers')
              .select('*')
              .eq('id', uid)
              .maybeSingle();
            if (byId) return byId;
          }
          const { data: byEmail } = await supabase
            .from('service_providers')
            .select('*')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();
          return byEmail ?? null;
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
        if (!provider) {
          throw new Error('Unable to reach service provider API. Start local API server or try again.');
        }
        persistRememberedEmail();
        setRememberMePreference(rememberMe);
        onLoginSuccess(provider);
        onNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
        return;
      }

      if (resp.status === 404) {
        const provider = await loadProviderDirectly();
        if (!provider) {
          setError('No service provider profile found for this account. Contact admin.');
          setLoading(false);
          return;
        }
        persistRememberedEmail();
        setRememberMePreference(rememberMe);
        onLoginSuccess(provider);
        onNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load provider profile');
      }

      const provider = await resp.json();
      persistRememberedEmail();
      setRememberMePreference(rememberMe);
      onLoginSuccess(provider);
      onNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);
    try {
      if (!name || !phone || !city) {
        setError('Name, phone, and city are required');
        setLoading(false);
        return;
      }
      
      if (!email || !password) {
        setError('Email and password are required');
        setLoading(false);
        return;
      }

      const workshopList = workshops ? workshops.split(',').map(s => s.trim()).filter(Boolean) : [];
      const skillList = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];

      // Prefer server-side registration: Supabase client signUp often fails with
      // "Database error saving new user" when auth DB triggers conflict with public.users.
      const registerResp = await fetch('/api/service-providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          city,
          workshops: workshopList,
          skills: skillList,
          availability,
        }),
      });

      if (registerResp.status === 404) {
        throw new Error(
          'Registration endpoint is not available yet. Please refresh after deployment or contact support.',
        );
      }

      if (!registerResp.ok) {
        const data = await registerResp.json().catch(() => ({}));
        throw new Error(data.error || 'Registration failed');
      }

      const signInResult = await signInWithEmail(email, password);
      if (!signInResult.success || !signInResult.session) {
        throw new Error(
          signInResult.reason ||
            'Account was created but sign-in failed. Try logging in, or confirm your email if required.',
        );
      }

      const providerResp = await fetch('/api/service-providers', {
        method: 'GET',
        headers: { Authorization: `Bearer ${signInResult.session.access_token}` },
      });

      if (!providerResp.ok) {
        const data = await providerResp.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load your provider profile after sign-in.');
      }

      const provider = await providerResp.json();
      persistRememberedEmail();
      setRememberMePreference(true);
      onLoginSuccess(provider);
      onNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Car Service Login' : 'Create Provider Account'}
          </h1>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            {mode === 'login' ? 'Create account' : 'Have an account? Login'}
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">For service providers only.</p>
        {isDev && (
          <p className="text-xs text-gray-600 mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            Test login (run <code className="rounded bg-white px-1">npm run seed:test-provider</code> once with
            service role in <code className="rounded bg-white px-1">.env</code>):{' '}
            <span className="font-medium">provider@test.com</span> / <span className="font-medium">password123</span>
          </p>
        )}
        <form className="space-y-3" onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Workshops (comma separated)</label>
                  <input
                    type="text"
                    value={workshops}
                    onChange={(e) => setWorkshops(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Skills (comma separated)</label>
                  <input
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Availability</label>
                <input
                  type="text"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="weekdays / weekends / custom"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {mode === 'login' && (
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  id="car-service-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 border-gray-300 rounded"
                  style={{ accentColor: '#2563EB' }}
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setResetMessage(null);
                  if (!email) {
                    setError('Enter your email to reset password.');
                    return;
                  }
                  try {
                    const result = await resetPassword(email);
                    if (!result.success) {
                      throw new Error(result.reason || 'Failed to send reset email');
                    }
                    setResetMessage('Password reset email sent. Check your inbox to set a new password.');
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Failed to send reset email';
                    setError(message);
                  }
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
          {mode === 'signup' && (
            <span className="block text-sm text-gray-500">For service providers only.</span>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {resetMessage && <p className="text-sm text-green-600">{resetMessage}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'login' ? 'Login' : 'Create account'}
          </button>
          {isDev && (
            <button
              type="button"
              onClick={handleMockLogin}
              className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
            >
              Use mock login (dev)
            </button>
          )}
        </form>
        <button
          onClick={() => onNavigate(ViewEnum.CAR_SERVICES)}
          className="mt-4 w-full text-center text-sm text-blue-600 hover:underline"
        >
          Back to Car Services
        </button>
      </div>
    </div>
  );
};

export default CarServiceLogin;

