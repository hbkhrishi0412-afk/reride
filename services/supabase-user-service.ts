import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';
import type { User } from '../types.js';

// Convert email to a safe key (replace special chars)
function emailToKey(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
}

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

// Helper to convert Supabase row to User type
function supabaseRowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    mobile: row.mobile || '',
    password: row.password || undefined, // Include password field
    role: (row.role || 'customer') as 'customer' | 'seller' | 'admin',
    status: (row.status || 'active') as 'active' | 'inactive',
    avatarUrl: row.avatar_url || undefined,
    isVerified: row.is_verified || false,
    dealershipName: row.dealership_name || undefined,
    bio: row.bio || undefined,
    logoUrl: row.logo_url || undefined,
    subscriptionPlan: (row.subscription_plan || 'free') as 'free' | 'pro' | 'premium',
    featuredCredits: row.featured_credits || 0,
    usedCertifications: row.used_certifications || 0,
    phoneVerified: row.phone_verified || false,
    emailVerified: row.email_verified || false,
    govtIdVerified: row.govt_id_verified || false,
    trustScore: row.trust_score || undefined,
    location: row.location || '',
    address: row.address || undefined,
    firebaseUid: row.firebase_uid || undefined,
    authProvider: (row.auth_provider || 'email') as 'email' | 'google' | 'phone',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    // Extract additional fields from metadata
    ...(row.metadata || {}),
  };
}

