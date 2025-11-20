/**
 * MongoDB Index Creation Script
 * Run this script to create indexes for better query performance
 * 
 * Usage:
 *   node scripts/create-mongodb-indexes.js
 * 
 * Or in MongoDB shell:
 *   mongo < scripts/create-mongodb-indexes.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/reride';

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('reride');

    // Vehicles Collection Indexes
    console.log('📊 Creating indexes for vehicles collection...');
    const vehiclesCollection = db.collection('vehicles');
    
    // Single field indexes
    await vehiclesCollection.createIndex({ make: 1 });
    await vehiclesCollection.createIndex({ model: 1 });
    await vehiclesCollection.createIndex({ price: 1 });
    await vehiclesCollection.createIndex({ status: 1 });
    await vehiclesCollection.createIndex({ city: 1 });
    await vehiclesCollection.createIndex({ state: 1 });
    await vehiclesCollection.createIndex({ year: 1 });
    await vehiclesCollection.createIndex({ sellerEmail: 1 });
    await vehiclesCollection.createIndex({ isFeatured: 1 });
    await vehiclesCollection.createIndex({ category: 1 });
    
    // Compound indexes for common queries
    await vehiclesCollection.createIndex({ make: 1, model: 1 });
    await vehiclesCollection.createIndex({ status: 1, city: 1 });
    await vehiclesCollection.createIndex({ status: 1, price: 1 });
    await vehiclesCollection.createIndex({ status: 1, isFeatured: 1 });
    await vehiclesCollection.createIndex({ city: 1, state: 1, status: 1 });
    await vehiclesCollection.createIndex({ make: 1, model: 1, year: 1 });
    
    // Text search index for search functionality
    await vehiclesCollection.createIndex({
      make: 'text',
      model: 'text',
      description: 'text',
      features: 'text'
    });
    
    // Geospatial index for location-based queries
    await vehiclesCollection.createIndex({ 'exactLocation': '2dsphere' });
    
    console.log('✅ Vehicle indexes created successfully');

    // Users Collection Indexes
    console.log('📊 Creating indexes for users collection...');
    const usersCollection = db.collection('users');
    
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ status: 1 });
    await usersCollection.createIndex({ location: 1 });
    await usersCollection.createIndex({ subscriptionPlan: 1 });
    await usersCollection.createIndex({ role: 1, status: 1 });
    
    console.log('✅ User indexes created successfully');

    // Conversations Collection Indexes
    console.log('📊 Creating indexes for conversations collection...');
    const conversationsCollection = db.collection('conversations');
    
    await conversationsCollection.createIndex({ customerId: 1 });
    await conversationsCollection.createIndex({ sellerId: 1 });
    await conversationsCollection.createIndex({ vehicleId: 1 });
    await conversationsCollection.createIndex({ lastMessageAt: -1 });
    await conversationsCollection.createIndex({ customerId: 1, sellerId: 1 });
    await conversationsCollection.createIndex({ sellerId: 1, isReadBySeller: 1 });
    await conversationsCollection.createIndex({ customerId: 1, isReadByCustomer: 1 });
    
    console.log('✅ Conversation indexes created successfully');

    // VehicleData Collection Indexes
    console.log('📊 Creating indexes for vehicleData collection...');
    const vehicleDataCollection = db.collection('vehicledata');
    
    await vehicleDataCollection.createIndex({ category: 1 });
    await vehicleDataCollection.createIndex({ 'name': 1, 'category': 1 });
    
    console.log('✅ VehicleData indexes created successfully');

    console.log('\n🎉 All indexes created successfully!');
    console.log('📈 Your database queries should now be significantly faster.');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createIndexes().catch(console.error);
}

module.exports = { createIndexes };

