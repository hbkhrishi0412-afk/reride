/**
 * Diagnostic script to check Supabase Storage RLS policies
 * This script will help identify what policies are missing or misconfigured
 * Run with: node scripts/diagnose-storage-rls.js
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

async function diagnoseStorageRLS() {
  console.log('🔍 Diagnosing Supabase Storage RLS Policies...\n');
  
  try {
    // 1. Check if bucket exists
    console.log('1. Checking if "Images" bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }
    
    const imagesBucket = buckets.find(b => b.name === 'Images' || b.name === 'images');
    if (!imagesBucket) {
      console.error('❌ "Images" bucket not found!');
      console.log('Available buckets:', buckets.map(b => b.name).join(', ') || 'None');
      console.log('\n💡 Solution: Create an "Images" bucket in Supabase Dashboard → Storage');
      console.log('   Make sure the bucket name is exactly "Images" (capital I)');
      return;
    }
    
    console.log(`✅ "${imagesBucket.name}" bucket found`);
    console.log('   - Public:', imagesBucket.public ? 'Yes' : 'No');
    console.log('   - Created:', imagesBucket.created_at);
    
    if (!imagesBucket.public) {
      console.warn('\n⚠️  WARNING: Bucket is not public!');
      console.warn('   Images may not be accessible via public URLs.');
    }
    
    // 2. Check RLS policies using SQL query
    console.log('\n2. Checking RLS policies for storage.objects...');
    
    if (!supabaseAdmin) {
      console.warn('⚠️  Service role key not found. Cannot query RLS policies directly.');
      console.warn('   To check policies, you need to:');
      console.warn('   1. Go to Supabase Dashboard → SQL Editor');
      console.warn('   2. Run the verification queries from fix-storage-rls-policies.sql');
      console.warn('   3. Or check Storage → Policies in the dashboard');
    } else {
      console.log('   Note: To check existing policies, run the SQL query in:');
      console.log('   scripts/check-storage-policies.sql');
      console.log('   (Copy and paste into Supabase Dashboard → SQL Editor)');
    }
    
    // 3. Test upload permission (if authenticated)
    console.log('\n3. Testing upload permissions...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('⚠️  Not authenticated. Cannot test upload permissions.');
      console.warn('   Please authenticate first to test uploads.');
    } else {
      console.log(`✅ Authenticated as: ${user.email}`);
      
      // Try to list files (tests SELECT permission)
      const { data: files, error: listFilesError } = await supabase.storage
        .from(imagesBucket.name)
        .list('', { limit: 1 });
      
      if (listFilesError) {
        console.error('❌ Error listing files:', listFilesError.message);
        if (listFilesError.message.includes('row-level security') || 
            listFilesError.message.includes('RLS') ||
            listFilesError.message.includes('policy')) {
          console.error('   → This indicates missing SELECT policy!');
        }
      } else {
        console.log('✅ SELECT permission: OK (can list files)');
      }
      
      // Test upload with a small dummy file
      console.log('\n   Testing INSERT permission...');
      const testFileName = `test-upload-${Date.now()}.txt`;
      const testContent = new Blob(['test'], { type: 'text/plain' });
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(imagesBucket.name)
        .upload(`test/${testFileName}`, testContent, {
          upsert: false
        });
      
      if (uploadError) {
        console.error('❌ Upload test failed:', uploadError.message);
        
        if (uploadError.message.includes('row-level security') || 
            uploadError.message.includes('violates row-level security policy') ||
            uploadError.message.includes('RLS')) {
          console.error('\n   🔴 ROOT CAUSE IDENTIFIED: Missing INSERT policy!');
          console.error('   → The RLS policy for INSERT operations is missing or incorrect.');
          console.error('\n   💡 Solution:');
          console.error('   1. Go to Supabase Dashboard → SQL Editor');
          console.error('   2. Run the SQL script: scripts/fix-storage-rls-policies.sql');
          console.error('   3. Or manually create an INSERT policy in Storage → Policies');
        } else if (uploadError.message.includes('permission') || 
                   uploadError.message.includes('denied')) {
          console.error('   → Permission denied. Check your RLS policies.');
        } else {
          console.error('   → Other error:', uploadError.message);
        }
      } else {
        console.log('✅ INSERT permission: OK (can upload files)');
        console.log(`   Test file uploaded: ${uploadData.path}`);
        
        // Clean up test file
        const { error: deleteError } = await supabase.storage
          .from(imagesBucket.name)
          .remove([uploadData.path]);
        
        if (deleteError) {
          console.warn('   ⚠️  Could not delete test file:', deleteError.message);
        } else {
          console.log('   Test file cleaned up');
        }
      }
    }
    
    // 4. Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    console.log('\n✅ Required RLS Policies for Images bucket:');
    console.log('\n   1. SELECT (Read) - Public access:');
    console.log('      Policy: bucket_id = \'Images\'');
    console.log('      Roles: anon, authenticated');
    
    console.log('\n   2. INSERT (Upload) - Authenticated users:');
    console.log('      Policy: bucket_id = \'Images\' AND auth.role() = \'authenticated\'');
    console.log('      Roles: authenticated');
    
    console.log('\n   3. UPDATE (Optional) - Users can update their own files:');
    console.log('      Policy: bucket_id = \'Images\' AND auth.role() = \'authenticated\'');
    console.log('      Roles: authenticated');
    
    console.log('\n   4. DELETE (Optional) - Users can delete their own files:');
    console.log('      Policy: bucket_id = \'Images\' AND auth.role() = \'authenticated\'');
    console.log('      Roles: authenticated');
    
    console.log('\n💡 To fix the issue:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Open: scripts/fix-storage-rls-policies.sql');
    console.log('   3. Copy and paste the SQL into the editor');
    console.log('   4. Run the script');
    console.log('   5. Verify policies were created in Storage → Policies');
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the diagnosis
diagnoseStorageRLS().catch(console.error);

