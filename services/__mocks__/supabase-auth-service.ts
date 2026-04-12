/** Manual mock — used only when tests call `jest.mock('../services/supabase-auth-service')`. */

export const getOAuthRedirectUrl = jest.fn(() => 'http://localhost:5173/');
export const signInWithGoogle = jest.fn();
export const signInWithEmail = jest.fn();
export const signUpWithEmail = jest.fn();
export const signOut = jest.fn();
export const getSession = jest.fn();
export const getCurrentUser = jest.fn();
export const refreshSession = jest.fn();
export const resetPassword = jest.fn();
export const updatePassword = jest.fn();
export const verifyOTP = jest.fn();
export const syncServiceProviderOAuth = jest.fn();
export const syncWithBackend = jest.fn();

export type ServiceProviderOAuthPayload = Record<string, unknown>;
