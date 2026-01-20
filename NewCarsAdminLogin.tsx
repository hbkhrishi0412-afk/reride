import React, { useState } from 'react';
import { View, User } from './types';
import { login } from './services/userService';
import PasswordInput from './components/PasswordInput';
import AuthLayout from './components/AuthLayout';

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
    <AuthLayout
      title="New Cars Admin Login"
      subtitle="Manage New Cars catalog"
      backgroundClass="bg-gradient-to-br from-slate-50 via-white to-blue-50"
      iconGradientFrom="from-blue-500"
      iconGradientTo="to-indigo-600"
      icon={
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 5a2 2 0 012-2h3.5a1.5 1.5 0 011.414 1H16a2 2 0 012 2v7a2 2 0 01-2 2h-2.586A2 2 0 0112 16H4a2 2 0 01-2-2V5z" />
        </svg>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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
    </AuthLayout>
  );
};

export default NewCarsAdminLogin;


