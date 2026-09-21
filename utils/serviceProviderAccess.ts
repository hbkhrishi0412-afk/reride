import type { User } from '../types.js';
import { View } from '../types.js';

/** True when the active session is a service-provider (user role or provider-only login). */
export function isServiceProviderActor(
  currentUser: Pick<User, 'role'> | null | undefined,
  serviceProvider?: { email?: string; name?: string } | null,
): boolean {
  if (currentUser?.role === 'service_provider') return true;
  return Boolean(serviceProvider);
}

/** Home destination: provider dashboard when logged in as SP, else public home. */
export function homeViewForActor(
  currentUser: Pick<User, 'role'> | null | undefined,
  serviceProvider?: { email?: string; name?: string } | null,
): View {
  return isServiceProviderActor(currentUser, serviceProvider)
    ? View.CAR_SERVICE_DASHBOARD
    : View.HOME;
}
