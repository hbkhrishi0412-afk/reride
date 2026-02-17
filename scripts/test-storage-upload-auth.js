/**
 * Test script to verify authentication and storage upload permissions
 * This will help identify if the issue is with authentication or policies
 * Run with: node scripts/test-storage-upload-auth.js
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStorageUploadAuth() {
  console.log('🔍 Testing Storage Upload Authentication & Permissions...\n');
  
  try {
    // 1. Check current authentication status
    console.log('1. Checking authentication status...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError.message);
    }
    
    if (!user) {
      console.warn('⚠️  Not authenticated!');
      console.warn('   You need to be logged in to test uploads.');
      console.warn('   Please log in through your application first, then run this script.');
      console.warn('\n   To test authentication:');
      console.warn('   1. Open your app in a browser');
      console.warn('   2. Log in with your credentials');
      console.warn('   3. Open browser DevTools → Application → Local Storage');
      console.warn('   4. Find the Supabase auth token');
      console.warn('   5. Or use the Supabase Dashboard to check if users are authenticated');
      return;
    }
    
    console.log('✅ Authenticated as:', user.email);
    console.log('   - User ID:', user.id);
    console.log('   - Role:', user.role || 'Not set');
    
    // 2. Check auth.role() function
    console.log('\n2. Testing auth.role() function...');
    const { data: roleTest, error: roleError } = await supabase
      .rpc('get_auth_role');
    
    if (roleError) {
      // This RPC might not exist, that's okay
      console.log('   Note: get_auth_role() RPC not available (this is normal)');
      console.log('   auth.role() should return "authenticated" for logged-in users');
    } else {
      console.log('   auth.role():', roleTest);
    }
    
    // 3. Check bucket exists
    console.log('\n3. Checking if "Images" bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }
    
    const imagesBucket = buckets.find(b => b.name === 'Images' || b.name === 'images');
    if (!imagesBucket) {
      console.error('❌ "Images" bucket not found!');
      console.log('Available buckets:', buckets.map(b => b.name).join(', ') || 'None');
      return;
    }
    
    console.log(`✅ "${imagesBucket.name}" bucket found`);
    console.log('   - Public:', imagesBucket.public ? 'Yes' : 'No');
    
    // 4. Test SELECT permission (list files)
    console.log('\n4. Testing SELECT permission (list files)...');
    const { data: files, error: listFilesError } = await supabase.storage
      .from(imagesBucket.name)
      .list('', { limit: 1 });
    
    if (listFilesError) {
      console.error('❌ SELECT permission failed:', listFilesError.message);
      if (listFilesError.message.includes('row-level security') || 
          listFilesError.message.includes('RLS') ||
          listFilesError.message.includes('policy')) {
        console.error('   → Missing SELECT policy!');
      }
    } else {
      console.log('✅ SELECT permission: OK');
    }
    
    // 5. Test INSERT permission (upload)
    console.log('\n5. Testing INSERT permission (upload)...');
    const testFileName = `test-upload-${Date.now()}.txt`;
    const testContent = new Blob(['test upload'], { type: 'text/plain' });
    
    console.log(`   Attempting to upload: test/${testFileName}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(imagesBucket.name)
      .upload(`test/${testFileName}`, testContent, {
        upsert: false,
        contentType: 'text/plain'
      });
    
    if (uploadError) {
      console.error('❌ INSERT permission failed!');
      console.error('   Error:', uploadError.message);
      console.error('   Error code:', uploadError.statusCode || 'N/A');
      
      if (uploadError.message.includes('row-level security') || 
          uploadError.message.includes('violates row-level security policy') ||
          uploadError.message.includes('RLS')) {
        console.error('\n   🔴 ROOT CAUSE: RLS Policy Issue!');
        console.error('   → The INSERT policy exists but might not be working correctly.');
        console.error('\n   Possible causes:');
        console.error('   1. auth.role() is not returning "authenticated"');
        console.error('   2. Policy condition is too restrictive');
        console.error('   3. There\'s a conflict with another policy');
        console.error('   4. The bucket name in the policy doesn\'t match');
        
        console.error('\n   💡 Solutions to try:');
        console.error('   1. Check the policy in Supabase Dashboard → Storage → Policies');
        console.error('   2. Verify the policy uses: bucket_id = \'Images\'');
        console.error('   3. Verify the policy uses: auth.role() = \'authenticated\'');
        console.error('   4. Try recreating the INSERT policy');
        console.error('   5. Check if there are conflicting policies');
      } else if (uploadError.message.includes('permission') || 
                 uploadError.message.includes('denied')) {
        console.error('   → Permission denied. Check RLS policies.');
      } else {
        console.error('   → Other error. Check the error message above.');
      }
    } else {
      console.log('✅ INSERT permission: OK');
      console.log(`   File uploaded: ${uploadData.path}`);
      
      // Clean up
      console.log('\n6. Cleaning up test file...');
      const { error: deleteError } = await supabase.storage
        .from(imagesBucket.name)
        .remove([uploadData.path]);
      
      if (deleteError) {
        console.warn('   ⚠️  Could not delete test file:', deleteError.message);
        console.warn('   You may need to delete it manually from Supabase Dashboard');
      } else {
        console.log('   ✅ Test file deleted');
      }
    }
    
    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    if (uploadError) {
      console.log('\n❌ Upload test FAILED');
      console.log('\nNext steps:');
      console.log('1. Go to Supabase Dashboard → Storage → Policies');
      console.log('2. Check the "Authenticated users can upload images" policy');
      console.log('3. Verify it has:');
      console.log('   - Operation: INSERT');
      console.log('   - Policy: bucket_id = \'Images\' AND auth.role() = \'authenticated\'');
      console.log('4. If the policy looks correct, try:');
      console.log('   - Dropping and recreating the policy');
      console.log('   - Checking for conflicting policies');
      console.log('   - Verifying your user is properly authenticated');
    } else {
      console.log('\n✅ All tests passed!');
      console.log('   Your storage setup is working correctly.');
      console.log('   If you\'re still seeing errors in your app, check:');
      console.log('   - Browser console for detailed error messages');
      console.log('   - Network tab to see the actual API response');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testStorageUploadAuth().catch(console.error);

