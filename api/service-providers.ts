import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import { emailToKey, supabaseUserService } from '../services/supabase-user-service.js';
import type { ServiceProviderPayload } from '../services/supabase-service-provider-service.js';
import { applyCors } from './_cors.js';

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function doesAuthUserExistByEmail(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  email: string,
): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(`Failed to verify auth user existence: ${error.message}`);
    }

    const users = data?.users || [];
    if (users.some((u) => (u.email || '').toLowerCase().trim() === normalized)) {
      return true;
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  return false;
}

async function cleanupStaleUserRecord(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const emailKey = emailToKey(email);
  const normalizedEmail = email.toLowerCase().trim();

  // Delete by both id and email to handle legacy rows not keyed by emailKey.
  const { error } = await supabase
    .from('users')
    .delete()
    .or(`id.eq.${emailKey},email.eq.${normalizedEmail}`);

  if (error) {
    throw new Error(`Failed to clean stale users row: ${error.message}`);
  }
}

/**
 * Public registration for car service providers: creates Supabase Auth user via Admin API
 * (email pre-confirmed), then service_providers + users rows. Avoids client signUp(), which
 * often surfaces "Database error saving new user" when auth triggers or hooks fail on anon sign-up.
 */
export async function handleServiceProviderRegister(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const phone = String(body.phone || '').trim();
    const city = String(body.city || '').trim();
    const workshops = parseStringList(body.workshops);
    const skills = parseStringList(body.skills);
    const availability = String(body.availability || 'weekdays').trim() || 'weekdays';

    if (!name || !email || !password || !phone || !city) {
      return res.status(400).json({
        error: 'Missing required fields: name, email, password, phone, city',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const supabase = getSupabaseAdminClient();
    const authUserExists = await doesAuthUserExistByEmail(supabase, email);

    const existingProvider = await supabaseServiceProviderService.findByEmail(email);
    if (existingProvider) {
      if (authUserExists) {
        return res.status(409).json({
          error: 'A service provider profile already exists for this email. Please sign in.',
        });
      }
      // Stale profile without matching auth user; remove and recreate cleanly.
      await supabaseServiceProviderService.delete(String(existingProvider.id));
    }

    const existingUser = await supabaseUserService.findByEmail(email);
    if (existingUser && authUserExists) {
      return res.status(409).json({
        error:
          'An account with this email already exists. Please sign in or use Forgot password.',
      });
    }
    if (existingUser && !authUserExists) {
      // Existing public.users row without matching auth.users can break createUser
      // via auth trigger unique constraints; remove stale row before retrying.
      await cleanupStaleUserRecord(email);
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        mobile: phone,
      },
    });

    if (authError || !authData?.user?.id) {
      console.error('Service provider admin createUser error:', authError);
      const msg = authError?.message || 'Failed to create auth account';
      const lower = msg.toLowerCase();
      if (
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('exists') ||
        authError?.status === 422
      ) {
        return res.status(409).json({
          error: 'This email is already registered. Please sign in instead.',
        });
      }
      return res.status(400).json({ error: msg });
    }

    const uid = authData.user.id;

    const payload: ServiceProviderPayload = {
      name,
      email,
      phone,
      city,
      workshops,
      skills,
      availability,
    };

    try {
      await supabaseServiceProviderService.create({ ...payload, id: uid });
    } catch (createErr) {
      console.error('service_providers insert failed after auth user created:', createErr);
      try {
        await supabase.auth.admin.deleteUser(uid);
      } catch (delErr) {
        console.error('Rollback: failed to delete auth user after provider insert error:', delErr);
      }
      return res.status(500).json({
        error: 'Could not complete registration. Please try again or contact support.',
      });
    }

    try {
      const u = await supabaseUserService.findByEmail(email);
      if (!u) {
        await supabaseUserService.create({
          name,
          email,
          mobile: phone,
          role: 'seller',
          location: city,
          status: 'active',
          authProvider: 'email',
          firebaseUid: uid,
          createdAt: new Date().toISOString(),
        });
      } else {
        await supabaseUserService.update(email, {
          name,
          mobile: phone,
          role: 'seller',
          location: city,
          status: 'active',
          authProvider: 'email',
          firebaseUid: uid,
        });
      }
    } catch (userSyncErr) {
      console.warn('Service provider users table sync failed (non-fatal):', userSyncErr);
    }

    return res.status(201).json({ success: true, uid });
  } catch (err) {
    console.error('Service provider register error:', err);
    const message = err instanceof Error ? err.message : 'Unexpected error';
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
    }
    return res.status(500).json({ error: message });
  }
}

