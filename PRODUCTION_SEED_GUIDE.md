# Production Database Seeding Guide

## Problem
- **Local**: Shows 50 vehicles (from localStorage)
- **Production**: Shows 0 vehicles (Firebase database is empty)
- **Admin Panel**: Also shows 0 vehicles

## Solution
The seed endpoint has been updated to allow production seeding with a secret key. It will create **50 vehicles** and **3 test users**.

## How to Seed Production Database

### Option 1: Using the Web Interface (Recommended)

1. **Deploy your updated code** to production (if not already deployed)

2. **Set the Secret Key** in Vercel:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `SEED_SECRET_KEY` = `reride-seed-2024-production` (or any secure value you prefer)
   - Redeploy if needed

3. **Visit the seed page**:
   - Go to: `https://www.reride.co.in/seed-production.html`
   - Or upload `seed-production.html` to your `public` folder if not already there

4. **Fill in the form**:
   - **Site URL**: `https://www.reride.co.in` (auto-filled)
   - **Secret Key**: `reride-seed-2024-production` (or your custom value)

5. **Click "Seed Database Now"**

6. **Wait for completion** - You'll see:
   - ✅ 3 users created (admin, seller, customer)
   - ✅ 50 vehicles created
   - 🔑 Login credentials displayed

### Option 2: Using cURL (Command Line)

```bash
curl -X POST https://www.reride.co.in/api/seed \
  -H "Content-Type: application/json" \
  -H "x-seed-secret: reride-seed-2024-production" \
  -d '{"secretKey": "reride-seed-2024-production"}'
```

### Option 3: Using JavaScript (Browser Console)

Open browser console on your production site and run:

```javascript
fetch('/api/seed', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-seed-secret': 'reride-seed-2024-production'
  },
  body: JSON.stringify({ secretKey: 'reride-seed-2024-production' })
})
.then(r => r.json())
.then(data => console.log('✅ Seeded:', data))
.catch(err => console.error('❌ Error:', err));
```

## Test Login Credentials

After seeding, you can login with:

- **Admin**: 
  - Email: `admin@test.com`
  - Password: `password` (or value from `SEED_ADMIN_PASSWORD` env var)

- **Seller**: 
  - Email: `seller@test.com`
  - Password: `password` (or value from `SEED_SELLER_PASSWORD` env var)

- **Customer**: 
  - Email: `customer@test.com`
  - Password: `password` (or value from `SEED_CUSTOMER_PASSWORD` env var)

## What Gets Created

- **3 Users**: Admin, Seller, Customer
- **50 Vehicles**: Various makes/models with realistic data
  - Makes: Tata, Mahindra, Hyundai, Maruti Suzuki, Honda, Toyota, Kia, MG
  - All vehicles are set to `status: 'published'`
  - Random cities: Mumbai, Delhi, Bangalore, Pune, Chennai, Hyderabad
  - Random prices, mileage, features, etc.

## Security Notes

- The seed endpoint **requires a secret key** in production
- Default secret key: `reride-seed-2024-production`
- You can set a custom key via `SEED_SECRET_KEY` environment variable
- The seed endpoint is **blocked without the secret key** in production
- In development, the secret key is optional

## Troubleshooting

### Error: "Invalid or missing secret key"
- Make sure you're providing the secret key in the request
- Check that `SEED_SECRET_KEY` in Vercel matches what you're sending
- Default value is `reride-seed-2024-production`

### Error: "Firebase is not configured"
- Check that Firebase environment variables are set in Vercel:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_DATABASE_URL`

### Vehicles still showing 0 after seeding
- Check Vercel function logs for errors
- Verify Firebase Realtime Database has data
- Clear browser cache and refresh
- Check that vehicles have `status: 'published'` (only published vehicles show on main page)

## Verification

After seeding, verify:

1. **Main Page**: Should show 50 vehicles
2. **Admin Panel**: Should show:
   - Total Users: 3
   - Total Vehicles: 50
   - Active Listings: 50

3. **API Check**: 
   ```bash
   curl https://www.reride.co.in/api/vehicles | jq '. | length'
   ```
   Should return: `50`

## Re-seeding

If you need to re-seed:
- The seed function will **delete existing test vehicles** (from `seller@test.com`) before creating new ones
- This prevents duplicates
- You can run the seed multiple times safely
