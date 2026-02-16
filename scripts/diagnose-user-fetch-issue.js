/**
 * Diagnostic script to check why users aren't being fetched in production
 * Run with: node scripts/diagnose-user-fetch-issue.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Diagnosing User Fetch Issue in Production\n');
console.log('='.repeat(60));

// Check 1: Supabase URL
console.log('\n1. Checking Supabase URL...');
if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
  console.error('❌ SUPABASE_URL is missing or not configured');
  console.error('   Set SUPABASE_URL or VITE_SUPABASE_URL in .env.local');
} else {
  console.log('✅ SUPABASE_URL:', supabaseUrl);
}

// Check 2: Supabase Anon Key
console.log('\n2. Checking Supabase Anon Key...');
if (!supabaseAnonKey || supabaseAnonKey.includes('your_supabase_anon_key')) {
  console.error('❌ SUPABASE_ANON_KEY is missing or not configured');
  console.error('   Set SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY in .env.local');
} else {
  console.log('✅ SUPABASE_ANON_KEY:', supabaseAnonKey.substring(0, 20) + '...');
}

// Check 3: Service Role Key (CRITICAL for admin operations)
console.log('\n3. Checking SUPABASE_SERVICE_ROLE_KEY (CRITICAL)...');
if (!supabaseServiceRoleKey || 
    supabaseServiceRoleKey.trim() === '' || 
    supabaseServiceRoleKey.includes('your_supabase_service_role_key')) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is MISSING!');
  console.error('   This is REQUIRED for fetching users in production.');
  console.error('\n   To fix:');
  console.error('   1. Go to Supabase Dashboard → Settings → API');
  console.error('   2. Copy the "service_role" key (NOT the anon key)');
  console.error('   3. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.error('   4. Add SUPABASE_SERVICE_ROLE_KEY with the service_role key value');
  console.error('   5. Make sure it\'s set for "Production" environment');
  console.error('   6. Redeploy your application');
} else {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY is configured');
  console.log('   Key length:', supabaseServiceRoleKey.length, 'characters');
}

// Check 4: Test database connection with anon key
console.log('\n4. Testing database connection with anon key...');
if (supabaseUrl && supabaseAnonKey) {
  try {
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error, count } = await supabaseAnon
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error querying users table with anon key:', error.message);
      if (error.message.includes('permission') || error.message.includes('RLS')) {
        console.error('   This is expected - anon key is blocked by RLS policies');
        console.error('   You NEED the service_role key to bypass RLS');
      }
    } else {
      console.log('✅ Anon key can connect to database');
      console.log('   Users count (with RLS):', count || 0);
      if (count === 0) {
        console.warn('   ⚠️  RLS policies are blocking access (expected with anon key)');
      }
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
  }
}

// Check 5: Test database connection with service role key
console.log('\n5. Testing database connection with service_role key...');
if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error, count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error querying users table with service_role key:', error.message);
      console.error('   This should NOT happen - service_role key bypasses RLS');
    } else {
      console.log('✅ Service role key can connect to database');
      console.log('   Users count (bypassing RLS):', count || 0);
      
      if (count === 0) {
        console.warn('   ⚠️  No users found in database');
        console.warn('   Check Supabase Dashboard to verify users exist');
      } else {
        console.log('   ✅ Users exist in database!');
      }
    }
  } catch (error) {
    console.error('❌ Connection error with service_role key:', error.message);
  }
} else {
  console.warn('⚠️  Skipping service_role test (key not configured)');
}

// Check 6: Verify users table structure
console.log('\n6. Checking users table structure...');
if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, mobile')
      .limit(5);
    
    if (error) {
      console.error('❌ Error reading users table:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Users table is accessible');
      console.log('   Sample users:');
      data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.name || 'No name'})`);
      });
    } else {
      console.warn('⚠️  Users table exists but is empty');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 SUMMARY:');
console.log('\nTo fix "Total Users: 0" in production:');
console.log('1. ✅ Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel environment variables');
console.log('2. ✅ Make sure it\'s set for "Production" environment (not just Preview/Development)');
console.log('3. ✅ Redeploy your application after adding the key');
console.log('4. ✅ Check Vercel function logs for /api/users endpoint');
console.log('\nFor more details, see: ADMIN_USER_DATA_FIX.md');

