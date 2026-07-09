import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as core from './shared.js';

async function handleAI(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.includes('/ai-inspection') || pathname.endsWith('/ai-inspection')) {
    return await handleAIInspection(req, res);
  } else if (pathname.includes('/gemini') || pathname.endsWith('/gemini')) {
    return await handleGemini(req, res);
  } else {
    return res.status(404).json({ success: false, reason: 'AI endpoint not found' });
  }
}

// AI Vehicle Photo Inspection handler
async function handleAIInspection(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  const auth = await core.requireAuth(req, res, 'AI Inspection API');
  if (!auth) {
    return;
  }

  try {
    const { model, imageUrls, documentUrls, prompt, vehicleDetails, config } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        success: false,
        reason: 'At least one image URL is required for inspection'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        reason: 'GEMINI_API_KEY environment variable is not configured'
      });
    }

    // Use vision-capable model
    const modelName = model || 'gemini-2.0-flash';
    
    // Build content parts with images
    const parts: any[] = [];
    
    // Add images (limit to 10 for performance)
    const limitedImageUrls = imageUrls.slice(0, 10);
    for (let i = 0; i < limitedImageUrls.length; i++) {
      const imageUrl = limitedImageUrls[i];
      
      // Skip invalid URLs
      if (!imageUrl || typeof imageUrl !== 'string') continue;
      
      try {
        // Fetch image and convert to base64
        const imageResponse = await fetch(imageUrl, {
          headers: { 'Accept': 'image/*' },
          signal: AbortSignal.timeout(10000) // 10s timeout per image
        });
        
        if (!imageResponse.ok) {
          console.warn(`Failed to fetch image ${i + 1}: ${imageResponse.statusText}`);
          continue;
        }
        
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        parts.push({
          inlineData: {
            mimeType: contentType,
            data: base64Data
          }
        });
      } catch (imgError) {
        console.warn(`Error fetching image ${i + 1}:`, imgError instanceof Error ? imgError.message : imgError);
        // Continue with other images
      }
    }
    
    // Add document images if provided
    if (documentUrls && Array.isArray(documentUrls)) {
      for (const docUrl of documentUrls.slice(0, 3)) {
        if (!docUrl || typeof docUrl !== 'string') continue;
        
        try {
          const docResponse = await fetch(docUrl, {
            headers: { 'Accept': 'image/*' },
            signal: AbortSignal.timeout(10000)
          });
          
          if (docResponse.ok) {
            const contentType = docResponse.headers.get('content-type') || 'image/jpeg';
            const arrayBuffer = await docResponse.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            
            parts.push({
              inlineData: {
                mimeType: contentType,
                data: base64Data
              }
            });
          }
        } catch (docError) {
          console.warn('Error fetching document image:', docError);
        }
      }
    }

    if (parts.length === 0) {
      return res.status(400).json({
        success: false,
        reason: 'Could not process any of the provided images. Please ensure URLs are accessible.'
      });
    }

    // Add the text prompt
    const inspectionPrompt = prompt || buildDefaultInspectionPrompt(vehicleDetails);
    parts.push({ text: inspectionPrompt });

    // Build the request body
    const requestBody: any = {
      contents: [{ parts }]
    };

    // Add generation config
    if (config?.responseMimeType) {
      requestBody.generationConfig = {
        responseMimeType: config.responseMimeType
      };
    }

    if (config?.responseSchema) {
      if (!requestBody.generationConfig) {
        requestBody.generationConfig = {};
      }
      requestBody.generationConfig.responseSchema = config.responseSchema;
    }

    // Call Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000) // 60s timeout for vision processing
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Gemini API error: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorBody || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Extract response text
    let generatedText = '';
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        generatedText = candidate.content.parts[0]?.text || '';
      }
    }

    if (!generatedText) {
      generatedText = JSON.stringify(data);
    }

    return res.status(200).json({
      success: true,
      response: generatedText,
      result: generatedText,
      imagesProcessed: parts.length - 1, // Exclude text part
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Inspection Error:', error);
    
    return res.status(500).json({
      success: false,
      reason: 'AI Inspection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Build default inspection prompt if none provided
function buildDefaultInspectionPrompt(vehicleDetails?: any): string {
  const details = vehicleDetails || {};
  
  return `You are an expert vehicle inspector analyzing photos of a used vehicle for an Indian marketplace.

VEHICLE DETAILS:
- Make: ${details.make || 'Unknown'}
- Model: ${details.model || 'Unknown'}
- Year: ${details.year || 'Unknown'}
- Claimed Mileage: ${details.mileage ? `${details.mileage.toLocaleString()} km` : 'Not provided'}
- Fuel Type: ${details.fuelType || 'Not specified'}
- Color: ${details.color || 'Not specified'}

INSPECTION TASK:
Analyze all provided vehicle images thoroughly. Provide a comprehensive inspection report including:

1. OVERALL ASSESSMENT:
   - Overall condition score (0-100)
   - Overall confidence in assessment (0-100)

2. EXTERIOR CONDITION:
   - Score (0-100)
   - Paint condition: excellent/good/fair/poor
   - Body condition: excellent/good/fair/poor
   - List any findings (scratches, dents, rust, paint damage, cracks)
   - Summary

3. INTERIOR CONDITION:
   - Score (0-100)
   - Seat condition: excellent/good/fair/poor
   - Dashboard condition: excellent/good/fair/poor
   - Cleanliness: spotless/clean/average/needs_cleaning
   - List any findings (wear, tear, stains)
   - Summary

4. TYRE CONDITION:
   - Score (0-100)
   - Estimated tread depth: new/good/fair/replace_soon/unsafe
   - Mismatched tyres: true/false
   - Brand visible (if any)
   - Summary

5. PHOTO QUALITY:
   - Overall score (0-100)
   - Issues: blur/low_light/obstructed/reflection/too_far/wrong_angle
   - Missing views: front/rear/left_side/right_side/interior_front/interior_rear/engine_bay/boot/odometer/tyres
   - Recommendations for better photos

6. HIGHLIGHTS (positive points about the vehicle)

7. CONCERNS (issues to be aware of)

8. BUYER ADVISORY (recommendations for potential buyers)

GRADING:
- A (90-100): Excellent - Like new
- B (75-89): Good - Minor wear, well maintained
- C (60-74): Fair - Visible wear, some issues
- D (40-59): Poor - Significant issues
- F (0-39): Very Poor - Major damage

Be realistic and fair. Indian used car market context applies.

Respond ONLY with a valid JSON object matching the requested schema.`;
}

// Gemini handler
async function handleGemini(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  const geminiAuth = await core.requireAuth(req, res, 'Gemini API');
  if (!geminiAuth) {
    return;
  }

  try {
    const { payload } = req.body;
    
    if (!payload) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Payload is required' 
      });
    }

    // Validate API key presence
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        reason: 'GEMINI_API_KEY environment variable is not configured'
      });
    }

    // Extract model, contents, and generation options from payload
    const model = payload.model || 'gemini-2.5-flash';
    const contents = payload.contents || payload.prompt || '';
    const generationOptions = payload.config || {};

    // Build the request body for Gemini API
    const requestBody: any = {
      contents: typeof contents === 'string' 
        ? [{ parts: [{ text: contents }] }]
        : contents
    };

    // Add generation config if provided
    if (generationOptions.responseMimeType) {
      requestBody.generationConfig = {
        responseMimeType: generationOptions.responseMimeType
      };
    }

    // Add response schema if provided
    if (generationOptions.responseSchema) {
      if (!requestBody.generationConfig) {
        requestBody.generationConfig = {};
      }
      requestBody.generationConfig.responseSchema = generationOptions.responseSchema;
    }

    // Add thinking core.config if provided
    if (generationOptions.thinkingConfig) {
      requestBody.generationConfig = requestBody.generationConfig || {};
      requestBody.generationConfig.thinkingConfig = generationOptions.thinkingConfig;
    }

    // Use the new Gemini API endpoint format
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `API error: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.error || errorBody || errorMessage;
      } catch {
        errorMessage = errorBody || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Extract response text - handle both text and JSON responses
    let generatedText = '';
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        // For JSON responses, the text might be in parts[0].text
        generatedText = candidate.content.parts[0]?.text || '';
      }
    }

    // If no text found, try alternative paths
    if (!generatedText && data.text) {
      generatedText = data.text;
    }

    // If still no text, return the full response for debugging
    if (!generatedText) {
      generatedText = JSON.stringify(data);
    }

    return res.status(200).json({
      success: true,
      response: generatedText,
      result: generatedText, // Alias for compatibility
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini API Error:', error);
    
    return res.status(500).json({
      success: false,
      reason: 'Gemini API call failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Content handler - consolidates content.ts
async function handleContent(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  if (!core.USE_SUPABASE) {
    // For GET requests, return 200 with empty payload instead of 503
    if (req.method === 'GET') {
      const { type } = req.query;
      res.setHeader('X-Data-Fallback', 'true');
      if (type === 'faqs') {
        return res.status(200).json([]);
      }
      // Support tickets client expects { success, tickets, count } — returning a
      // bare [] makes data.tickets undefined on the client and shows 0 tickets.
      if (type === 'support-tickets') {
        return res.status(200).json({ success: true, tickets: [], count: 0 });
      }
    }
    return res.status(503).json({
      success: false,
      reason: 'Firebase is not configured. Please set Firebase environment variables.'
    });
  }

  try {
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res);
      case 'support-tickets':
        return await handleSupportTickets(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid content type. Use ?type=faqs or ?type=support-tickets' 
        });
    }
  } catch (error) {
    console.error('Content API Error:', error);
    
    // For GET requests, always return 200 with empty payload instead of 500
    if (req.method === 'GET') {
      const { type } = req.query;
      if (type === 'faqs') {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json([]);
      }
      if (type === 'support-tickets') {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({ success: true, tickets: [], count: 0 });
      }
    }
    
    // For other methods, return 500 with error details
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// FAQs Handler
async function handleFAQs(req: VercelRequest, res: VercelResponse) {
  const faqsPath = 'faqs';

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, faqsPath);
    case 'POST':
      return await handleCreateFAQ(req, res, faqsPath);
    case 'PUT':
      return await handleUpdateFAQ(req, res, faqsPath);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, faqsPath);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const { category } = req.query;
    
    const allFaqs = await core.adminReadAll<Record<string, unknown>>(faqsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let faqs = Object.entries(allFaqs).map(([id, data]) => ({ ...data, id }));
    
    if (category && category !== 'all' && typeof category === 'string') {
      // Sanitize category
      const sanitizedCategory = await core.sanitizeString(category);
      faqs = faqs.filter(faq => ((faq as Record<string, unknown>).category as string) === sanitizedCategory);
    }
    
    return res.status(200).json({
      success: true,
      faqs,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    // Always return 200 with empty array instead of 500
    res.setHeader('X-Data-Fallback', 'true');
    return res.status(200).json({
      success: true,
      faqs: [],
      count: 0
    });
  }
}

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Create FAQ');
    if (!admin) {
      return;
    }

    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const id = `faq_${Date.now()}`;
    const faq = {
      ...faqData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await core.adminCreate(faqsPath, faq, id);

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Update FAQ');
    if (!admin) {
      return;
    }

    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(faqsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    await core.adminUpdate(faqsPath, String(id), {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully'
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Delete FAQ');
    if (!admin) {
      return;
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    await core.adminDelete(faqsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
}

// Support Tickets Handler
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
  const ticketsPath = 'support_tickets';
  // Accept either the legacy app JWT or a Supabase access token so that admins
  // signed in via Supabase OAuth can read/manage tickets (previously the admin
  // panel showed 0 tickets because the legacy-only auth rejected Supabase tokens).
  const auth = await core.authenticateRequestDual(req);
  if (!auth.isValid) {
    core.logWarn('⚠️ Support tickets - Authentication failed:', auth.error);
    res.status(401).json({
      success: false,
      reason: auth.error || 'Authentication required.',
      error: 'Invalid or expired authentication token'
    });
    return;
  }

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, ticketsPath, auth);
    case 'POST':
      return await handleCreateSupportTicket(req, res, ticketsPath, auth);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, ticketsPath, auth);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, ticketsPath, auth);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { userEmail, status } = req.query;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';
    
    const allTickets = await core.adminReadAll<Record<string, unknown>>(ticketsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let tickets = Object.entries(allTickets).map(([id, data]) => ({ ...data, id }));
    
    if (userEmail && typeof userEmail === 'string') {
      // Sanitize email
      const sanitizedEmail = await core.sanitizeString(userEmail);
      if (!isAdmin && normalizedAuthEmail !== sanitizedEmail.toLowerCase().trim()) {
        return res.status(200).json({ success: true, tickets: [], count: 0 });
      }
      tickets = tickets.filter(ticket => ((ticket as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() === sanitizedEmail.toLowerCase().trim());
    } else if (!isAdmin) {
      // For authenticated non-admin users, default to their own tickets when no userEmail is provided.
      // This prevents noisy 403s from dashboard polling calls that omit userEmail.
      tickets = tickets.filter(
        (ticket) =>
          ((ticket as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() ===
          normalizedAuthEmail,
      );
    }
    
    if (status && typeof status === 'string') {
      // Validate status is one of allowed values
      const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
      if (allowedStatuses.includes(status)) {
        tickets = tickets.filter(ticket => (ticket as Record<string, unknown>).status === status);
      }
    }

    // Sort by createdAt descending
    tickets = tickets.sort((a, b) => {
      const aTime = (a as Record<string, unknown>).createdAt ? new Date((a as Record<string, unknown>).createdAt as string).getTime() : 0;
      const bTime = (b as Record<string, unknown>).createdAt ? new Date((b as Record<string, unknown>).createdAt as string).getTime() : 0;
      return bTime - aTime;
    });
    
    return res.status(200).json({
      success: true,
      tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch support tickets' 
    });
  }
}

async function handleCreateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const ticketData = req.body;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const sanitizedEmail = (await core.sanitizeString(String(ticketData.userEmail))).toLowerCase().trim();
    if (!isAdmin && sanitizedEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket creation' });
    }

    const id = `ticket_${Date.now()}`;
    const ticket = {
      ...ticketData,
      userEmail: isAdmin ? sanitizedEmail : normalizedAuthEmail,
      id,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    };

    await core.adminCreate(ticketsPath, ticket, id);

    // Fan out a notification to every admin so the admin panel shows a real-time
    // alert when a new support ticket arrives. Failures here must not block the
    // ticket response — admins will still see the ticket in the list.
    try {
      await notifyAdminsOfSupportTicket(ticket);
    } catch (notifyErr) {
      core.logWarn('⚠️ Failed to notify admins of new support ticket (non-fatal):', notifyErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

// Insert one notification row per admin user when a new support ticket arrives.
// Uses the same `notifications` table/schema as user notifications so the
// existing polling + realtime pipeline in the admin UI picks them up with no
// additional wiring. Silent on failure.
async function notifyAdminsOfSupportTicket(ticket: Record<string, unknown>): Promise<void> {
  if (!core.USE_SUPABASE) return;
  try {
    const supabase = core.getSupabaseAdminClient();
    const { data: admins, error } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin');

    if (error) {
      core.logWarn('notifyAdminsOfSupportTicket: failed to load admins', error);
      return;
    }

    const adminEmails = (admins || [])
      .map((u: { email?: string | null }) => (u.email || '').toLowerCase().trim())
      .filter((e: string) => !!e);

    if (adminEmails.length === 0) return;

    const subject = String(ticket.subject || 'New support ticket');
    const requester = String(ticket.userName || ticket.userEmail || 'A user');
    const ticketId = String(ticket.id || '');
    const now = new Date().toISOString();

    // notifications.id column is TEXT — store string form of a numeric-looking
    // id so downstream clients that treat it as a number can still parse it.
    const baseId = Date.now();
    const rows = adminEmails.map((email: string, idx: number) => ({
      id: String(baseId + idx),
      user_id: email,
      recipient_email: email,
      type: 'general_admin',
      title: 'New support ticket',
      message: `${requester} opened: ${subject}`,
      read: false,
      created_at: now,
      updated_at: now,
      metadata: {
        targetType: 'general_admin',
        targetId: ticketId,
        ticketId,
        subject,
        userEmail: ticket.userEmail,
        userName: ticket.userName
      }
    }));

    const { error: insertError } = await supabase.from('notifications').insert(rows);
    if (insertError) {
      core.logWarn('notifyAdminsOfSupportTicket: insert failed', insertError);
    }
  } catch (err) {
    core.logWarn('notifyAdminsOfSupportTicket: unexpected error', err);
  }
}

async function handleUpdateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { id } = req.query;
    const updateData = req.body;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket update' });
    }

    if (!isAdmin && updateData?.userEmail) {
      delete updateData.userEmail;
    }

    await core.adminUpdate(ticketsPath, String(id), {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { id } = req.query;
      const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Support ticket not found' });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket deletion' });
    }

    await core.adminDelete(ticketsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete support ticket'
    });
  }
}

// ============================================================================
// Platform Settings handler — reads/writes the single `platform_settings` row
// (table created by scripts/add-platform-settings-and-audit-log.sql).
// ============================================================================
const PLATFORM_SETTINGS_ID = 'singleton';
const DEFAULT_PLATFORM_SETTINGS = {
  listingFee: 25,
  siteAnnouncement: 'Welcome to ReRide! All EVs are 10% off this week.',
} as const;

async function handlePlatformSettings(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (!core.USE_SUPABASE) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, settings: { ...DEFAULT_PLATFORM_SETTINGS } });
    }
    return res.status(503).json({
      success: false,
      reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  try {
    const supabase = core.getSupabaseAdminClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('listingFee, siteAnnouncement, updatedAt, updatedBy')
        .eq('id', PLATFORM_SETTINGS_ID)
        .maybeSingle();

      if (error) {
        // If the table is missing, fall back to defaults so the app keeps working.
        core.logWarn('platform_settings read failed, returning defaults:', error.message);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({ success: true, settings: { ...DEFAULT_PLATFORM_SETTINGS } });
      }

      const settings = data
        ? {
            listingFee: Number(data.listingFee ?? DEFAULT_PLATFORM_SETTINGS.listingFee),
            siteAnnouncement: typeof data.siteAnnouncement === 'string'
              ? data.siteAnnouncement
              : (DEFAULT_PLATFORM_SETTINGS.siteAnnouncement as string),
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || null,
          }
        : { ...DEFAULT_PLATFORM_SETTINGS };

      return res.status(200).json({ success: true, settings });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const admin = await core.requireAdmin(req, res, 'Update platform settings');
      if (!admin) return;

      const body = (req.body || {}) as Record<string, unknown>;
      const rawFee = body.listingFee;
      const rawAnnouncement = body.siteAnnouncement;

      const feeNum = typeof rawFee === 'number'
        ? rawFee
        : typeof rawFee === 'string' && rawFee.trim() !== ''
          ? Number(rawFee)
          : undefined;

      const payload: Record<string, unknown> = {
        id: PLATFORM_SETTINGS_ID,
        updatedAt: new Date().toISOString(),
        updatedBy: admin.user?.email || null,
      };

      if (feeNum !== undefined && Number.isFinite(feeNum)) {
        payload.listingFee = Math.max(0, Math.floor(feeNum));
      }
      if (typeof rawAnnouncement === 'string') {
        payload.siteAnnouncement = rawAnnouncement.trim();
      }

      if (payload.listingFee === undefined && payload.siteAnnouncement === undefined) {
        return res.status(400).json({
          success: false,
          reason: 'At least one of listingFee or siteAnnouncement is required.',
        });
      }

      const { data, error } = await supabase
        .from('platform_settings')
        .upsert(payload, { onConflict: 'id' })
        .select('listingFee, siteAnnouncement, updatedAt, updatedBy')
        .maybeSingle();

      if (error) {
        core.logError('platform_settings upsert failed:', error.message);
        return res.status(500).json({ success: false, reason: error.message });
      }

      return res.status(200).json({
        success: true,
        settings: data
          ? {
              listingFee: Number(data.listingFee ?? DEFAULT_PLATFORM_SETTINGS.listingFee),
              siteAnnouncement: typeof data.siteAnnouncement === 'string'
                ? data.siteAnnouncement
                : (DEFAULT_PLATFORM_SETTINGS.siteAnnouncement as string),
              updatedAt: data.updatedAt || null,
              updatedBy: data.updatedBy || null,
            }
          : { ...DEFAULT_PLATFORM_SETTINGS },
      });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.logError('handlePlatformSettings error:', message);
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, settings: { ...DEFAULT_PLATFORM_SETTINGS } });
    }
    return res.status(500).json({ success: false, reason: message });
  }
}

// ============================================================================
// Audit Log handler — admin-only append-and-list over `audit_log` table
// (table created by scripts/add-platform-settings-and-audit-log.sql).
// ============================================================================
async function handleAuditLog(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (!core.USE_SUPABASE) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, entries: [] });
    }
    return res.status(503).json({
      success: false,
      reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  try {
    const admin = await core.requireAdmin(req, res, 'Audit log');
    if (!admin) return;

    const supabase = core.getSupabaseAdminClient();

    if (req.method === 'GET') {
      const limitRaw = core.firstQueryParam(req.query?.limit);
      const limitNum = limitRaw ? Number(limitRaw) : 500;
      const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), 1000) : 500;

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, timestamp, actor, action, target, details')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        core.logWarn('audit_log read failed, returning empty list:', error.message);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({ success: true, entries: [] });
      }

      const entries = (data || []).map((row) => ({
        id: typeof row.id === 'number' ? row.id : Number(row.id),
        timestamp: row.timestamp,
        actor: row.actor,
        action: row.action,
        target: row.target,
        details: row.details || undefined,
      }));

      return res.status(200).json({ success: true, entries });
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as Record<string, unknown>;
      const rawEntries = Array.isArray(body.entries)
        ? (body.entries as Record<string, unknown>[])
        : [body];

      const rows = rawEntries
        .map((entry) => {
          const id = typeof entry.id === 'number'
            ? entry.id
            : typeof entry.id === 'string'
              ? Number(entry.id)
              : Date.now();
          const actor = typeof entry.actor === 'string' ? entry.actor.slice(0, 255) : '';
          const action = typeof entry.action === 'string' ? entry.action.slice(0, 255) : '';
          const target = typeof entry.target === 'string' ? entry.target.slice(0, 500) : '';
          const details = typeof entry.details === 'string' ? entry.details.slice(0, 2000) : null;
          const timestamp = typeof entry.timestamp === 'string'
            ? entry.timestamp
            : new Date().toISOString();
          if (!Number.isFinite(id) || !actor || !action || !target) {
            return null;
          }
          return { id, timestamp, actor, action, target, details };
        })
        .filter((row): row is {
          id: number;
          timestamp: string;
          actor: string;
          action: string;
          target: string;
          details: string | null;
        } => row !== null);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          reason: 'At least one valid entry with actor/action/target is required.',
        });
      }

      const { error } = await supabase
        .from('audit_log')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        core.logError('audit_log insert failed:', error.message);
        return res.status(500).json({ success: false, reason: error.message });
      }

      return res.status(200).json({ success: true, inserted: rows.length });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.logError('handleAuditLog error:', message);
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, entries: [] });
    }
    return res.status(500).json({ success: false, reason: message });
  }
}

// Business handler - consolidates business.ts (payments and plans)
async function handleBusiness(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname || '';
    
    // Preferred: explicit query (?type=payments|plans)
    let type = (req.query.type as string) || '';
    
    // Backward/alternate compatibility: infer from path
    if (!type) {
      if (pathname.includes('/payments')) {
        type = 'payments';
      } else if (pathname.includes('/plans')) {
        type = 'plans';
      }
    }
    
    switch (type) {
      case 'payments':
        return await handlePayments(req, res, _options);
      case 'plans':
        return await handlePlans(req, res, _options);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid business type. Use ?type=payments or ?type=plans' 
        });
    }
  } catch (error) {
    console.error('Business API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Payments Handler
async function handlePayments(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      });
    }

    const { action } = req.query;
    const paymentRequestsPath = 'payment_requests';

    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const createAuth = await core.requireAuth(req, res, 'Create payment request');
        if (!createAuth) {
          return;
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const sellerEmail = body.sellerEmail;
        const amount = body.amount;
        const planRaw = body.plan ?? body.planId;
        const packageId = body.packageId;
        const paymentProof = body.paymentProof;
        const paymentMethod = body.paymentMethod;
        const transactionId = body.transactionId;
        const plan = planRaw as string;

        if (!sellerEmail || amount == null || !plan) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email, amount, and plan (or planId) are required' 
          });
        }

        const authedEmail = createAuth.user?.email ? createAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (createAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({
            success: false,
            reason: 'You can only create payment requests for your own seller account.',
          });
        }

        const now = new Date().toISOString();
        const id = `payment_${Date.now()}`;
        // Persist payment request in Supabase (planId mirrors client types; plan kept for older rows)
        const paymentRequest = {
          id,
          sellerEmail,
          amount: Number(amount),
          plan,
          planId: plan,
          packageId,
          paymentProof: paymentProof != null ? String(paymentProof) : undefined,
          paymentMethod: paymentMethod != null ? String(paymentMethod) : undefined,
          transactionId: transactionId != null ? String(transactionId) : undefined,
          status: 'pending',
          createdAt: now,
          requestedAt: now,
          updatedAt: now
        };

        await core.adminCreate(paymentRequestsPath, paymentRequest, String(paymentRequest.id));

        return res.status(201).json({
          success: true,
          paymentRequest,
          message: 'Payment request created successfully'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'create-razorpay-order') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }
      try {
        const orderAuth = await core.requireAuth(req, res, 'Create Razorpay order');
        if (!orderAuth) return;

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
          return res.status(503).json({
            success: false,
            reason: 'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.',
          });
        }

        const b = (req.body || {}) as Record<string, unknown>;
        const amountPaise = b.amountPaise;
        const planId = b.planId;
        const sellerEmail = b.sellerEmail;
        if (amountPaise == null || !planId || !sellerEmail) {
          return res.status(400).json({
            success: false,
            reason: 'amountPaise, planId, and sellerEmail are required',
          });
        }

        const authedEmail = orderAuth.user?.email ? orderAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (orderAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({ success: false, reason: 'You can only create orders for your own account.' });
        }

        const orderBody = JSON.stringify({
          amount: Math.round(Number(amountPaise)),
          currency: 'INR',
          receipt: `reride_${Date.now()}`,
          notes: { planId: String(planId), sellerEmail: String(sellerEmail) },
        });

        const rzRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: orderBody,
        });
        const rzJson = (await rzRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (!rzRes.ok) {
          const msg =
            (rzJson.description as string) ||
            (rzJson.error as { description?: string } | undefined)?.description ||
            'Razorpay order failed';
          return res.status(502).json({ success: false, reason: msg });
        }

        return res.status(200).json({
          success: true,
          orderId: rzJson.id,
          amount: rzJson.amount,
          currency: rzJson.currency,
          keyId,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: error instanceof Error ? error.message : 'Failed to create Razorpay order',
        });
      }
    }

    if (action === 'confirm-razorpay-payment') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }
      try {
        const confirmAuth = await core.requireAuth(req, res, 'Confirm Razorpay payment');
        if (!confirmAuth) return;

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          return res.status(503).json({ success: false, reason: 'Online payments are not configured.' });
        }

        const b = (req.body || {}) as Record<string, unknown>;
        const razorpay_order_id = b.razorpay_order_id;
        const razorpay_payment_id = b.razorpay_payment_id;
        const razorpay_signature = b.razorpay_signature;
        const planId = b.planId;
        const sellerEmail = b.sellerEmail;
        const amount = b.amount;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId || !sellerEmail) {
          return res.status(400).json({
            success: false,
            reason: 'razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, and sellerEmail are required',
          });
        }

        const authedEmail = confirmAuth.user?.email ? confirmAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (confirmAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({ success: false, reason: 'Forbidden' });
        }

        const sigPayload = `${String(razorpay_order_id)}|${String(razorpay_payment_id)}`;
        const expectedSig = core.createHmac('sha256', keySecret).update(sigPayload).digest('hex');
        if (expectedSig !== String(razorpay_signature)) {
          return res.status(400).json({ success: false, reason: 'Invalid payment signature' });
        }

        const now = new Date().toISOString();
        const id = `payment_rzp_${Date.now()}`;
        const planStr = String(planId);
        const paymentRequest = {
          id,
          sellerEmail: String(sellerEmail),
          amount: Number(amount) || 0,
          plan: planStr,
          planId: planStr,
          status: 'approved',
          paymentMethod: 'razorpay',
          transactionId: String(razorpay_payment_id),
          razorpayOrderId: String(razorpay_order_id),
          createdAt: now,
          requestedAt: now,
          updatedAt: now,
          reviewedAt: now,
          notes: 'Verified via Razorpay',
        };

        await core.adminCreate(paymentRequestsPath, paymentRequest, String(id));

        // Upgrade the seller's subscription plan immediately after a verified payment.
        // Previously this only happened after an admin manually approved the payment_requests row,
        // which meant paying sellers waited indefinitely for access. With a verified Razorpay
        // signature we can safely activate the plan right here.
        //
        // IMPORTANT: Do NOT upgrade the user's subscription when the plan is actually a boost
        // package – boosts use the same create-order endpoint but a different confirmation path
        // (/api/vehicles?action=boost). If we ever receive one here, just record the payment.
        let updatedUser: Record<string, unknown> | null = null;
        const planLowerCandidate = planStr.toLowerCase();
        const normalizedPlanCandidate = planLowerCandidate === 'basic' ? 'free' : planLowerCandidate;
        const isBoostPlan = planLowerCandidate.startsWith('boost');
        const isDealAssistPlan = planLowerCandidate.startsWith('deal_assist');
        // Only allow supported subscription tiers to land in the user row.
        const ALLOWED_SUBSCRIPTION_PLANS = new Set(['free', 'pro', 'premium']);
        const isKnownPlan = ALLOWED_SUBSCRIPTION_PLANS.has(normalizedPlanCandidate);
        try {
          const existingUser = (!isBoostPlan && !isDealAssistPlan && isKnownPlan)
            ? await core.userService.findByEmail(String(sellerEmail))
            : null;
          if (existingUser) {
            const planLower = normalizedPlanCandidate;
            // Resolve plan duration – default to 30 days. Callers can override with `durationDays`.
            const requestedDays = Number((b as Record<string, unknown>).durationDays);
            const planDurationDays = Number.isFinite(requestedDays) && requestedDays > 0
              ? Math.min(365, Math.floor(requestedDays))
              : 30;
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + planDurationDays);

            const userUpdate: Record<string, unknown> = {
              subscriptionPlan: planLower,
              planExpiryDate: expiry.toISOString(),
              planUpdatedAt: now,
              lastPaymentId: String(razorpay_payment_id),
            };
            await core.userService.update(normSeller, userUpdate);
            updatedUser = { ...(existingUser as unknown as Record<string, unknown>), ...userUpdate };
          } else if (!isBoostPlan && !isDealAssistPlan && !isKnownPlan) {
            core.logWarn('confirm-razorpay-payment: unknown plan id, skipping user upgrade:', planStr);
          } else if (!isBoostPlan && !isDealAssistPlan) {
            core.logWarn('confirm-razorpay-payment: seller not found in users table:', sellerEmail);
          }
        } catch (planUpgradeErr) {
          core.logWarn('Failed to auto-upgrade plan after Razorpay confirm:', planUpgradeErr);
          // We still return success for the payment itself; the admin can retroactively fix the user.
        }

        return res.status(201).json({
          success: true,
          paymentRequest,
          user: updatedUser,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: error instanceof Error ? error.message : 'Failed to confirm payment',
        });
      }
    }

    if (action === 'status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const statusAuth = await core.requireAuth(req, res, 'Payment status');
        if (!statusAuth) {
          return;
        }

        const { sellerEmail } = req.query;
        
        if (!sellerEmail) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email is required' 
          });
        }

        const authedEmail = statusAuth.user?.email ? statusAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (statusAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({
            success: false,
            reason: 'You can only view payment status for your own account.',
          });
        }

        const allRequests = await core.adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        const sellerRequests = Object.values(allRequests)
          .filter((r) => String(r.sellerEmail || '').toLowerCase().trim() === String(sellerEmail).toLowerCase().trim())
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
            const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
            return bTime - aTime;
          });

        const latest = sellerRequests[0];
        const paymentStatus = latest
          ? {
              sellerEmail: String(latest.sellerEmail || sellerEmail),
              status: String(latest.status || 'pending'),
              lastPayment: latest,
              nextDue: null
            }
          : {
              sellerEmail: sellerEmail as string,
              status: 'none',
              lastPayment: null,
              nextDue: null
            };

        return res.status(200).json({
          success: true,
          paymentStatus
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment status',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'approve') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const approveAdmin = await core.requireAdmin(req, res, 'Approve payment');
        if (!approveAdmin) {
          return;
        }

        const { paymentRequestId } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        await core.adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: req.body?.notes,
          adminEmail: req.body?.adminEmail
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request approved successfully',
          paymentRequestId
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to approve payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'reject') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const rejectAdmin = await core.requireAdmin(req, res, 'Reject payment');
        if (!rejectAdmin) {
          return;
        }

        const { paymentRequestId, rejectionReason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        await core.adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rejectionReason: rejectionReason || 'No reason provided',
          adminEmail: req.body?.adminEmail
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: rejectionReason || 'No reason provided'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to reject payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get all payment requests
    if (req.method === 'GET') {
      try {
        const listAdmin = await core.requireAdmin(req, res, 'List payment requests');
        if (!listAdmin) {
          return;
        }

        const { status } = req.query;
        const allRequests = await core.adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        let paymentRequests = Object.values(allRequests);

        if (status && typeof status === 'string') {
          const normalizedStatus = status.toLowerCase().trim();
          paymentRequests = paymentRequests.filter((request) =>
            String(request.status || '').toLowerCase().trim() === normalizedStatus
          );
        }

        paymentRequests = paymentRequests.sort((a, b) => {
          const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
          const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
          return bTime - aTime;
        });
        
        return res.status(200).json({
          success: true,
          paymentRequests
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment requests',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle invalid or missing action parameter
    if (!action) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Action parameter is required. Valid actions: create, create-razorpay-order, confirm-razorpay-payment, status, approve, reject' 
      });
    }

    // If action doesn't match any known action, return 400 instead of 500
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid payment action: ${action}. Valid actions: create, create-razorpay-order, confirm-razorpay-payment, status, approve, reject` 
    });
  } catch (error) {
    console.error('Payments Handler Error:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // If it's a database connection error, return 503
    if (error instanceof Error && (error.message.includes('FIREBASE') || error.message.includes('Firebase') || error.message.includes('connect'))) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Payments handler failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Conversations Handler
async function insertConversationMessageNotification(params: {
  recipientEmail: string;
  senderName: string;
  messageText: string;
  conversationId: string;
}): Promise<void> {
  const recipientEmail = String(params.recipientEmail || '').toLowerCase().trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return;
  }
  const messageText = typeof params.messageText === 'string' ? params.messageText : '';
  const senderName = params.senderName || 'User';
  const notificationMessage =
    messageText.length > 50
      ? `New message from ${senderName}: ${messageText.substring(0, 50)}...`
      : `New message from ${senderName}: ${messageText}`;
  const notificationId = Date.now() * 1000 + core.randomInt(0, 1000);
  try {
    const supabase = core.getSupabaseAdminClient();
    const record: Record<string, unknown> = {
      user_id: recipientEmail,
      recipient_email: recipientEmail,
      type: 'conversation',
      title: 'New message',
      message: notificationMessage,
      read: false,
      is_read: false,
      created_at: new Date().toISOString(),
      metadata: {
        conversationId: String(params.conversationId),
        targetType: 'conversation',
        targetId: String(params.conversationId),
      },
    };
    const inserted = await supabase
      .from('notifications')
      .insert({ ...record, id: notificationId })
      .select('id')
      .single();
    if (inserted.error) {
      const retry = await supabase.from('notifications').insert(record).select('id').single();
      if (retry.error) {
        console.warn('⚠️ API: Failed to create message notification (non-fatal):', retry.error.message);
      }
    }
  } catch (notifErr) {
    console.warn('⚠️ API: Failed to create message notification (non-fatal):', notifErr);
  }
}

async function handleConversations(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: core.AuthResult | null = null;
    let normalizedAuthEmail = '';
    let normalizedAuthUserId = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      auth = await core.authenticateRequestDual(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
        normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
    } else {
      auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user) {
        core.logWarn('⚠️ Conversations - Authentication failed:', auth.error);
        return res.status(401).json({
          success: false,
          reason: auth.error || 'Authentication required.',
          error: 'Invalid or expired authentication token',
        });
      }
      normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
      normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
      isAdmin = auth.user.role === 'admin';
    }
    const isAuthParticipant = (participantId: string): boolean =>
      core.participantIdMatchesAppUser(
        participantId,
        normalizedAuthEmail,
        normalizedAuthUserId,
      );

    // GET - Retrieve conversations
    if (req.method === 'GET') {
      const { customerId, sellerId, conversationId } = req.query;
      
      if (conversationId) {
        // Get single conversation
        const conversation = await core.conversationService.findById(String(conversationId));
        if (!conversation) {
          // 200 + null avoids noisy console 404s during open-thread polling before sync completes.
          return res.status(200).json({ success: true, data: null });
        }
        const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
        const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
        // If not authenticated, return empty payload (don't reveal conversation exists)
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: null });
        }
        if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
          return res.status(200).json({ success: true, data: null });
        }
        return res.status(200).json({ success: true, data: conversation });
      }
      
      let conversations;
      if (customerId) {
        const normalizedCustomerId = String(customerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && !isAuthParticipant(normalizedCustomerId)) {
          return res.status(200).json({ success: true, data: [] });
        }
        conversations = await core.conversationService.findByCustomerId(String(customerId));
      } else if (sellerId) {
        const normalizedSellerId = String(sellerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && !isAuthParticipant(normalizedSellerId)) {
          return res.status(200).json({ success: true, data: [] });
        }
        // CRITICAL: Pass normalized sellerId to service for consistent matching
        // The service will also normalize internally, but passing normalized ensures consistency
        conversations = await core.conversationService.findBySellerId(normalizedSellerId);
        
        // Log for debugging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 API: Fetching conversations for seller', {
            originalSellerId: String(sellerId),
            normalizedSellerId,
            foundCount: conversations?.length || 0
          });
        }
      } else {
        // No customerId or sellerId - return empty array if not admin or not authenticated
        if (!auth || !auth.isValid || !isAdmin) {
          // Return empty array instead of 401 for unauthenticated requests
          return res.status(200).json({ success: true, data: [] });
        }
        conversations = await core.conversationService.findAll();
      }
      
      // Sort by lastMessageAt descending
      conversations = conversations.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      try {
        const { enrichConversationsWithDealFlags } = await import('../handlers/conversation-lifecycle.js');
        conversations = await enrichConversationsWithDealFlags(conversations);
      } catch (enrichErr) {
        core.logWarn('⚠️ Failed to enrich conversations with deal flags (non-fatal):', enrichErr);
      }
      
      return res.status(200).json({ success: true, data: conversations });
    }

    // POST - Create or update conversation
    if (req.method === 'POST') {
      const conversationData = req.body;
      
      if (!conversationData.id) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const normalizedCustomerId = String(conversationData.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversationData.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      // Check if conversation exists (by client id / metadata alias, uuid, or vehicle + customer)
      let existing = await core.conversationService.findById(conversationData.id);
      if (!existing && conversationData.vehicleId != null && conversationData.customerId) {
        existing = await core.conversationService.findByVehicleAndCustomer(
          String(conversationData.vehicleId),
          String(conversationData.customerId).toLowerCase().trim(),
        );
      }
      if (existing) {
        await core.conversationService.update(existing.id, conversationData);
        const updated = await core.conversationService.findById(existing.id);
        return res.status(200).json({ success: true, data: updated });
      } else {
        const conversation = await core.conversationService.create(conversationData);

        if (conversationData.vehicleId != null) {
          try {
            const mutation = await core.resolveVehicleForMutation({
              vehicleId: conversationData.vehicleId,
              databaseId: conversationData.vehicleDatabaseId,
            });
            if (mutation.ok) {
              const currentInquiries =
                typeof mutation.vehicle.inquiriesCount === 'number' ? mutation.vehicle.inquiriesCount : 0;
              await core.vehicleService.update(mutation.primaryKey, {
                inquiriesCount: currentInquiries + 1,
              });
            }
          } catch (inquiryError) {
            core.logWarn('⚠️ Failed to increment inquiry count (non-fatal):', inquiryError);
          }
        }

        return res.status(200).json({ success: true, data: conversation });
      }
    }

    // PUT - Update conversation (add message or offer response)
    if (req.method === 'PUT') {
      const body = req.body as {
        conversationId?: string;
        message?: any;
      };
      const { conversationId, message } = body;

      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));

      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      if (!message) {
        return res.status(400).json({ success: false, reason: 'Conversation ID and message are required' });
      }

      if (typeof message.text === 'string') {
        message.text = await core.sanitizeString(message.text.slice(0, 4000));
      }

      try {
        console.log('💾 API: Adding message to conversation:', { conversationId, messageId: message?.id });
        await core.conversationService.addMessage(String(conversationId), message);
        const updatedConversation = await core.conversationService.findById(String(conversationId));
        
        if (!updatedConversation) {
          console.error('❌ API: Conversation not found after adding message:', conversationId);
          return res.status(500).json({ success: false, reason: 'Failed to retrieve updated conversation' });
        }
        
        // Create notification for the recipient (other party) so they get notified even when app is closed
        const actingAsCustomer = isAuthParticipant(normalizedCustomerId);
        const recipientEmail = actingAsCustomer
          ? String(updatedConversation.sellerId || normalizedSellerId)
          : String(updatedConversation.customerId || normalizedCustomerId);
        const senderName = actingAsCustomer
          ? (conversation.customerName || 'Customer')
          : (conversation.sellerName || 'Seller');
        const messageText = typeof message.text === 'string' ? message.text : '';
        await insertConversationMessageNotification({
          recipientEmail,
          senderName,
          messageText,
          conversationId: String(updatedConversation.id || conversationId),
        });

        // Fire-and-forget email notification to the seller for new customer inquiries.
        // We only email sellers (not customer replies) to avoid noise, and skip if the
        // sender is the seller themselves. Errors never block the API response.
        try {
          const sellerRecipientEmail = String(updatedConversation.sellerId || normalizedSellerId)
            .toLowerCase()
            .trim();
          const isSellerRecipient =
            actingAsCustomer && sellerRecipientEmail && recipientEmail.toLowerCase().trim() === sellerRecipientEmail;
          if (isSellerRecipient && sellerRecipientEmail) {
            const vehicleTitle = String(conversation.vehicleName || 'your listing');
            const preview = messageText.length > 140 ? messageText.substring(0, 140) + '…' : messageText;
            void core.sendInquiryNotificationToSeller(
              sellerRecipientEmail,
              senderName || 'A buyer',
              vehicleTitle,
              preview || '(new message)',
            ).catch((mailErr) => {
              console.warn('⚠️ API: inquiry email failed (non-fatal):', mailErr);
            });

            const msgType = typeof message.type === 'string' ? message.type : 'text';
            const payload = message.payload && typeof message.payload === 'object' ? message.payload as Record<string, unknown> : {};
            core.notifySellerInquiryChannels({
              sellerEmail: recipientEmail,
              buyerName: senderName || 'A buyer',
              vehicleTitle,
              messagePreview: preview || '(new message)',
              conversationId: String(conversationId),
              isTestDrive: msgType === 'test_drive_request',
              testDriveDate: typeof payload.date === 'string' ? payload.date : undefined,
              testDriveTime: typeof payload.time === 'string' ? payload.time : undefined,
            });
          }
        } catch (mailErr) {
          console.warn('⚠️ API: seller inquiry alerts failed (non-fatal):', mailErr);
        }

        console.log('✅ API: Message added successfully:', { conversationId, messageId: message?.id, messageCount: updatedConversation.messages?.length });
        return res.status(200).json({ success: true, data: updatedConversation });
      } catch (error) {
        console.error('❌ API: Error adding message:', {
          conversationId,
          messageId: message?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        return res.status(500).json({ 
          success: false, 
          reason: error instanceof Error ? error.message : 'Failed to add message to conversation' 
        });
      }
    }

    // PATCH — mark messages read and/or clear message history (participants only)
    if (req.method === 'PATCH') {
      let body = req.body as
        | {
            conversationId?: string;
            markReadMessageIds?: (number | string)[];
            clearMessages?: boolean;
            archive?: boolean;
            threadReadBy?: 'customer' | 'seller';
            threadReadState?: boolean;
          }
        | string
        | undefined;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body) as typeof body;
        } catch {
          return res.status(400).json({ success: false, reason: 'Invalid JSON body.' });
        }
      }
      const conversationId = body && typeof body === 'object' ? body.conversationId : undefined;
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      const markIds =
        body && typeof body === 'object' && Array.isArray(body.markReadMessageIds)
          ? body.markReadMessageIds
          : [];
      const doClear = Boolean(body && typeof body === 'object' && body.clearMessages);
      const hasArchiveFlag = body && typeof body === 'object' && typeof body.archive === 'boolean';
      const archiveState = hasArchiveFlag ? Boolean((body as { archive?: boolean }).archive) : undefined;
      const threadReadBy =
        body &&
        typeof body === 'object' &&
        (body.threadReadBy === 'customer' || body.threadReadBy === 'seller')
          ? body.threadReadBy
          : undefined;
      const hasThreadReadState = body && typeof body === 'object' && typeof body.threadReadState === 'boolean';
      const threadReadState = hasThreadReadState ? Boolean((body as { threadReadState?: boolean }).threadReadState) : undefined;

      try {
        if (doClear) {
          const clearedAsCustomer = isAuthParticipant(normalizedCustomerId);
          const clearedAsSeller = isAuthParticipant(normalizedSellerId);
          if (!clearedAsCustomer && !clearedAsSeller && !isAdmin) {
            return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
          }
          const role: 'customer' | 'seller' = clearedAsCustomer ? 'customer' : 'seller';
          await core.conversationService.clearHistoryForParticipant(String(conversation.id), role);
        } else if (hasArchiveFlag) {
          const archivedAsCustomer = isAuthParticipant(normalizedCustomerId);
          const archivedAsSeller = isAuthParticipant(normalizedSellerId);
          if (!archivedAsCustomer && !archivedAsSeller && !isAdmin) {
            return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
          }
          const role: 'customer' | 'seller' = archivedAsCustomer ? 'customer' : 'seller';
          await core.conversationService.setArchivedForParticipant(
            String(conversation.id),
            role,
            archiveState!,
          );
        } else if (threadReadBy && hasThreadReadState) {
          if (!isAdmin) {
            const canUpdateCustomerReadState = isAuthParticipant(normalizedCustomerId);
            const canUpdateSellerReadState = isAuthParticipant(normalizedSellerId);
            const isAuthorizedForRequestedReadState =
              (threadReadBy === 'customer' && canUpdateCustomerReadState) ||
              (threadReadBy === 'seller' && canUpdateSellerReadState);
            if (!isAuthorizedForRequestedReadState) {
              return res.status(403).json({ success: false, reason: 'Unauthorized read-state update' });
            }
          }
          await core.conversationService.update(String(conversation.id), {
            isReadBySeller: threadReadBy === 'seller' ? threadReadState : conversation.isReadBySeller,
            isReadByCustomer: threadReadBy === 'customer' ? threadReadState : conversation.isReadByCustomer,
          });
        } else if (markIds.length > 0) {
          await core.conversationService.markMessagesRead(String(conversation.id), markIds);
        } else {
          return res.status(400).json({
            success: false,
            reason: 'Provide clearMessages, archive, markReadMessageIds, or threadReadBy/threadReadState.',
          });
        }
        const updatedConversation = await core.conversationService.findById(String(conversation.id));
        if (!updatedConversation) {
          return res.status(500).json({ success: false, reason: 'Failed to load conversation after update' });
        }
        return res.status(200).json({ success: true, data: updatedConversation });
      } catch (error) {
        console.error('❌ API: PATCH conversation error:', error);
        return res.status(500).json({
          success: false,
          reason: error instanceof Error ? error.message : 'Failed to update conversation',
        });
      }
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      const { conversationId } = req.query;
      
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation deletion' });
      }

      const { getDealForConversation } = await import('../handlers/conversation-lifecycle.js');
      const linkedDeal = await getDealForConversation(String(conversation.id));
      if (linkedDeal) {
        return res.status(403).json({
          success: false,
          reason: 'deal_exists',
          message:
            'This conversation is part of a deal record and cannot be deleted. Archive it to hide it from your inbox instead.',
          action: 'archive',
          dealStatus: linkedDeal.status,
        });
      }

      await core.conversationService.delete(conversation.id);
      return res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    core.logError('Conversations Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process conversation request',
      error: errorMessage
    });
  }
}

