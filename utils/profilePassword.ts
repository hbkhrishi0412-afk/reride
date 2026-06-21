import type { User } from '../types';

/** OAuth / phone users often have no app password until they set one explicitly. */
export function userNeedsPasswordSetup(user: User): boolean {
  if (user.hasPassword === true) return false;
  if (user.hasPassword === false) return true;
  return user.authProvider === 'google' || user.authProvider === 'phone';
}

export async function updateProfilePassword(
  currentUser: User,
  passwords: { current?: string; new: string },
  deps: {
    login: (credentials: {
      email: string;
      password: string;
      role: User['role'];
    }) => Promise<{ success: boolean }>;
    updateUser: (email: string, updates: Partial<User>) => Promise<void>;
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    logError: (...args: unknown[]) => void;
  },
): Promise<boolean> {
  const needsSetup = userNeedsPasswordSetup(currentUser);

  if (!needsSetup) {
    if (!passwords.current?.trim()) {
      deps.addToast('Current password is required', 'error');
      return false;
    }
    const loginResult = await deps.login({
      email: currentUser.email,
      password: passwords.current,
      role: currentUser.role,
    });
    if (!loginResult.success) {
      deps.addToast('Current password is incorrect', 'error');
      return false;
    }
  }

  try {
    await deps.updateUser(currentUser.email, { password: passwords.new });
    return true;
  } catch (updateError) {
    deps.logError('Failed to update password:', updateError);
    const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
    if (errorMessage.includes('Server error') || errorMessage.includes('500')) {
      deps.addToast('Could not update password. Please try again later.', 'error');
    } else if (errorMessage.includes('Authentication') || errorMessage.includes('401')) {
      deps.addToast('Your session has expired. Please log in again to update your password.', 'error');
    } else {
      deps.addToast('Could not update password. Please check your connection and try again.', 'error');
    }
    return false;
  }
}
