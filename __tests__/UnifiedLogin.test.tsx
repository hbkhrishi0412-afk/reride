import React from 'react';
import { render, screen } from '@testing-library/react';
import UnifiedLogin from '../components/UnifiedLogin';
import { View } from '../types';

jest.mock('../services/userService', () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

jest.mock('../services/authService', () => ({
  runGoogleSignInButtonFlow: jest.fn(),
}));

jest.mock('../services/supabase-auth-service', () => ({
  syncWithBackend: jest.fn(),
}));

jest.mock('../hooks/useIsMobileApp', () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock('../hooks/useVisualViewportBottomInset', () => ({
  useVisualViewportBottomInset: () => 0,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('UnifiedLogin', () => {
  const baseProps = {
    onLogin: jest.fn(),
    onRegister: jest.fn(),
    onNavigate: jest.fn(),
    onForgotPassword: jest.fn(),
    forcedRole: 'customer' as const,
    hideRolePicker: true,
  };

  it('renders email field for customer login', () => {
    render(<UnifiedLogin {...baseProps} />);
    expect(screen.getByLabelText(/auth\.emailAddress/i)).toBeInTheDocument();
  });

  it('exposes password field', () => {
    render(<UnifiedLogin {...baseProps} />);
    expect(document.getElementById('mobile-password')).toBeInTheDocument();
  });
});