// Notifications Handler
async function handleNotifications(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: core.AuthResult | null = null;
    let normalizedAuthEmail = '';
    let normalizedAuthUserId = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      // Try to authenticate with either legacy app JWT or a Supabase access token,
      // but don't fail if no token (preserves existing "return empty for unauthed" UX).
      auth = await core.authenticateRequestDual(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
        normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
      // If auth fails, continue with empty auth (will return empty array for non-admin)
    } else {
      // POST/PUT/DELETE require authentication via either legacy JWT or Supabase token.
      // This keeps notification updates (e.g. mark-as-read) working for OAuth sessions.
      auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user) {
        return res.status(401).json({
          success: false,
          reason: auth.error || 'Authentication required.',
          error: 'Invalid or expired authentication token',
        });
      }
      normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
      normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
      isAdmin = auth.user.role === 'admin';
    }

    // GET - Retrieve notifications
    if (req.method === 'GET') {
      const { recipientEmail, isRead, notificationId } = req.query;
      
      if (notificationId) {
        // Get single notification from Supabase
        // If not authenticated, return 404 (don't reveal notification exists)
        if (!auth || !auth.isValid) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const supabase = core.getSupabaseAdminClient();
        const { data: notification, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', String(notificationId))
          .single();
        
        if (error || !notification) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const recipient = (notification.recipient_email || notification.user_id || '').toString().toLowerCase().trim();
        if (
          !isAdmin &&
          recipient &&
          !core.participantIdMatchesAppUser(recipient, normalizedAuthEmail, normalizedAuthUserId)
        ) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to notification' });
        }
        return res.status(200).json({ success: true, data: notification });
      }
      
      // Get all notifications from Supabase and filter
      const supabase = core.getSupabaseAdminClient();
      const { data: allNotifications, error: fetchError } = await supabase
        .from('notifications')
        .select('*');
      
      if (fetchError) {
        core.logError('❌ Failed to fetch notifications:', fetchError);
        return res.status(500).json({ success: false, reason: 'Failed to fetch notifications' });
      }
      
      let notifications = (allNotifications || []).map((notif: any) => ({
        ...notif,
        id: notif.id,
        recipientEmail: notif.recipient_email || notif.user_id,
        isRead: notif.read || notif.is_read
      }));
      
      if (recipientEmail) {
        const emailValue = Array.isArray(recipientEmail) ? recipientEmail[0] : recipientEmail;
        const normalizedEmail = emailValue.toLowerCase().trim();
        // If not authenticated or not admin, only return notifications for the authenticated user
        if (!auth || !auth.isValid) {
          // No auth token - return empty array instead of 401
          return res.status(200).json({ success: true, data: [] });
        }
        if (
          !isAdmin &&
          !core.participantIdMatchesAppUser(normalizedEmail, normalizedAuthEmail, normalizedAuthUserId)
        ) {
          return res.status(200).json({ success: true, data: [] });
        }
        notifications = notifications.filter((n) => {
          const recipient = n.recipientEmail || n.recipient_email || n.user_id || '';
          return core.participantIdMatchesAppUser(
            recipient.toString(),
            normalizedEmail,
            undefined,
          );
        });
      } else {
        // No recipientEmail specified - only admins can see all notifications
        if (!auth || !auth.isValid || !isAdmin) {
          // Return empty array instead of 401/403 for unauthenticated or non-admin requests
          return res.status(200).json({ success: true, data: [] });
        }
      }
      
      if (isRead !== undefined) {
        const isReadValue = Array.isArray(isRead) ? isRead[0] : isRead;
        const isReadBool = isReadValue === 'true';
        notifications = notifications.filter(n => (n.isRead || n.read) === isReadBool);
      }
      
      // Sort by timestamp descending
      notifications = notifications.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      
      return res.status(200).json({ success: true, data: notifications });
    }

    // POST - Create notification
    if (req.method === 'POST') {
      const notificationData = req.body;
      
      if (!notificationData.id || !notificationData.recipientEmail) {
        return res.status(400).json({ success: false, reason: 'Notification ID and recipient email are required' });
      }

      // Normalize email
      const normalizedEmail = notificationData.recipientEmail.toLowerCase().trim();
      if (!isAdmin && normalizedEmail !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification creation' });
      }
      
      // Create notification in Supabase
      const supabase = core.getSupabaseAdminClient();
      const notificationRecord = {
        id: String(notificationData.id),
        user_id: normalizedEmail,
        recipient_email: normalizedEmail,
        type: notificationData.targetType || 'general',
        title: notificationData.title || notificationData.message?.substring(0, 50) || 'Notification',
        message: notificationData.message || '',
        read: notificationData.isRead || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: notificationData
      };
      
      const { data: created, error: createError } = await supabase
        .from('notifications')
        .insert(notificationRecord)
        .select()
        .single();
      
      if (createError) {
        core.logError('❌ Failed to create notification:', createError);
        return res.status(500).json({ success: false, reason: 'Failed to create notification' });
      }
      
      return res.status(201).json({ success: true, data: created });
    }

    // PUT - Update notification (mark as read, etc.)
    if (req.method === 'PUT') {
      const { notificationId, updates } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }

      // Get existing notification from Supabase
      const supabase = core.getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (!isAdmin && recipient && recipient !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification update' });
      }

      // Update notification in Supabase
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Map updates to Supabase column names
      if (updates.isRead !== undefined) updateData.read = updates.isRead;
      if (updates.message !== undefined) updateData.message = updates.message;
      if (updates.title !== undefined) updateData.title = updates.title;
      
      const { data: updated, error: updateError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', String(notificationId))
        .select()
        .single();
      
      if (updateError) {
        core.logError('❌ Failed to update notification:', updateError);
        return res.status(500).json({ success: false, reason: 'Failed to update notification' });
      }
      
      return res.status(200).json({ success: true, data: updated });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notificationId } = req.query;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }
      // Get existing notification from Supabase
      const supabase = core.getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (!isAdmin && recipient && recipient !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification deletion' });
      }

      // Delete notification from Supabase
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', String(notificationId));
      
      if (deleteError) {
        core.logError('❌ Failed to delete notification:', deleteError);
        return res.status(500).json({ success: false, reason: 'Failed to delete notification' });
      }
      
      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    core.logError('Notifications Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process notification request',
      error: errorMessage
    });
  }
}

