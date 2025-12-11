// Test MongoDB connection using the same logic as the app
import { ensureConnection, getConnectionState, isConnectionHealthy } from './lib/db.js';
import mongoose from 'mongoose';

async function testConnection() {
  try {
    console.log('🔍 Testing MongoDB connection using app connection logic...\n');
    
    // Check environment variables
    const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URL or MONGODB_URI environment variable is not set!');
      console.log('\n📝 To fix this:');
      console.log('1. Create a .env.local file in your project root:');
      console.log('   MONGODB_URI=your_connection_string_here\n');
      console.log('2. Or set it as an environment variable:');
      console.log('   Windows PowerShell: $env:MONGODB_URI="your_connection_string_here"');
      console.log('   Linux/Mac: export MONGODB_URI="your_connection_string_here"\n');
      console.log('💡 Connection string examples:');
      console.log('   - MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/reride');
      console.log('   - Local MongoDB: mongodb://localhost:27017/reride\n');
      process.exit(1);
    }
    
    const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log('📡 Connection string:', maskedUri);
    console.log('🔄 Attempting to connect...\n');
    
    // Use the same connection function as the app
    await ensureConnection();
    
    // Check connection state
    const state = getConnectionState();
    console.log('✅ Connection successful!');
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Port: ${mongoose.connection.port || 'N/A (Atlas)'}`);
    console.log(`   Ready State: ${state.stateName} (${state.state})`);
    console.log(`   Healthy: ${isConnectionHealthy() ? 'Yes' : 'No'}\n`);
    
    // Test basic operations
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`📁 Collections (${collections.length}):`);
      if (collections.length > 0) {
        collections.forEach(col => {
          console.log(`   - ${col.name}`);
        });
      } else {
        console.log('   (No collections found - database may be empty)');
      }
    } catch (err) {
      console.warn(`⚠️  Could not list collections: ${err.message}`);
    }
    
    // Test ping
    try {
      await mongoose.connection.db.admin().ping();
      console.log('\n✅ Connection ping successful');
    } catch (pingError) {
      console.warn(`\n⚠️  Connection ping failed: ${pingError.message}`);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected successfully');
    console.log('\n🎉 All connection tests passed! Your MongoDB connection is working correctly.\n');
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    // Provide specific troubleshooting based on error type
    console.log('\n🔧 Troubleshooting Guide:\n');
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.log('Authentication Error:');
      console.log('   1. Check your username and password are correct');
      console.log('   2. Verify the database user exists in MongoDB Atlas');
      console.log('   3. Ensure the user has read/write permissions');
      console.log('   4. Check if special characters in password are URL-encoded');
      console.log('      - @ should be %40');
      console.log('      - # should be %23');
      console.log('      - / should be %2F\n');
    } else if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('Network Error:');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify MongoDB Atlas cluster is running');
      console.log('   3. Check MongoDB Atlas Network Access settings:');
      console.log('      - Go to MongoDB Atlas → Network Access');
      console.log('      - Add your IP address (or 0.0.0.0/0 for development)');
      console.log('   4. Verify the cluster hostname is correct\n');
    } else if (error.message.includes('MongoServerSelectionError')) {
      console.log('Server Selection Error:');
      console.log('   1. Check if MongoDB Atlas cluster is paused (free tier)');
      console.log('   2. Verify the cluster is running in MongoDB Atlas dashboard');
      console.log('   3. Check network connectivity\n');
    } else if (error.message.includes('not configured') || error.message.includes('not defined')) {
      console.log('Configuration Error:');
      console.log('   1. Set MONGODB_URL or MONGODB_URI environment variable');
      console.log('   2. For Vercel: Add it in Settings → Environment Variables');
      console.log('   3. For local: Create .env.local file\n');
    } else {
      console.log('General Error:');
      console.log('   1. Check MongoDB Atlas cluster status');
      console.log('   2. Verify connection string format');
      console.log('   3. Run: npm run db:diagnose (if available)');
      console.log('   4. Check MongoDB Atlas logs for more details\n');
    }
    
    console.log('💡 For more help, run: node diagnose-db-connection.js\n');
    process.exit(1);
  }
}

testConnection();
