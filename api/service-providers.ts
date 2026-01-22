import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { supabaseServiceProviderService } from '../services/supabase-service-provider-service.js';
import { supabaseUserService } from '../services/supabase-user-service.js';
import type { ServiceProviderPayload } from '../services/supabase-service-provider-service.js';

// ServiceProviderPayload is now imported from the service file

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    const uid = decoded.uid;
    const email = decoded.email || '';
    const scope = (req.query.scope as string) || 'mine';

    if (req.method === 'GET') {
      if (scope === 'all') {
        const all = await supabaseServiceProviderService.findAll();
        return res.status(200).json(all);
      }

      const provider = await supabaseServiceProviderService.findById(uid);
      if (!provider) {
        return res.status(404).json({ error: 'Service provider profile not found' });
      }
      return res.status(200).json({ ...provider, uid: provider.id });
    }

    if (req.method === 'POST') {
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

      // Only allow creating profile for the authenticated Firebase user
      if (payload.email !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Email mismatch with authenticated user' });
      }

      await supabaseServiceProviderService.create({ ...payload, id: uid });

      // Also sync into users collection so the provider shows up in admin panel
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

      return res.status(201).json({ uid, ...payload });
    }

    if (req.method === 'PATCH') {
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

      await supabaseServiceProviderService.update(uid, updates);
      const updated = await supabaseServiceProviderService.findById(uid);
      return res.status(200).json({ ...(updated || existing), uid: updated?.id || uid });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Service provider API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(401).json({ error: message });
  }
}

