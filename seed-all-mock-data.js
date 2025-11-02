#!/usr/bin/env node

/**
 * Comprehensive MongoDB Seeding Script
 * 
 * This script seeds your MongoDB database with ALL mock data from:
 * - constants.ts (MOCK_USERS, MOCK_FAQS, MOCK_SUPPORT_TICKETS, MOCK_VEHICLES)
 * - mock-users.json
 * - mock-vehicles.json
 * 
 * Usage:
 *   node seed-all-mock-data.js
 *   node seed-all-mock-data.js <mongodb-uri>
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to generate past dates
const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
};

// MongoDB connection function
async function connectToDatabase() {
    let MONGODB_URI = process.env.MONGODB_URI;
    
    // If no MONGODB_URI is set, try to use local MongoDB
    if (!MONGODB_URI) {
        MONGODB_URI = 'mongodb://localhost:27017/reride';
        log('⚠️  No MONGODB_URI environment variable found. Using local MongoDB.', 'yellow');
        log('💡 To use a different database, set MONGODB_URI environment variable.', 'cyan');
    }

    console.log('🔄 Creating MongoDB connection...');
    const mongooseInstance = await mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        dbName: 'reride'
    });
    
    console.log('✅ MongoDB connected successfully to database:', mongooseInstance.connection.name);
    return mongooseInstance;
}

// Mock data from constants.ts (without id field to avoid TypeScript errors)
const MOCK_USERS = [
    { 
        name: 'Prestige Motors', 
        email: 'seller@test.com', 
        password: 'password', 
        mobile: '+91-98765-43210', 
        role: 'seller', 
        location: 'Mumbai', 
        status: 'active', 
        createdAt: daysAgo(30), 
        dealershipName: 'Prestige Motors', 
        bio: 'Specializing in luxury and performance electric vehicles since 2020.', 
        logoUrl: 'https://i.pravatar.cc/100?u=seller', 
        avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com', 
        isVerified: true, 
        subscriptionPlan: 'premium', 
        featuredCredits: 5, 
        usedCertifications: 1 
    },
    { 
        name: 'Mock Customer', 
        email: 'customer@test.com', 
        password: 'password', 
        mobile: '555-987-6543', 
        role: 'customer', 
        location: 'Delhi', 
        status: 'active', 
        createdAt: daysAgo(15), 
        avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com' 
    },
    { 
        name: 'Mock Admin', 
        email: 'admin@test.com', 
        password: 'password', 
        mobile: '111-222-3333', 
        role: 'admin', 
        location: 'Bangalore', 
        status: 'active', 
        createdAt: daysAgo(100), 
        avatarUrl: 'https://i.pravatar.cc/150?u=admin@test.com' 
    },
    { 
        name: 'Jane Doe', 
        email: 'jane.doe@customer.com', 
        password: 'password', 
        mobile: '555-111-2222', 
        role: 'customer', 
        location: 'Chennai', 
        status: 'active', 
        createdAt: daysAgo(5), 
        avatarUrl: 'https://i.pravatar.cc/150?u=jane.doe@customer.com' 
    },
    { 
        name: 'Reliable Rides', 
        email: 'john.smith@seller.com', 
        password: 'password', 
        mobile: '555-333-4444', 
        role: 'seller', 
        location: 'Pune', 
        status: 'active', 
        createdAt: daysAgo(60), 
        dealershipName: 'Reliable Rides', 
        bio: 'Your trusted source for pre-owned family cars and SUVs.', 
        logoUrl: 'https://i.pravatar.cc/100?u=johnsmith', 
        avatarUrl: 'https://i.pravatar.cc/150?u=john.smith@seller.com', 
        isVerified: false, 
        subscriptionPlan: 'pro', 
        featuredCredits: 2, 
        usedCertifications: 0 
    },
    { 
        name: 'Speedy Auto', 
        email: 'speedy@auto.com', 
        password: 'password', 
        mobile: '555-555-1111', 
        role: 'seller', 
        location: 'Hyderabad', 
        status: 'active', 
        createdAt: daysAgo(90), 
        dealershipName: 'Speedy Auto', 
        bio: 'Performance and sports cars for the enthusiast.', 
        logoUrl: 'https://i.pravatar.cc/100?u=speedy', 
        avatarUrl: 'https://i.pravatar.cc/150?u=speedy@auto.com', 
        isVerified: true, 
        subscriptionPlan: 'pro', 
        featuredCredits: 1, 
        usedCertifications: 1 
    },
    { 
        name: 'Eco Drive', 
        email: 'eco@drive.com', 
        password: 'password', 
        mobile: '555-222-5555', 
        role: 'seller', 
        location: 'Kolkata', 
        status: 'active', 
        createdAt: daysAgo(45), 
        dealershipName: 'Eco Drive', 
        bio: 'The best deals on electric and hybrid vehicles.', 
        logoUrl: 'https://i.pravatar.cc/100?u=eco', 
        avatarUrl: 'https://i.pravatar.cc/150?u=eco@drive.com', 
        isVerified: false, 
        subscriptionPlan: 'free', 
        featuredCredits: 0, 
        usedCertifications: 0 
    }
];

const MOCK_FAQS = [
    { 
        question: "How do I list my car for sale?", 
        answer: "Navigate to the 'Sell' section, log in or register as a seller, and follow the on-screen instructions to create a new vehicle listing. You'll need details like make, model, year, and photos.", 
        category: "Selling" 
    },
    { 
        question: "What is AI Price Suggestion?", 
        answer: "Our AI Price Suggestion tool analyzes your vehicle's details and compares them with current market listings to recommend a fair and competitive price, helping you sell faster.", 
        category: "Selling" 
    },
    { 
        question: "How can I contact a seller?", 
        answer: "On any vehicle detail page, you can use the 'Chat with Seller' button to start a direct conversation with the seller to ask questions or schedule a test drive.", 
        category: "Buying" 
    },
    { 
        question: "Is my personal information secure?", 
        answer: "Yes, we take data security very seriously. All personal information is encrypted and stored securely. We do not share your details with third parties without your consent.", 
        category: "General" 
    }
];

const MOCK_SUPPORT_TICKETS = [
    { 
        userEmail: 'customer@test.com', 
        userName: 'Mock Customer', 
        subject: 'Issue with chat', 
        message: 'I am unable to see messages from a seller.', 
        status: 'Open', 
        createdAt: daysAgo(2), 
        updatedAt: daysAgo(2), 
        replies: [] 
    },
    { 
        userEmail: 'jane.doe@customer.com', 
        userName: 'Jane Doe', 
        subject: 'Payment failed for inspection', 
        message: 'I tried to purchase a certified inspection report but my payment failed. My card is working fine elsewhere.', 
        status: 'In Progress', 
        createdAt: daysAgo(1), 
        updatedAt: daysAgo(0), 
        replies: [{ 
            author: 'admin@test.com', 
            message: 'We are looking into this issue and will get back to you shortly.', 
            timestamp: daysAgo(0) 
        }] 
    },
    { 
        userEmail: 'seller@test.com', 
        userName: 'Prestige Motors', 
        subject: 'How to feature a listing?', 
        message: 'I have upgraded my plan but cannot find the option to feature my new listing.', 
        status: 'Closed', 
        createdAt: daysAgo(5), 
        updatedAt: daysAgo(4), 
        replies: [{ 
            author: 'admin@test.com', 
            message: 'You can feature a listing from your Seller Dashboard under the "My Listings" tab. There is a "Feature" button in the actions column.', 
            timestamp: daysAgo(4) 
        }] 
    }
];

async function seedAllData() {
    try {
        log('🚀 Starting comprehensive MongoDB seeding...', 'bright');
        
        // Connect to MongoDB
        log('🔄 Connecting to MongoDB...', 'blue');
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        
        log('✅ Connected to MongoDB successfully!', 'green');
        
        // Seed Users
        log('\n📝 Seeding Users...', 'cyan');
        await db.collection('users').deleteMany({});
        const usersResult = await db.collection('users').insertMany(MOCK_USERS);
        log(`✅ Seeded ${usersResult.insertedCount} users`, 'green');
        
        // Load and seed vehicles from JSON file
        log('\n🚗 Seeding Vehicles from JSON...', 'cyan');
        const vehiclesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'mock-vehicles.json'), 'utf8'));
        await db.collection('vehicles').deleteMany({});
        const vehiclesResult = await db.collection('vehicles').insertMany(vehiclesData);
        log(`✅ Seeded ${vehiclesResult.insertedCount} vehicles`, 'green');
        
        // Seed FAQs
        log('\n❓ Seeding FAQs...', 'cyan');
        await db.collection('faqs').deleteMany({});
        const faqsResult = await db.collection('faqs').insertMany(MOCK_FAQS);
        log(`✅ Seeded ${faqsResult.insertedCount} FAQs`, 'green');
        
        // Seed Support Tickets
        log('\n🎫 Seeding Support Tickets...', 'cyan');
        await db.collection('supportTickets').deleteMany({});
        const ticketsResult = await db.collection('supportTickets').insertMany(MOCK_SUPPORT_TICKETS);
        log(`✅ Seeded ${ticketsResult.insertedCount} support tickets`, 'green');
        
        // Display summary
        log('\n📊 Seeding Summary:', 'bright');
        log(`👥 Users: ${usersResult.insertedCount}`, 'green');
        log(`🚗 Vehicles: ${vehiclesResult.insertedCount}`, 'green');
        log(`❓ FAQs: ${faqsResult.insertedCount}`, 'green');
        log(`🎫 Support Tickets: ${ticketsResult.insertedCount}`, 'green');
        
        log('\n🎉 All mock data seeded successfully!', 'bright');
        log('💡 You can now remove the hardcoded mock data from constants.ts', 'yellow');
        
    } catch (error) {
        log(`❌ Error seeding data: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the seeding
seedAllData();
