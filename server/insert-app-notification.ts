import { getSupabaseAdminClient } from '../lib/supabase-admin.js';

export type AppNotificationInsert = {
  recipientEmail: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

/** Row for public.notifications. id is omitted so the bigint sequence assigns it. */
export function buildNotificationRecords(
  rows: AppNotificationInsert[],
  idByEmail: ReadonlyMap<string, string>,
  now = new Date().toISOString(),
): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const recipientEmail = row.recipientEmail.toLowerCase().trim();
    if (!recipientEmail.includes('@')) continue;
    records.push({
      user_id: idByEmail.get(recipientEmail) ?? null,
      recipient_email: recipientEmail,
      type: row.type,
      title: row.title,
      message: row.message,
      read: false,
      is_read: false,
      created_at: now,
      metadata: row.metadata ?? {},
    });
  }
  return records;
}

/** Insert in-app notifications. Failures are logged; callers already committed their own write. */
export async function insertAppNotifications(rows: AppNotificationInsert[]): Promise<void> {
  const wanted = rows
    .map((row) => ({ ...row, recipientEmail: row.recipientEmail.toLowerCase().trim() }))
    .filter((row) => row.recipientEmail.includes('@'));
  if (!wanted.length) return;

  const supabase = getSupabaseAdminClient();
  const emails = [...new Set(wanted.map((row) => row.recipientEmail))];
  const { data: users, error: lookupError } = await supabase.from('users').select('id, email').in('email', emails);
  if (lookupError) {
    console.error('notification recipient lookup failed:', lookupError.message);
  }
  const idByEmail = new Map<string, string>();
  for (const user of users || []) {
    const email = String(user.email || '').toLowerCase().trim();
    if (email && user.id) idByEmail.set(email, String(user.id));
  }

  const records = buildNotificationRecords(wanted, idByEmail);
  if (!records.length) return;
  const { error } = await supabase.from('notifications').insert(records);
  if (error) {
    console.error('notification insert failed:', error.message);
  }
}
