import admin from 'firebase-admin';

const USERS_PATH = 'users';

const normalizeEmail = (email) => email.toLowerCase().trim();
const emailToKey = (email) => normalizeEmail(email).replace(/[.#$[\]]/g, '_');

const parseServiceAccount = () => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
  }

  let cleanedJson = serviceAccountJson.trim();
  if (
    (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) ||
    (cleanedJson.startsWith("'") && cleanedJson.endsWith("'"))
  ) {
    cleanedJson = cleanedJson.slice(1, -1);
    cleanedJson = cleanedJson.replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  const serviceAccount = JSON.parse(cleanedJson);
  if (!serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY missing required fields.');
  }

  return serviceAccount;
};

const initFirebaseAdmin = () => {
  if (admin.apps.length) {
    return;
  }

  const serviceAccount = parseServiceAccount();
  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    `https://${serviceAccount.project_id || 'default'}.firebaseio.com`;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL.endsWith('/') ? databaseURL.slice(0, -1) : databaseURL
  });
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  initFirebaseAdmin();

  const db = admin.database();
  const usersRef = db.ref(USERS_PATH);
  const snapshot = await usersRef.once('value');
  const users = snapshot.val() || {};

  const stats = {
    total: 0,
    migrated: 0,
    normalizedEmail: 0,
    skippedNoEmail: 0,
    skippedAlready: 0,
    conflicts: 0,
    errors: 0
  };

  for (const [key, user] of Object.entries(users)) {
    stats.total += 1;

    if (!user || typeof user !== 'object') {
      stats.skippedNoEmail += 1;
      console.warn(`⚠️  Skipping invalid user at key ${key}`);
      continue;
    }

    if (!user.email || typeof user.email !== 'string') {
      stats.skippedNoEmail += 1;
      console.warn(`⚠️  Skipping user without email at key ${key}`);
      continue;
    }

    const normalizedEmail = normalizeEmail(user.email);
    const targetKey = emailToKey(normalizedEmail);
    const needsMove = key !== targetKey;
    const needsEmailNormalize = user.email !== normalizedEmail;

    if (!needsMove && !needsEmailNormalize) {
      stats.skippedAlready += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        `🔎 DRY RUN: ${key} -> ${targetKey} ${needsEmailNormalize ? '(normalize email)' : ''}`
      );
      continue;
    }

    try {
      if (needsMove) {
        const existingTarget = users[targetKey];
        if (existingTarget && existingTarget !== user) {
          stats.conflicts += 1;
          console.warn(
            `⚠️  Conflict: target key already exists for ${normalizedEmail} (source: ${key}, target: ${targetKey})`
          );
          continue;
        }

        const updatedUser = {
          ...user,
          email: normalizedEmail,
          updatedAt: new Date().toISOString()
        };

        await usersRef.child(targetKey).set(updatedUser);
        await usersRef.child(key).remove();
        stats.migrated += 1;
      } else if (needsEmailNormalize) {
        await usersRef.child(key).update({
          email: normalizedEmail,
          updatedAt: new Date().toISOString()
        });
        stats.normalizedEmail += 1;
      }
    } catch (error) {
      stats.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to update user ${key}:`, message);
    }
  }

  console.log('\n✅ Migration complete');
  console.log(JSON.stringify({ dryRun, ...stats }, null, 2));
  process.exit(0);
};

main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

