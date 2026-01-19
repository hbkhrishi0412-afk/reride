import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { View as ViewEnum } from '../types';
import '../lib/firebase'; // ensure firebase client is initialized

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);
    try {
      const auth = getAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const resp = await fetch('/api/service-providers', {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (resp.status === 404) {
        setError('No service provider profile found for this account. Contact admin.');
        setLoading(false);
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load provider profile');
      }

      const provider = await resp.json();
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
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const resp = await fetch('/api/service-providers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          city,
          workshops: workshops ? workshops.split(',').map(s => s.trim()).filter(Boolean) : [],
          skills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          availability,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create provider profile');
      }

      const provider = await resp.json();
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">For service providers only.</span>
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
                  const auth = getAuth();
                  await sendPasswordResetEmail(auth, email);
                  setResetMessage('Password reset email sent.');
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          {resetMessage && <p className="text-sm text-green-600">{resetMessage}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'login' ? 'Login' : 'Create account'}
          </button>
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

