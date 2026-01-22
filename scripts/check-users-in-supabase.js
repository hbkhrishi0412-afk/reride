/**
 * Script to check if users exist in Supabase database
 * Run with: node scripts/check-users-in-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('🔍 Checking users in Supabase database...\n');
  
  try {
    // Check if users table exists
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('❌ Error querying users table:', error.message);
      if (error.code === '42P01') {
        console.error('   The users table does not exist. Please run the migration script.');
      } else if (error.code === 'PGRST116') {
        console.error('   The users table exists but is empty.');
      }
      process.exit(1);
    }
    
    console.log(`✅ Found ${count || data?.length || 0} users in the database\n`);
    
    if (data && data.length > 0) {
      console.log('📋 User list:');
      data.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name || 'N/A'} (${user.email || 'NO EMAIL'})`);
        console.log(`   ID: ${user.id || 'NO ID'}`);
        console.log(`   Role: ${user.role || 'N/A'}`);
        console.log(`   Status: ${user.status || 'N/A'}`);
        console.log(`   Created: ${user.created_at || 'N/A'}`);
        if (!user.id) {
          console.log(`   ⚠️  WARNING: This user will be filtered out by normalizeUser()!`);
        }
        if (!user.email) {
          console.log(`   ⚠️  WARNING: This user will be filtered out by normalizeUser()!`);
        }
      });
    } else {
      console.log('⚠️  No users found in the database.');
      console.log('\n💡 To create a test user, you can:');
      console.log('   1. Register a new user through the app');
      console.log('   2. Use the Admin Panel to create a user');
      console.log('   3. Run a migration script if you have existing users');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

checkUsers();

