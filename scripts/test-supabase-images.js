/**
 * Test script to verify Supabase Storage images bucket is accessible
 * Run with: node scripts/test-supabase-images.js
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

async function testStorageBucket() {
  console.log('🔍 Testing Supabase Storage Images Bucket...\n');
  
  try {
    // 1. Check if bucket exists
    console.log('1. Checking if "images" bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      return;
    }
    
    const imagesBucket = buckets.find(b => b.name === 'Images' || b.name === 'images');
    if (!imagesBucket) {
      console.error('❌ "Images" bucket not found!');
      console.log('Available buckets:', buckets.map(b => b.name).join(', '));
      console.log('\n💡 Solution: Create an "images" bucket in Supabase Dashboard → Storage');
      return;
    }
    
    console.log(`✅ "${imagesBucket.name}" bucket found`);
    console.log('   - Public:', imagesBucket.public ? 'Yes' : 'No');
    console.log('   - Created:', imagesBucket.created_at);
    
    if (!imagesBucket.public) {
      console.warn('\n⚠️  WARNING: Bucket is not public!');
      console.warn('   Images may not be accessible via public URLs.');
      console.warn(`   Solution: Make the bucket public in Supabase Dashboard → Storage → ${imagesBucket.name} → Settings`);
    }
    
    // 2. List files in the bucket
    console.log(`\n2. Listing files in "${imagesBucket.name}" bucket...`);
    const { data: files, error: listFilesError } = await supabase.storage
      .from(imagesBucket.name)
      .list('', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (listFilesError) {
      console.error('❌ Error listing files:', listFilesError.message);
      return;
    }
    
    if (!files || files.length === 0) {
      console.warn(`⚠️  No files found in "${imagesBucket.name}" bucket`);
      console.log('   This is normal if you haven\'t uploaded any images yet.');
    } else {
      console.log(`✅ Found ${files.length} file(s):`);
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
      });
    }
    
    // 3. Test public URL generation
    console.log('\n3. Testing public URL generation...');
    if (files && files.length > 0) {
      const testFile = files[0];
      const testPath = testFile.name;
      
      const { data: urlData, error: urlError } = supabase.storage
        .from(imagesBucket.name)
        .getPublicUrl(testPath);
      
      if (urlError) {
        console.error('❌ Error generating public URL:', urlError.message);
      } else if (urlData?.publicUrl) {
        console.log('✅ Public URL generated successfully:');
        console.log('   Path:', testPath);
        console.log('   URL:', urlData.publicUrl);
        
        // 4. Test if URL is accessible
        console.log('\n4. Testing URL accessibility...');
        try {
          const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log('✅ URL is accessible (HTTP', response.status + ')');
          } else {
            console.warn('⚠️  URL returned HTTP', response.status);
            if (response.status === 403) {
              console.warn('   This usually means the bucket is not public or has restrictive policies.');
            }
          }
        } catch (fetchError) {
          console.error('❌ Error fetching URL:', fetchError.message);
        }
      } else {
        console.error('❌ No public URL returned');
      }
    } else {
      console.log('⚠️  Skipping URL test (no files in bucket)');
    }
    
    // 5. Check storage policies
    console.log('\n5. Storage Policies:');
    console.log('   Note: Storage policies are managed in Supabase Dashboard.');
    console.log('   For public access, ensure you have a policy like:');
    console.log('   - Policy Name: "Public Access"');
    console.log('   - Operation: SELECT');
    console.log('   - Target Roles: anon, authenticated');
    console.log('   - Policy: bucket_id = \'images\'');
    
    console.log('\n✅ Storage bucket test completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testStorageBucket().catch(console.error);

