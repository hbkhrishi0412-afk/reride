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
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = userToSupabaseRow({ ...userToSave, id: emailKey });
    
    const { data, error } = await supabase
      .from('users')
      .insert(row)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
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

  // Get all users
  async findAll(): Promise<User[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToUser);
  },

  // Update user
  async update(email: string, updates: Partial<User>): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const emailKey = emailToKey(normalizedEmail);
    
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = userToSupabaseRow(updates);
    
    // Remove id from updates if it's not being changed
    if (row.id === emailKey) {
      delete row.id;
    }
    
    const { error } = await supabase
      .from('users')
      .update(row)
      .eq('id', emailKey);
    
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  },

  // Update user by ID
  async updateById(id: string, updates: Partial<User>): Promise<void> {
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = userToSupabaseRow(updates);
    
    // Remove id from updates
    delete row.id;
    
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