// Helper to convert User type to Supabase row
function userToSupabaseRow(user: Partial<User>): any {
  const metadata: any = {};
  
  // Extract fields that should go in metadata
  const metadataFields = [
    'averageRating', 'ratingCount', 'badges', 'responseTime', 'responseRate',
    'joinedDate', 'lastActiveAt', 'activeListings', 'soldListings', 'totalViews',
    'reportedCount', 'isBanned', 'alternatePhone', 'preferredContactHours',
    'showEmailPublicly', 'partnerBanks', 'verificationStatus', 'aadharCard',
    'panCard', 'planActivatedDate', 'planExpiryDate', 'pendingPlanUpgrade'
  ];
  
  metadataFields.forEach(field => {
    if (user[field as keyof User] !== undefined) {
      metadata[field] = user[field as keyof User];
    }
  });
  
  return {
    id: user.id,
    email: user.email?.toLowerCase().trim() || '',
    name: user.name || '',
    mobile: user.mobile || null,
    password: user.password || null, // Include password field
    role: user.role || 'customer',
    status: user.status || 'active',
    avatar_url: user.avatarUrl || null,
    is_verified: user.isVerified || false,
    dealership_name: user.dealershipName || null,
    bio: user.bio || null,
    logo_url: user.logoUrl || null,
    subscription_plan: user.subscriptionPlan || 'free',
    featured_credits: user.featuredCredits || 0,
    used_certifications: user.usedCertifications || 0,
    phone_verified: user.phoneVerified || false,
    email_verified: user.emailVerified || false,
    govt_id_verified: user.govtIdVerified || false,
    trust_score: user.trustScore || null,
    location: user.location || null,
    address: user.address || null,
    firebase_uid: user.firebaseUid || null,
    auth_provider: user.authProvider || 'email',
    created_at: user.createdAt || new Date().toISOString(),
    updated_at: (user as any).updatedAt || new Date().toISOString(),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

// User service for Supabase
export const supabaseUserService = {
  // Create a new user
  async create(userData: Omit<User, 'id'>): Promise<User> {
    const normalizedEmail = userData.email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    const userToSave = {
      ...userData,
      email: normalizedEmail,
    };
    
    let supabase;
    try {
      supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    } catch (clientError: any) {
      // CRITICAL: Catch service role key errors and provide helpful message
      if (clientError.message && clientError.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production!');
        console.error('   This is required for user registration. Set it in Vercel environment variables.');
        throw new Error(
          'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
          'Please set SUPABASE_SERVICE_ROLE_KEY in your production environment variables (Vercel). ' +
          'This key is required for server-side database operations.'
        );
      }
      throw clientError;
    }
    
    const row = userToSupabaseRow({ ...userToSave, id: emailKey });
    
    const { data, error } = await supabase
      .from('users')
      .insert(row)
      .select()
      .single();
    
    if (error) {
      // Enhanced error messages for common issues
      let errorMessage = error.message;
      
      // Check for RLS policy errors
      if (error.code === '42501' || error.message.includes('permission denied') || error.message.includes('new row violates row-level security')) {
        errorMessage = `RLS Policy Error: ${error.message}. ` +
          'The users table may have Row Level Security enabled without an INSERT policy. ' +
          'Either add an INSERT policy or ensure SUPABASE_SERVICE_ROLE_KEY is set to bypass RLS.';
      }
      
      // Check for duplicate key errors
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        errorMessage = `User with email ${normalizedEmail} already exists.`;
      }
      
      // Check for foreign key or constraint errors
      if (error.code === '23503' || error.message.includes('violates foreign key constraint')) {
        errorMessage = `Database constraint error: ${error.message}. Please check your database schema.`;
      }
      
      console.error('❌ Supabase INSERT error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        email: normalizedEmail,
        isServerSide,
        hasServiceRole: isServerSide && !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      
      throw new Error(`Failed to create user: ${errorMessage}`);
    }
    
    return supabaseRowToUser(data);
  },

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // Try to find by ID first (email key)
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', emailKey)
      .single();
    
    // If not found by ID, try by email field
    if (error || !data) {
      const result = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single();
      
      data = result.data;
      error = result.error;
    }
    
    if (error || !data) {
      return null;
    }
    
    return supabaseRowToUser(data);
  },

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return supabaseRowToUser(data);
  },

  // Batch fetch users by emails (much faster than individual queries)
  async findByEmails(emails: string[]): Promise<User[]> {
    if (emails.length === 0) {
      return [];
    }
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // Normalize emails and create email keys
    const normalizedEmails = emails.map(e => e.toLowerCase().trim());
    const emailKeys = normalizedEmails.map(e => emailToKey(e));
    
    // Fetch by both ID (email key) and email field to handle both cases
    // Use .in() for array matching in Supabase
    const { data: dataById, error: errorById } = await supabase
      .from('users')
      .select('*')
      .in('id', emailKeys);
    
    const { data: dataByEmail, error: errorByEmail } = await supabase
      .from('users')
      .select('*')
      .in('email', normalizedEmails);
    
    // Combine results and deduplicate
    const allData = [...(dataById || []), ...(dataByEmail || [])];
    const uniqueData = Array.from(
      new Map(allData.map(item => [item.id || item.email, item])).values()
    );
    
    if (errorById && errorByEmail) {
      // If both queries fail, fall back to individual fetches
      console.warn(`⚠️ Batch user fetch failed, falling back to individual queries`);
      const results = await Promise.allSettled(
        emails.map(email => this.findByEmail(email))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    }
    
    return uniqueData.map(supabaseRowToUser);
  },

  // Get all users
  async findAll(): Promise<User[]> {
    try {
      let supabase;
      
      // CRITICAL: Catch service role key errors early and provide helpful diagnostics
      try {
        supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
        
        if (isServerSide) {
          console.log('📊 findAll: Using Supabase Admin Client (server-side)');
          // Verify service role key is configured
          if (!process.env.SUPABASE_SERVICE_ROLE_KEY || 
              process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === '' ||
              process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_supabase_service_role_key')) {
            console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing or invalid!');
            console.error('   This will cause RLS policies to block access, resulting in 0 users.');
            console.error('   Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.');
            throw new Error(
              'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
              'Set it in your production environment variables (Vercel). ' +
              'Without it, RLS policies may block access to users, resulting in 0 users being returned.'
            );
          } else {
            console.log('✅ findAll: SUPABASE_SERVICE_ROLE_KEY is configured');
          }
        } else {
          console.log('📊 findAll: Using Supabase Client (client-side)');
        }
      } catch (clientError: any) {
        // CRITICAL: Catch service role key errors and provide helpful message
        if (clientError.message && clientError.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          console.error('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production!');
          console.error('   This is required for fetching users. Set it in Vercel environment variables.');
          throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
            'Please set SUPABASE_SERVICE_ROLE_KEY in your production environment variables (Vercel). ' +
            'This key is required for server-side database operations. ' +
            'Without it, the admin panel will show 0 users even if users exist in the database.'
          );
        }
        throw clientError;
      }
      
      // CRITICAL FIX: Handle pagination to fetch ALL users (Supabase has 1000 row limit per query)
      // This ensures we get all users even if there are more than 1000
      const allUsers: User[] = [];
      const pageSize = 1000; // Supabase default limit
      let offset = 0;
      let hasMore = true;
      
      console.log('📊 findAll: Starting to fetch all users with pagination...');
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .range(offset, offset + pageSize - 1)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('❌ Supabase findAll error:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            offset
          });
          
          // Provide specific guidance for RLS errors
          if (error.code === '42501' || error.message.includes('permission denied') || error.message.includes('row-level security')) {
            console.error('⚠️ RLS Policy Error: This indicates Row Level Security is blocking access.');
            console.error('   Even with service role key, if RLS is misconfigured, access can be blocked.');
            console.error('   Check if RLS is enabled and if there are SELECT policies on the users table.');
            console.error('   Service role key should bypass RLS, but verify it is set correctly.');
          }
          
          throw new Error(`Failed to fetch users from Supabase: ${error.message} (Code: ${error.code || 'unknown'})`);
        }
        
        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }
        
        const users = data.map(supabaseRowToUser);
        allUsers.push(...users);
        
        console.log(`📊 findAll: Fetched ${users.length} users (total so far: ${allUsers.length})`);
        
        // If we got fewer than pageSize, we've reached the end
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
      
      console.log(`✅ Supabase findAll: Retrieved ${allUsers.length} total users from database`);
      
      if (allUsers.length === 0 && isServerSide) {
        console.warn('⚠️ WARNING: Admin client returned 0 users. This might indicate:');
        console.warn('   1. No users exist in the database (check Supabase dashboard)');
        console.warn('   2. RLS policies are blocking access (unlikely with service role key)');
        console.warn('   3. Table name mismatch (expected: "users")');
        console.warn('   4. Service role key is not being used correctly');
      }
      
      return allUsers;
    } catch (error) {
      console.error('❌ findAll: Exception caught:', error);
      throw error;
    }
  },

  // Update user
  async update(email: string, updates: Partial<User>): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // First, get existing user to merge metadata properly
    // Try to find by ID first, then by email if not found
    let existingUser: any = null;
    let userIdentifier: { field: 'id' | 'email'; value: string } = { field: 'id', value: emailKey };
    
    let { data, error: fetchError } = await supabase
      .from('users')
      .select('id, metadata')
      .eq('id', emailKey)
      .single();
    
    if (fetchError && fetchError.code === 'PGRST116') {
      // User not found by ID, try by email
      const result = await supabase
        .from('users')
        .select('id, metadata')
        .eq('email', normalizedEmail)
        .single();
      
      if (result.data) {
        existingUser = result.data;
        userIdentifier = { field: 'id', value: result.data.id };
      } else if (result.error && result.error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch existing user: ${result.error.message}`);
      }
    } else if (fetchError) {
      throw new Error(`Failed to fetch existing user: ${fetchError.message}`);
    } else if (data) {
      existingUser = data;
    }
    
    // If user doesn't exist, throw an error
    if (!existingUser) {
      throw new Error(`User not found: ${normalizedEmail}`);
    }
    
    // CRITICAL FIX: Only convert fields that are actually in the updates object
    // This prevents undefined fields from being converted to empty strings and clearing existing data
    const row: any = {};
    
    // Map of User fields to Supabase column names
    const fieldMapping: Record<string, string> = {
      email: 'email',
      name: 'name',
      mobile: 'mobile',
      password: 'password',
      role: 'role',
      status: 'status',
      avatarUrl: 'avatar_url',
      isVerified: 'is_verified',
      dealershipName: 'dealership_name',
      bio: 'bio',
      logoUrl: 'logo_url',
      subscriptionPlan: 'subscription_plan',
      featuredCredits: 'featured_credits',
      usedCertifications: 'used_certifications',
      phoneVerified: 'phone_verified',
      emailVerified: 'email_verified',
      govtIdVerified: 'govt_id_verified',
      trustScore: 'trust_score',
      location: 'location',
      address: 'address',
      firebaseUid: 'firebase_uid',
      authProvider: 'auth_provider',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    
    // Only include fields that are actually in the updates
    Object.keys(updates).forEach(key => {
      if (key === 'id') return; // Skip id field
      
      const value = updates[key as keyof User];
      if (value === undefined) return; // Skip undefined values
      
      const columnName = fieldMapping[key];
      if (columnName) {
        // Handle special cases
        if (key === 'email' && typeof value === 'string') {
          row[columnName] = value.toLowerCase().trim();
        } else if (key === 'password') {
          row[columnName] = value;
        } else {
          row[columnName] = value;
        }
      }
    });
    
    // Handle metadata fields separately
    const metadataFields = [
      'averageRating', 'ratingCount', 'badges', 'responseTime', 'responseRate',
      'joinedDate', 'lastActiveAt', 'activeListings', 'soldListings', 'totalViews',
      'reportedCount', 'isBanned', 'alternatePhone', 'preferredContactHours',
      'showEmailPublicly', 'partnerBanks', 'verificationStatus', 'aadharCard',
      'panCard', 'planActivatedDate', 'planExpiryDate', 'pendingPlanUpgrade'
    ];
    
    const metadata: any = {};
    let hasMetadataUpdates = false;
    
    metadataFields.forEach(field => {
      if (field in updates && updates[field as keyof User] !== undefined) {
        metadata[field] = updates[field as keyof User];
        hasMetadataUpdates = true;
      }
    });
    
    // CRITICAL: Merge metadata instead of replacing it
    // This preserves existing metadata fields when updating partnerBanks or other metadata fields
    if (hasMetadataUpdates) {
      if (existingUser?.metadata) {
        // Merge new metadata with existing metadata
        row.metadata = {
          ...(existingUser.metadata || {}),
          ...metadata
        };
      } else {
        // New metadata, no existing metadata - use as is
        row.metadata = metadata;
      }
    }
    
    // Only include metadata if it has values
    if (row.metadata && Object.keys(row.metadata).length === 0) {
      delete row.metadata;
    }
    
    // Always update updated_at timestamp
    row.updated_at = new Date().toISOString();
    
    // If no fields to update (after filtering), throw an error
    if (Object.keys(row).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    // Update by the correct identifier (ID or email)
    const { error, data: updateData } = await supabase
      .from('users')
      .update(row)
      .eq(userIdentifier.field, userIdentifier.value)
      .select();
    
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    
    // Verify that the update actually affected a row
    if (!updateData || updateData.length === 0) {
      throw new Error(`User update failed: No rows were updated. User may not exist or identifier mismatch.`);
    }
  },

  // Update user by ID
  async updateById(id: string, updates: Partial<User>): Promise<void> {
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // First, get existing user to merge metadata properly
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('metadata')
      .eq('id', id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch existing user: ${fetchError.message}`);
    }
    
    // CRITICAL FIX: Only convert fields that are actually in the updates object
    // This prevents undefined fields from being converted to empty strings and clearing existing data
    const row: any = {};
    
    // Map of User fields to Supabase column names
    const fieldMapping: Record<string, string> = {
      email: 'email',
      name: 'name',
      mobile: 'mobile',
      password: 'password',
      role: 'role',
      status: 'status',
      avatarUrl: 'avatar_url',
      isVerified: 'is_verified',
      dealershipName: 'dealership_name',
      bio: 'bio',
      logoUrl: 'logo_url',
      subscriptionPlan: 'subscription_plan',
      featuredCredits: 'featured_credits',
      usedCertifications: 'used_certifications',
      phoneVerified: 'phone_verified',
      emailVerified: 'email_verified',
      govtIdVerified: 'govt_id_verified',
      trustScore: 'trust_score',
      location: 'location',
      address: 'address',
      firebaseUid: 'firebase_uid',
      authProvider: 'auth_provider',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    
    // Only include fields that are actually in the updates
    Object.keys(updates).forEach(key => {
      if (key === 'id') return; // Skip id field
      
      const value = updates[key as keyof User];
      if (value === undefined) return; // Skip undefined values
      
      const columnName = fieldMapping[key];
      if (columnName) {
        // Handle special cases
        if (key === 'email' && typeof value === 'string') {
          row[columnName] = value.toLowerCase().trim();
        } else if (key === 'password') {
          row[columnName] = value;
        } else {
          row[columnName] = value;
        }
      }
    });
    
    // Handle metadata fields separately
    const metadataFields = [
      'averageRating', 'ratingCount', 'badges', 'responseTime', 'responseRate',
      'joinedDate', 'lastActiveAt', 'activeListings', 'soldListings', 'totalViews',
      'reportedCount', 'isBanned', 'alternatePhone', 'preferredContactHours',
      'showEmailPublicly', 'partnerBanks', 'verificationStatus', 'aadharCard',
      'panCard', 'planActivatedDate', 'planExpiryDate', 'pendingPlanUpgrade'
    ];
    
    const metadata: any = {};
    let hasMetadataUpdates = false;
    
    metadataFields.forEach(field => {
      if (field in updates && updates[field as keyof User] !== undefined) {
        metadata[field] = updates[field as keyof User];
        hasMetadataUpdates = true;
      }
    });
    
    // CRITICAL: Merge metadata instead of replacing it
    if (hasMetadataUpdates) {
      if (existingUser?.metadata) {
        // Merge new metadata with existing metadata
        row.metadata = {
          ...(existingUser.metadata || {}),
          ...metadata
        };
      } else {
        // New metadata, no existing - use as is
        row.metadata = metadata;
      }
    }
    
    // Only include metadata if it has values
    if (row.metadata && Object.keys(row.metadata).length === 0) {
      delete row.metadata;
    }
    
    // Always update updated_at timestamp
    row.updated_at = new Date().toISOString();
    
    // If no fields to update (after filtering), throw an error
    if (Object.keys(row).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const { error } = await supabase
      .from('users')
      .update(row)
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  },

  // Delete user
  async delete(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', emailKey);
    
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  },

  // Find users by role
  async findByRole(role: 'customer' | 'seller' | 'admin'): Promise<User[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', role);
    
    if (error) {
      throw new Error(`Failed to fetch users by role: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToUser);
  },

  // Find users by status
  async findByStatus(status: 'active' | 'inactive'): Promise<User[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('status', status);
    
    if (error) {
      throw new Error(`Failed to fetch users by status: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToUser);
  },
};

