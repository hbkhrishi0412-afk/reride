import React, { useState } from 'react';
import { View, User } from './types';
import { login } from './services/userService';
import PasswordInput from './components/PasswordInput';

interface NewCarsAdminLoginProps {
  onLogin: (user: User) => void;
  onNavigate: (view: View) => void;
}

const NewCarsAdminLogin: React.FC<NewCarsAdminLoginProps> = ({ onLogin, onNavigate }) => {
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await login({ email, password, role: 'admin' });
      if (result.success && result.user) {
        onLogin(result.user);
        onNavigate(View.NEW_CARS_ADMIN_PANEL);
      } else {
        throw new Error(result.reason || 'Invalid admin credentials.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-10 space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h3.5a1.5 1.5 0 011.414 1H16a2 2 0 012 2v7a2 2 0 01-2 2h-2.586A2 2 0 0112 16H4a2 2 0 01-2-2V5z"/></svg>
              </div>
              <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">New Cars Admin Login</h2>
            </div>
            <p className="text-gray-600 text-lg">Manage New Cars catalog</p>
          </div>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input id="email-address" name="email" type="email" autoComplete="email" required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <PasswordInput id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm" autoComplete="current-password" required showLabel={false} />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}
            <div>
              <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
          <div className="text-center">
            <button onClick={() => onNavigate(View.NEW_CARS)} className="font-medium text-gray-600 hover:text-gray-800 transition-colors duration-300 flex items-center gap-2 mx-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to New Cars
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCarsAdminLogin;


