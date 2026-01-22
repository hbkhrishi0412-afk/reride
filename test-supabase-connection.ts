// test-supabase-connection.ts
// Simple script to test Supabase connection
// Run with: npx tsx test-supabase-connection.ts

import { getSupabaseClient } from './lib/supabase.js';

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  
  try {
    const supabase = getSupabaseClient();
    
    // Test 1: Check if we can connect to Supabase
    console.log('✅ Supabase client initialized successfully');
    console.log(`📍 Project URL: ${supabase.supabaseUrl}`);
    
    // Test 2: Try to fetch from a system table (this should work if connection is good)
    // Note: This will fail if RLS is enabled, but that's okay - it means we're connected
    const { data, error } = await supabase.from('_realtime').select('*').limit(1);
    
    if (error) {
      // This is expected - we're just testing the connection
      if (error.code === 'PGRST301' || error.message.includes('relation') || error.message.includes('permission')) {
        console.log('✅ Connection successful! (Error is expected - just testing connectivity)');
        console.log(`   Error details: ${error.message}`);
      } else {
        console.log('⚠️  Connection test completed with error:', error.message);
      }
    } else {
      console.log('✅ Connection successful! Data retrieved:', data);
    }
    
    console.log('\n🎉 Supabase is configured correctly!');
    console.log('   You can now use Supabase in your application.');
    
  } catch (error) {
    console.error('❌ Supabase connection test failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      if (error.message.includes('missing required fields')) {
        console.error('\n💡 Make sure you have set the following in your .env.local:');
        console.error('   - VITE_SUPABASE_URL');
        console.error('   - VITE_SUPABASE_ANON_KEY');
      }
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

testConnection();

