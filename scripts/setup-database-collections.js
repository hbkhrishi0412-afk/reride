/**
 * Database Collections Setup Script
 * Creates all expected collections and indexes if they don't exist
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import VehicleData from '../models/VehicleData.js';
import NewCar from '../models/NewCar.js';
import Conversation from '../models/Conversation.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reride';

async function setupDatabaseCollections() {
  try {
    console.log('🚀 Setting up database collections...\n');
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://***:***@')}\n`);

    await mongoose.connect(MONGODB_URI, {
      dbName: 'reride',
      bufferCommands: false,
      maxPoolSize: 10,
    });

    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    
    console.log(`✅ Connected to database: ${dbName}\n`);

    // Ensure all models are registered (this creates collections if they don't exist)
    console.log('📦 Registering models...\n');
    
    const models = [
      { name: 'User', model: User },
      { name: 'Vehicle', model: Vehicle },
      { name: 'VehicleData', model: VehicleData },
      { name: 'NewCar', model: NewCar },
      { name: 'Conversation', model: Conversation },
    ];

    for (const { name, model } of models) {
      try {
        // Access the collection to ensure it exists
        const collectionName = model.collection.name;
        await db.collection(collectionName).findOne();
        console.log(`✅ ${name} -> Collection "${collectionName}" exists`);
        
        // Ensure indexes are created
        await model.createIndexes();
        const indexes = await db.collection(collectionName).indexes();
        console.log(`   📑 Created/verified ${indexes.length} indexes`);
      } catch (error) {
        if (error.code === 26) {
          // Collection doesn't exist, create it by inserting and deleting a dummy doc
          console.log(`⚠️  Collection for ${name} doesn't exist, creating...`);
          const collectionName = model.collection.name;
          const dummyDoc = new model({});
          await dummyDoc.save();
          await model.deleteOne({ _id: dummyDoc._id });
          await model.createIndexes();
          console.log(`✅ Created collection "${collectionName}" with indexes`);
        } else {
          console.error(`❌ Error setting up ${name}:`, error.message);
        }
      }
      console.log('');
    }

    // Verify final state
    const collections = await db.listCollections().toArray();
    console.log('📊 Final Collections:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Database setup complete!');

    return {
      success: true,
      dbName,
      collectionsCreated: collections.length,
    };

  } catch (error) {
    console.error('❌ Error setting up database:', error);
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
                     process.argv[1]?.includes('setup-database-collections.js') ||
                     (typeof require !== 'undefined' && require.main === module);
if (isMainModule) {
  setupDatabaseCollections()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default setupDatabaseCollections;

