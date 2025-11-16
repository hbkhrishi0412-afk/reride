/**
 * Database Structure Verification Script
 * Verifies that all expected collections exist with proper indexes
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import VehicleData from '../models/VehicleData.js';
import NewCar from '../models/NewCar.js';
import Conversation from '../models/Conversation.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reride';

const EXPECTED_COLLECTIONS = [
  { name: 'users', model: User },
  { name: 'vehicles', model: Vehicle },
  { name: 'vehicledatas', model: VehicleData },
  { name: 'newcars', model: NewCar },
  { name: 'conversations', model: Conversation },
];

async function verifyDatabaseStructure() {
  try {
    console.log('🔍 Verifying database structure...\n');
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://***:***@')}\n`);

    await mongoose.connect(MONGODB_URI, {
      dbName: 'reride',
      bufferCommands: false,
      maxPoolSize: 10,
    });

    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    
    console.log(`✅ Connected to database: ${dbName}\n`);

    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📊 Current Collections:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');

    // Check expected collections
    console.log('🔎 Checking expected collections...\n');
    const missingCollections = [];
    const existingCollections = [];

    for (const expected of EXPECTED_COLLECTIONS) {
      if (collectionNames.includes(expected.name)) {
        existingCollections.push(expected.name);
        console.log(`✅ ${expected.name} - EXISTS`);
        
        // Check indexes
        const indexes = await db.collection(expected.name).indexes();
        console.log(`   📑 Indexes (${indexes.length}):`);
        indexes.forEach(idx => {
          const keys = Object.keys(idx.key).join(', ');
          const unique = idx.unique ? ' [UNIQUE]' : '';
          const name = idx.name;
          console.log(`      - ${name}: ${keys}${unique}`);
        });
      } else {
        missingCollections.push(expected.name);
        console.log(`❌ ${expected.name} - MISSING`);
      }
      console.log('');
    }

    // Summary
    console.log('📋 Summary:');
    console.log(`   Total collections in database: ${collections.length}`);
    console.log(`   Expected collections found: ${existingCollections.length}/${EXPECTED_COLLECTIONS.length}`);
    console.log(`   Missing collections: ${missingCollections.length}`);
    
    if (missingCollections.length > 0) {
      console.log(`\n⚠️  Missing collections:`);
      missingCollections.forEach(name => {
        console.log(`   - ${name}`);
      });
      console.log('\n💡 Run the migration script to create missing collections.');
    }

    // Check for unexpected collections
    const expectedNames = EXPECTED_COLLECTIONS.map(c => c.name);
    const unexpectedCollections = collectionNames.filter(name => 
      !expectedNames.includes(name) && 
      !name.startsWith('system.')
    );
    
    if (unexpectedCollections.length > 0) {
      console.log(`\n📌 Additional collections found:`);
      unexpectedCollections.forEach(name => {
        console.log(`   - ${name}`);
      });
    }

    // Database name check
    if (dbName.toLowerCase() !== 'reride') {
      console.log(`\n⚠️  WARNING: Database name is "${dbName}" but expected "reride"`);
      console.log(`   The code expects database name to be "reride" (lowercase, no hyphen)`);
      console.log(`   Please ensure your MONGODB_URI points to the correct database.`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Verification complete!');

    return {
      success: true,
      dbName,
      totalCollections: collections.length,
      expectedFound: existingCollections.length,
      expectedTotal: EXPECTED_COLLECTIONS.length,
      missing: missingCollections,
      unexpected: unexpectedCollections,
    };

  } catch (error) {
    console.error('❌ Error verifying database structure:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('verify-database-structure.js') ||
                     (typeof require !== 'undefined' && require.main === module);
if (isMainModule) {
  verifyDatabaseStructure()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
      process.exit(result.missing.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default verifyDatabaseStructure;

