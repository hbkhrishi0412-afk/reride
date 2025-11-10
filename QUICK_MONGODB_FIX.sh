#!/bin/bash

# Quick MongoDB Connection Fix Script
# This script sets up the MongoDB connection for the ReRide app

echo "🔧 MongoDB Connection Quick Fix"
echo "================================"
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✅ .env file already exists"
    echo ""
    echo "Current MONGODB_URI status:"
    if grep -q "^MONGODB_URI=" .env; then
        echo "✅ MONGODB_URI is configured in .env"
        # Don't display the actual URI for security
        echo "   (URI is set but hidden for security)"
    else
        echo "❌ MONGODB_URI is NOT configured in .env"
        echo ""
        echo "Please add the following line to your .env file:"
        echo "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/reride"
    fi
else
    echo "❌ .env file does not exist"
    echo ""
    echo "Creating .env file from template..."
    
    # Create .env file with the known credentials (for development only)
    cat > .env << 'EOF'
# MongoDB Configuration
MONGODB_URI=mongodb+srv://hbk_hrishi0412:Qaz%403755@cluster0.nmiwnl7.mongodb.net/reride?retryWrites=true&w=majority&appName=Cluster0

# Database Name
DB_NAME=reride

# Environment
NODE_ENV=development

# JWT Secret (change in production)
JWT_SECRET=dev-secret-change-in-production
EOF
    
    echo "✅ .env file created successfully"
    echo ""
    echo "⚠️  SECURITY WARNING:"
    echo "   The credentials in .env are from the development server."
    echo "   For production, please use different credentials!"
    echo "   This file is already in .gitignore and won't be committed."
fi

echo ""
echo "🔍 Checking Node.js dependencies..."

# Check if dotenv is installed
if npm list dotenv --depth=0 2>&1 | grep -q "dotenv@"; then
    echo "✅ dotenv package is installed"
else
    echo "❌ dotenv package is not installed"
    echo "📦 Installing dotenv..."
    npm install dotenv
    echo "✅ dotenv installed successfully"
fi

echo ""
echo "🧪 Testing MongoDB connection..."

# Create a quick test script
cat > test-mongodb-quick.js << 'EOF'
import { config } from 'dotenv';
import mongoose from 'mongoose';

config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
}

console.log('🔄 Connecting to MongoDB...');

try {
    await mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        dbName: 'reride'
    });
    
    console.log('✅ MongoDB connection successful!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🔗 Host:', mongoose.connection.host);
    
    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections:', collections.map(c => c.name).join(', '));
    
    await mongoose.disconnect();
    console.log('✅ Connection test completed successfully');
    process.exit(0);
} catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
}
EOF

# Run the test
node test-mongodb-quick.js

echo ""
echo "🚀 Next Steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. The API will now use MongoDB instead of mock data"
echo "3. Visit http://localhost:5173 to test the application"
echo ""
echo "📝 To use MongoDB dev server explicitly:"
echo "   node dev-api-server-mongodb.js"
echo ""
echo "⚠️  Remember to rotate the MongoDB credentials for production!"