// Buyer Activity Handler
async function handleContentReports(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }
  const auth = await core.authenticateRequestDual(req);
  if (!auth.isValid || !auth.user?.email) {
    return res.status(401).json({ success: false, reason: 'Authentication required.' });
  }
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const reportedBy = auth.user.email.toLowerCase().trim();
    const targetType =
      typeof body.targetType === 'string' ? body.targetType.slice(0, 64) : '';
    const targetId =
      body.targetId != null ? String(body.targetId).slice(0, 255) : '';
    const reason =
      typeof body.reason === 'string' ? body.reason.slice(0, 2000) : '';
    if (!targetType || !targetId) {
      return res.status(400).json({
        success: false,
        reason: 'targetType and targetId are required',
      });
    }

    core.logSecurity('content-report', {
      reportedBy,
      targetType,
      targetId,
      reason: reason || undefined,
    });

    if (core.USE_SUPABASE) {
      try {
        const supabase = core.getSupabaseAdminClient();
        await supabase.from('audit_log').insert({
          id: Date.now(),
          timestamp:
            typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
          actor: reportedBy,
          action: 'content-report',
          target: `${targetType}:${targetId}`,
          details: reason || null,
        });
      } catch (dbErr) {
        core.logWarn('content-report audit_log insert failed (non-fatal):', dbErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.logError('handleContentReports error:', message);
    return res.status(500).json({ success: false, reason: message });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Firebase is not configured. Please set Firebase environment variables.'
      });
    }
    const plansPath = 'plans';
    const basePlanOrder = ['free', 'pro', 'premium'];
    const toNumber = (value: unknown, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const toListingLimit = (value: unknown, fallback: number | 'unlimited'): number | 'unlimited' => {
      if (value === 'unlimited' || String(value).toLowerCase() === 'unlimited') {
        return 'unlimited';
      }
      const n = Number(value);
      // Stored 0 or invalid should not override catalog defaults (fixes "1 / 0" on dashboard).
      if (Number.isFinite(n) && n > 0) return n;
      return fallback;
    };

    const toPlanDetails = (id: string, row: Record<string, unknown>) => {
      const basePlan = core.PLAN_DETAILS[id as keyof typeof core.PLAN_DETAILS];
      const metadata = (row.metadata as Record<string, unknown> | undefined) || {};
      const isBasePlan = Boolean(basePlan);
      return {
        id,
        name: String(row.name || basePlan?.name || 'Custom Plan'),
        price: toNumber(row.price, basePlan?.price ?? 0),
        // Keep base plan marketing/features canonical from code constants.
        // This prevents stale DB-edited feature text from drifting across pages.
        features: isBasePlan
          ? (basePlan?.features || [])
          : (Array.isArray(row.features) ? row.features.map(String) : []),
        listingLimit: toListingLimit(row.listingLimit ?? metadata.listingLimit, basePlan?.listingLimit ?? 0),
        featuredCredits: toNumber(row.featuredCredits ?? metadata.featuredCredits, basePlan?.featuredCredits ?? 0),
        freeCertifications: toNumber(row.freeCertifications ?? metadata.freeCertifications, basePlan?.freeCertifications ?? 0),
        isMostPopular: Boolean(row.isMostPopular ?? metadata.isMostPopular ?? basePlan?.isMostPopular ?? false),
      };
    };

    switch (req.method) {
      case 'GET': {
        const allRows = await core.adminReadAll<Record<string, unknown>>(plansPath);
        const fromDb = Object.entries(allRows).map(([id, row]) => toPlanDetails(id, row));
        const presentIds = new Set(fromDb.map((plan) => String(plan.id)));

        // Ensure base plans always exist in response
        const basePlans = Object.entries(core.PLAN_DETAILS)
          .filter(([id]) => !presentIds.has(id))
          .map(([id, plan]) => ({
            id,
            name: plan.name,
            price: plan.price,
            features: plan.features,
            listingLimit: plan.listingLimit,
            featuredCredits: plan.featuredCredits,
            freeCertifications: plan.freeCertifications,
            isMostPopular: Boolean(plan.isMostPopular),
          }));

        const plans = [...fromDb, ...basePlans].sort((a, b) => {
          const aIndex = basePlanOrder.indexOf(String(a.id));
          const bIndex = basePlanOrder.indexOf(String(b.id));
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return String(a.name).localeCompare(String(b.name));
        });

        return res.status(200).json(plans);
      }

      case 'POST': {
        if (!(await core.requireAdmin(req, res, 'Create plan'))) {
          return;
        }
        const newPlanData = req.body || {};
        if (!newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }

        const planId = String(newPlanData.id || `custom_${Date.now()}`);
        const record = {
          id: planId,
          name: String(newPlanData.name),
          price: toNumber(newPlanData.price, 0),
          features: Array.isArray(newPlanData.features) ? newPlanData.features : [],
          listingLimit: toNumber(newPlanData.listingLimit, 0),
          featuredCredits: toNumber(newPlanData.featuredCredits, 0),
          freeCertifications: toNumber(newPlanData.freeCertifications, 0),
          isMostPopular: Boolean(newPlanData.isMostPopular),
          isCustom: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await core.adminCreate(plansPath, record, planId);
        core.invalidateSellerPlanCache();
        return res.status(201).json(toPlanDetails(planId, record));
      }

      case 'PUT': {
        if (!(await core.requireAdmin(req, res, 'Update plan'))) {
          return;
        }
        const { planId: updatePlanId, ...updateData } = req.body || {};
        if (!updatePlanId || typeof updatePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }

        const existing = await core.adminRead<Record<string, unknown>>(plansPath, updatePlanId);
        const basePlan = core.PLAN_DETAILS[updatePlanId as keyof typeof core.PLAN_DETAILS];
        const merged = {
          ...(existing || {}),
          id: updatePlanId,
          name: String(updateData.name ?? existing?.name ?? basePlan?.name ?? 'Plan'),
          price: toNumber(updateData.price ?? existing?.price, basePlan?.price ?? 0),
          features: basePlan
            ? (basePlan.features || [])
            : (Array.isArray(updateData.features)
              ? updateData.features
              : (Array.isArray(existing?.features) ? existing?.features : [])),
          listingLimit: toListingLimit(updateData.listingLimit ?? existing?.listingLimit, basePlan?.listingLimit ?? 0),
          featuredCredits: toNumber(updateData.featuredCredits ?? existing?.featuredCredits, basePlan?.featuredCredits ?? 0),
          freeCertifications: toNumber(updateData.freeCertifications ?? existing?.freeCertifications, basePlan?.freeCertifications ?? 0),
          isMostPopular: Boolean(updateData.isMostPopular ?? existing?.isMostPopular ?? basePlan?.isMostPopular ?? false),
          isCustom: !basePlan,
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          await core.adminUpdate(plansPath, updatePlanId, merged);
        } else {
          await core.adminCreate(plansPath, { ...merged, createdAt: new Date().toISOString() }, updatePlanId);
        }

        core.invalidateSellerPlanCache();
        return res.status(200).json(toPlanDetails(updatePlanId, merged));
      }

      case 'DELETE': {
        if (!(await core.requireAdmin(req, res, 'Delete plan'))) {
          return;
        }
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        if (['free', 'pro', 'premium'].includes(deletePlanId)) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }

        await core.adminDelete(plansPath, deletePlanId);
        core.invalidateSellerPlanCache();
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Plans Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Export with error wrapper to catch any initialization or module loading errors

export {
  handleAI,
  handleContent,
  handlePlatformSettings,
  handleAuditLog,
  handleBusiness,
  handleConversations,
  handleNotifications,
  handleContentReports,
};
