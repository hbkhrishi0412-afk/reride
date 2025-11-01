import React, { useState, useEffect } from 'react';
import { View, User } from '../types';
import { login, register } from '../services/userService';
import { signInWithGoogle, syncWithBackend } from '../services/authService';
import OTPLogin from './OTPLogin';
import PasswordInput from './PasswordInput';
import Logo from './Logo';

interface UnifiedLoginProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onNavigate: (view: View) => void;
  onForgotPassword: () => void;
  allowedRoles?: UserRole[];
  forcedRole?: UserRole;
  hideRolePicker?: boolean;
}

type UserRole = 'customer' | 'seller' | 'admin';
type AuthMode = 'login' | 'register' | 'otp';

const UnifiedLogin: React.FC<UnifiedLoginProps> = ({ 
  onLogin, 
  onRegister, 
  onNavigate, 
  onForgotPassword,
  allowedRoles = ['customer', 'seller', 'admin'],
  forcedRole,
  hideRolePicker
}) => {
  const initialRole: UserRole = (forcedRole ?? (allowedRoles[0] as UserRole));
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Role configurations
  const roleConfig = {
    customer: {
      title: 'Customer',
      description: 'Buy vehicles and connect with sellers',
      icon: '🛒',
      color: 'bg-blue-500',
      loginTitle: 'Welcome Back, Customer!',
      registerTitle: 'Join as a Customer'
    },
    seller: {
      title: 'Seller',
      description: 'List vehicles and manage your business',
      icon: '🏪',
      color: 'bg-green-500',
      loginTitle: 'Seller Dashboard Login',
      registerTitle: 'Create Seller Account'
    },
    admin: {
      title: 'Admin',
      description: 'Manage platform and oversee operations',
      icon: '⚙️',
      color: 'bg-purple-500',
      loginTitle: 'Admin Panel Login',
      registerTitle: 'Admin Registration'
    }
  };

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(`remembered${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}Email`);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setRememberMe(false);
    }
  }, [selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let result: { success: boolean, user?: User, reason?: string };

      if (mode === 'login') {
        if (!email || !password) throw new Error('Please enter both email and password.');
        result = await login({ email, password, role: selectedRole });
      } else {
        if (!name || !mobile || !email || !password) throw new Error('Please fill in all registration fields.');
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
        throw new Error(result.reason || 'An unknown error occurred.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await signInWithGoogle();
      
      if (result.success && result.firebaseUser) {
        const backendResult = await syncWithBackend(result.firebaseUser, selectedRole, 'google');
        
        if (backendResult.success && backendResult.user) {
          onLogin(backendResult.user);
        } else {
          throw new Error(backendResult.reason || 'Failed to authenticate with backend');
        }
      } else {
        throw new Error(result.reason || 'Failed to sign in with Google');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
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
    setName('');
    setMobile('');
    setPassword('');
    setMode('login');
  };

  const isLogin = mode === 'login';
  const formInputClass = "appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm rounded-md";

  // Handle OTP mode
  if (mode === 'otp') {
    return (
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-xl shadow-soft-xl">
        <OTPLogin 
          onLogin={onLogin} 
          role={selectedRole} 
          onCancel={() => setMode('login')} 
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-soft-xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left Side - Role Selection */}
          <div className="lg:w-1/3 bg-gradient-to-br from-orange-500 to-blue-600 p-8 text-white">
            <div className="flex justify-center mb-6">
              <Logo className="scale-125 filter brightness-0 invert" showText={false} />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Welcome to ReRide</h2>
            <p className="text-center text-orange-100 mb-8">Choose your role to continue</p>
            
            <div className="space-y-4">
              {!hideRolePicker && Object.entries(roleConfig)
                .filter(([role]) => allowedRoles.includes(role as UserRole))
                .map(([role, config]) => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role as UserRole)}
                    className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                      selectedRole === role 
                        ? 'bg-white bg-opacity-20 border-2 border-white' 
                        : 'bg-white bg-opacity-10 hover:bg-opacity-20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <div className="font-semibold">{config.title}</div>
                        <div className="text-sm text-orange-100">{config.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => onNavigate(View.USED_CARS)}
                className="text-orange-100 hover:text-white transition-colors text-sm font-medium"
              >
                Or continue as a guest →
              </button>
            </div>
          </div>

          {/* Right Side - Login/Register Form */}
          <div className="lg:w-2/3 p-8">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">
                  {isLogin ? roleConfig[selectedRole].loginTitle : roleConfig[selectedRole].registerTitle}
                </h2>
                <p className="mt-2 text-gray-600">
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  {!isLogin && (
                    <>
                      <div>
                        <label htmlFor="full-name" className="sr-only">Full name</label>
                        <input
                          id="full-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          className={formInputClass}
                          placeholder="Full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="mobile-number" className="sr-only">Mobile number</label>
                        <input
                          id="mobile-number"
                          name="mobile"
                          type="tel"
                          autoComplete="tel"
                          required
                          className={formInputClass}
                          placeholder="Mobile number"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label htmlFor="email-address" className="sr-only">Email address</label>
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className={formInputClass}
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={formInputClass}
                    autoComplete="current-password"
                    required
                    showLabel={false}
                  />
                </div>

                {isLogin && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                        Remember me
                      </label>
                    </div>
                    <div className="text-sm">
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="font-medium text-orange-600 hover:text-orange-500"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-red-600 text-sm text-center">{error}</p>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Create Account')}
                  </button>
                </div>
              </form>

              {/* Social Login Options */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('otp')}
                    disabled={isLoading}
                    className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Phone OTP
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={toggleMode}
                  className="font-medium text-orange-600 hover:text-orange-500"
                >
                  {isLogin 
                    ? `Don't have a ${selectedRole} account? Register` 
                    : `Already have a ${selectedRole} account? Sign in`
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLogin;
