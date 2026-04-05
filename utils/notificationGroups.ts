import type { Conversation, Notification, Vehicle } from '../types';
import { getNotificationStoryKey } from './notificationMute';

export interface NotificationStoryGroup {
  key: string;
  title: string;
  subtitle?: string;
  items: Notification[];
}

function resolveGroupTitle(
  key: string,
  sample: Notification,
  vehiclesById: Map<number, Vehicle>,
  conversations?: Conversation[]
): string {
  if (key.startsWith('vehicle:')) {
    const id = Number(key.slice('vehicle:'.length));
    const v = vehiclesById.get(id);
    if (v) {
      return [v.year, v.make, v.model].filter(Boolean).join(' ').trim() || `Listing #${id}`;
    }
    return `Listing #${id}`;
  }
  if (key.startsWith('conv:')) {
    const cid = key.slice('conv:'.length);
    const c = conversations?.find((x) => String(x.id) === cid);
    if (c?.vehicleName) return c.vehicleName;
    return 'Conversation';
  }
  if (sample.targetType === 'price_drop') return 'Price drop';
  if (sample.targetType === 'insurance_expiry') return 'Insurance';
  if (sample.targetType === 'general_admin') return 'Account';
  return 'Update';
}

/**
 * Group notifications by listing or chat (Facebook-style story stacks).
 */
export function buildNotificationGroups(
  items: Notification[],
  vehicles: Vehicle[],
  conversations?: Conversation[]
): NotificationStoryGroup[] {
  const vehiclesById = new Map<number, Vehicle>();
  for (const v of vehicles) {
    if (v && typeof v.id === 'number') vehiclesById.set(v.id, v);
  }

  const byKey = new Map<string, Notification[]>();
  for (const n of items) {
    const key = getNotificationStoryKey(n);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(n);
  }

  const groups: NotificationStoryGroup[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest = sorted[0];
    const title = resolveGroupTitle(key, latest, vehiclesById, conversations);
    const subtitle =
      sorted.length > 1 ? `${sorted.length} updates` : undefined;
    groups.push({ key, title, subtitle, items: sorted });
  }

  groups.sort((a, b) => {
    const ta = Math.max(...a.items.map((i) => new Date(i.timestamp).getTime()));
    const tb = Math.max(...b.items.map((i) => new Date(i.timestamp).getTime()));
    return tb - ta;
  });

  return groups;
}
