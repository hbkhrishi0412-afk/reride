import React, { useState } from 'react';
import { View, User } from './types';
import { login } from './services/userService';
import PasswordInput from './components/PasswordInput';
import AuthLayout from './components/AuthLayout';

interface AdminLoginProps {
  onLogin: (user: User) => void;
  onNavigate: (view: View) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onNavigate }) => {
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
        // SECURITY: Removed hardcoded credentials - all authentication must go through proper API
        
        // Try normal login flow
        const result = await login({ email, password, role: 'admin' });

        if (result.success && result.user) {
            onLogin(result.user);
        } else {
            throw new Error(result.reason || 'Invalid admin credentials.');
        }
    } catch (err) {
        let errorMessage = 'Failed to authenticate.';
        
        if (err instanceof Error) {
            errorMessage = err.message;
            // Provide more helpful error messages
            if (errorMessage.includes('Invalid credentials')) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            } else if (errorMessage.includes('not a registered')) {
                errorMessage = 'This account does not have admin privileges.';
            }
        }
        
        setError(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Admin Panel Login"
      subtitle="Secure access to administrative controls"
      backgroundClass="bg-gradient-to-br from-slate-50 via-white to-red-50"
      iconGradientFrom="from-red-500"
      iconGradientTo="to-orange-600"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="email-address" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input id="email-address" name="email" type="email" autoComplete="email" required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-2 focus:outline-offset-2 focus:outline-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm" placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <PasswordInput
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm"
              autoComplete="current-password"
              required
              showLabel={false}
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl" role="alert" aria-live="polite">{error}</p>}

        <div>
          <button type="submit" disabled={isLoading} className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              <span>Sign in as Admin</span>
            )}
          </button>
        </div>
      </form>

      <div className="text-center">
        <button onClick={() => onNavigate(View.USED_CARS)} className="font-medium text-gray-600 hover:text-gray-800 transition-colors duration-300 flex items-center gap-2 mx-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Or go back to Listings
        </button>
      </div>
    </AuthLayout>
  );
};

export default AdminLogin;