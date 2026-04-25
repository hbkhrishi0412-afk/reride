import type { User } from '../types';

/**
 * Strip password (and anything that should not sit in localStorage) before persisting current user.
 */
export function currentUserForLocalSession(user: User): User {
  const u = { ...user } as User & { password?: string };
  delete u.password;
  return u as User;
}

export function currentUserForLocalSessionJson(user: User): string {
  return JSON.stringify(currentUserForLocalSession(user));
}
