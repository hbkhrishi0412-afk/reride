export function isRealProfileValue(raw?: string | null): boolean {
  const v = (raw || '').trim();
  if (!v) return false;
  return v.toLowerCase() !== 'pending setup' && v !== '0000000000';
}

export type ServiceDashboardNextKind =
  | 'city'
  | 'availability'
  | 'skills'
  | 'workshops'
  | 'services'
  | 'categories'
  | 'open';

export type ServiceDashboardNextAction = {
  title: string;
  message: string;
  label: string;
  kind: ServiceDashboardNextKind;
};

/** First incomplete setup step, then a growth tip, then the open pool. */
export function getServiceDashboardNextAction(input: {
  city?: string | null;
  availability?: string | null;
  skills?: string[] | null;
  workshops?: string[] | null;
  activeServiceCount: number;
  categories?: string[] | null;
}): ServiceDashboardNextAction {
  if (!isRealProfileValue(input.city)) {
    return {
      title: 'Add your city',
      message: 'Nearby customers will not see you until a city is set.',
      label: 'Set city',
      kind: 'city',
    };
  }
  if (!isRealProfileValue(input.availability)) {
    return {
      title: 'Set availability',
      message: 'Set when you work so matching jobs can reach you.',
      label: 'Set availability',
      kind: 'availability',
    };
  }
  if (!input.skills?.length) {
    return {
      title: 'Add skills',
      message: 'A short skill list helps customers pick the right workshop.',
      label: 'Add skills',
      kind: 'skills',
    };
  }
  if (!input.workshops?.length) {
    return {
      title: 'Add a workshop',
      message: 'Workshop locations improve local request targeting.',
      label: 'Add workshop',
      kind: 'workshops',
    };
  }
  if (input.activeServiceCount === 0) {
    return {
      title: 'Add a service',
      message: 'You need at least one active service to receive requests.',
      label: 'Add services',
      kind: 'services',
    };
  }
  if (!input.categories?.length) {
    return {
      title: 'Choose categories',
      message: 'Categories route the right jobs to your workshop.',
      label: 'Choose categories',
      kind: 'categories',
    };
  }
  if (input.activeServiceCount < 3) {
    return {
      title: 'Offer more services',
      message: 'Three or more active services usually get more matches.',
      label: 'Add services',
      kind: 'services',
    };
  }
  return {
    title: 'You are set',
    message: 'Keep response times low so customers get a confirmation quickly.',
    label: 'View incoming orders',
    kind: 'open',
  };
}