export async function handleServiceProviders(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  try {
    // CRITICAL FIX: Handle missing/invalid auth token gracefully
    // Some requests might not have auth (e.g., public endpoints, initial page loads)
    let decoded: { uid: string; email: string; user: any } | null = null;
    let uid: string | null = null;
    let email: string = '';
    
    try {
      decoded = await verifyIdTokenFromHeader(req);
      uid = decoded.uid;
      email = decoded.email || '';
    } catch (authError) {
      // If auth fails, check if this is a public endpoint that doesn't require auth
      const scope = (req.query.scope as string) || 'mine';
      
      // Public endpoints that don't require auth
      if (req.method === 'GET' && scope === 'all') {
        const all = await supabaseServiceProviderService.findAll();
        return res.status(200).json(all);
      }
      
      // All other endpoints require authentication
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed';
      if (errorMessage.includes('Missing bearer token')) {
        return res.status(401).json({ 
          error: 'Authentication required. Please sign up or log in first.',
          details: 'Missing or invalid authorization token'
        });
      }
      
      // Re-throw other auth errors
      throw authError;
    }
    
    const scope = (req.query.scope as string) || 'mine';

    if (req.method === 'GET') {
      if (scope === 'all') {
        const all = await supabaseServiceProviderService.findAll();
        return res.status(200).json(all);
      }

      // GET 'mine' requires authentication (already verified above)
      if (!uid) {
        return res.status(401).json({ error: 'Authentication required to fetch your profile' });
      }

      const provider = await supabaseServiceProviderService.findById(uid);
      if (!provider) {
        return res.status(404).json({ error: 'Service provider profile not found' });
      }
      return res.status(200).json({ ...provider, uid: provider.id });
    }

    if (req.method === 'POST') {
      // POST requires authentication
      if (!uid || !email) {
        return res.status(401).json({ error: 'Authentication required to create service provider profile' });
      }
      
      const body = req.body as Partial<ServiceProviderPayload>;
      if (!body.name || !body.email || !body.phone || !body.city) {
        return res.status(400).json({ error: 'Missing required fields: name, email, phone, city' });
      }

      // Enforce separation from main user collection by storing under dedicated path
      const payload: ServiceProviderPayload = {
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone,
        city: body.city,
        workshops: body.workshops || [],
        skills: body.skills || [],
        availability: body.availability || 'weekdays',
      };

      // Only allow creating profile for the authenticated user
      const normalizedPayloadEmail = payload.email.toLowerCase().trim();
      const normalizedAuthEmail = email.toLowerCase().trim();
      
      if (normalizedPayloadEmail !== normalizedAuthEmail) {
        return res.status(403).json({ error: 'Email mismatch with authenticated user' });
      }

      // Check if service provider profile already exists
      try {
        const existingProvider = await supabaseServiceProviderService.findByEmail(payload.email);
        if (existingProvider) {
          return res.status(400).json({ error: 'Service provider profile already exists for this email' });
        }
      } catch (error) {
        // If findByEmail throws (not found), that's fine - we can create new
        console.log('No existing provider found, proceeding with creation');
      }

      try {
        await supabaseServiceProviderService.create({ ...payload, id: uid });
      } catch (createError: any) {
        console.error('Failed to create service provider:', createError);
        // Check if it's a duplicate key error
        if (createError.message?.includes('duplicate') || createError.message?.includes('already exists')) {
          return res.status(400).json({ error: 'Service provider profile already exists for this account' });
        }
        throw createError;
      }

      // Also sync into users collection so the provider shows up in admin panel
      try {
        const existingUser = await supabaseUserService.findByEmail(payload.email);
        if (!existingUser) {
          await supabaseUserService.create({
            name: payload.name,
            email: payload.email,
            mobile: payload.phone,
            role: 'seller', // reuse seller slot for providers in admin panel
            location: payload.city,
            status: 'active',
            authProvider: 'email',
            firebaseUid: uid,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (userError) {
        // Log but don't fail - service provider profile was created successfully
        console.warn('Failed to sync service provider to users table:', userError);
      }

      return res.status(201).json({ uid, ...payload });
    }

    if (req.method === 'PATCH') {
      // PATCH requires authentication
      if (!uid) {
        return res.status(401).json({ error: 'Authentication required to update service provider profile' });
      }
      
      const existing = await supabaseServiceProviderService.findById(uid);
      if (!existing) {
        return res.status(404).json({ error: 'Service provider profile not found' });
      }

      const body = req.body as Partial<ServiceProviderPayload>;
      const updates: Partial<ServiceProviderPayload> = {};
      
      if (body.skills !== undefined) updates.skills = body.skills;
      if (body.workshops !== undefined) updates.workshops = body.workshops;
      if (body.availability !== undefined) updates.availability = body.availability;
      if (body.name !== undefined) updates.name = body.name;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.city !== undefined) updates.city = body.city;
      if (body.state !== undefined) updates.state = body.state;
      if (body.district !== undefined) updates.district = body.district;
      if (body.serviceCategories !== undefined) updates.serviceCategories = body.serviceCategories;

      await supabaseServiceProviderService.update(uid, updates);
      const updated = await supabaseServiceProviderService.findById(uid);
      return res.status(200).json({ ...(updated || existing), uid: updated?.id || uid });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service provider API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    
    // Provide more specific error codes
    if (message.includes('Missing bearer token') || message.includes('Invalid or expired token')) {
      return res.status(401).json({ error: 'Authentication required. Please sign up or log in first.' });
    }
    
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
    }
    
    // Default to 401 for auth errors, 500 for others
    const statusCode = message.includes('token') || message.includes('auth') ? 401 : 500;
    return res.status(statusCode).json({ error: message });
  }
}

// Vercel serverless expects a default export when the module is loaded directly
export default handleServiceProviders;
