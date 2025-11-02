# MongoDB Setup and Usage Guide

## Current Status

The application has TWO development server options:

### 1. Mock Data Server (Default)
- **Server**: `dev-api-server.js`
- **Command**: `npm run dev`
- **Data Storage**: In-memory mock data
- **Persistence**: ❌ Data is lost on server restart
- **Use Case**: Quick testing and development

### 2. MongoDB Server (Recommended for Production Testing)
- **Server**: `dev-api-server-mongodb.js`
- **Command**: `npm run dev:mongodb`
- **Data Storage**: MongoDB Atlas Cloud Database
- **Persistence**: ✅ All data persists to MongoDB
- **Use Case**: Production-like testing, data validation

## How to Use MongoDB Server

### Prerequisites
The MongoDB server is already configured with a connection string embedded in the code.

### Running MongoDB Server

1. **Stop current dev server** if running:
   ```bash
   Press Ctrl+C in terminal
   ```

2. **Start MongoDB-enabled server**:
   ```bash
   npm run dev:mongodb
   ```

3. **Verify connection**:
   - Check terminal logs for "✅ Connected to MongoDB"
   - Visit `http://localhost:3001/api/health` to see connection status

### What Gets Saved to MongoDB

When using `npm run dev:mongodb`, ALL operations are saved to MongoDB:

✅ **Vehicles**
- Creating new vehicles
- Updating vehicle details
- Marking as sold
- Feature/certify actions
- Boost campaigns
- Refreshing/renewing listings
- Deleting vehicles

✅ **Users**
- Creating accounts
- User profiles
- Login/authentication
- Seller/Customer/Admin roles

✅ **Actions**
- Boost: Creates activeBoosts array with boost details
- Certify: Updates certificationStatus to 'requested'
- Feature: Sets isFeatured=true with featuredAt timestamp
- Sold: Updates status='sold' with soldAt timestamp
- Refresh/Renew: Updates listing lifecycle fields

## Database Schema

### Vehicle Model
```javascript
{
  id: Number,
  make, model, year, price, mileage,
  sellerEmail, sellerName,
  status: 'published' | 'unpublished' | 'sold',
  isFeatured: Boolean,
  featuredAt: Date,
  certificationStatus: 'none' | 'requested' | 'approved' | 'rejected' | 'certified',
  certificationRequestedAt: Date,
  soldAt: Date,
  activeBoosts: Array,
  listingExpiresAt: Date,
  listingStatus: 'active' | 'expired' | 'sold' | 'suspended' | 'draft',
  ...other fields
}
```

### User Model
```javascript
{
  email: String (unique),
  name, password, mobile, role,
  status: 'active' | 'inactive',
  subscriptionPlan, featuredCredits,
  dealershipName, bio, logoUrl,
  ...other fields
}
```

## Verify Data in MongoDB

### Using MongoDB Atlas Dashboard
1. Go to https://cloud.mongodb.com
2. Sign in to your account
3. Navigate to your cluster
4. Click "Browse Collections"
5. Select database: `reride`
6. View collections: `vehicles`, `users`

### Using API Health Check
Visit: `http://localhost:3001/api/health`

Response shows:
- MongoDB connection status
- Available endpoints
- Server timestamp

## Production API (Vercel Deployment)

The production API in `/api/main.ts` also uses MongoDB when:
- `MONGODB_URI` environment variable is set
- Deployed to Vercel with proper environment configuration

Production API features:
- Full MongoDB integration
- Proper error handling
- Fallback to default data if DB unavailable
- All vehicle/user operations saved

## Troubleshooting

### MongoDB Connection Fails
**Problem**: "MongoDB connection failed" in logs

**Solutions**:
1. Check internet connection
2. Verify MongoDB cluster is running
3. Check IP whitelist in MongoDB Atlas
4. Verify connection string is correct

### Data Not Persisting
**Problem**: Changes lost after restart

**Solution**: Make sure you're running `npm run dev:mongodb` not `npm run dev`

### Action Buttons Not Working
**Problem**: Boost/Certify/Feature/Sold buttons do nothing

**Solutions**:
1. Check browser console for errors
2. Verify API server is running
3. Check network tab for failed requests
4. Ensure using correct dev server (mock vs MongoDB)

## Quick Reference

| Command | Data Storage | Persistence | Use When |
|---------|-------------|-------------|----------|
| `npm run dev` | In-memory mock | ❌ No | Quick testing |
| `npm run dev:mongodb` | MongoDB Atlas | ✅ Yes | Production testing |
| Production Deploy | MongoDB Atlas | ✅ Yes | Live app |

## Next Steps

1. **For Development**: Use `npm run dev:mongodb` for persistent testing
2. **Verify**: Check MongoDB Atlas dashboard to see your data
3. **Test Actions**: All button clicks are saved to database
4. **Monitor**: Watch server logs for database operations

## API Endpoints

### GET Requests
- `GET /api/vehicles` - All vehicles
- `GET /api/users` - All users
- `GET /api/health` - Server status

### POST Requests
- `POST /api/vehicles?action=boost` - Boost listing
- `POST /api/vehicles?action=feature` - Feature listing
- `POST /api/vehicles?action=certify` - Request certification
- `POST /api/vehicles?action=sold` - Mark as sold
- `POST /api/vehicles?action=refresh` - Refresh listing

### PUT/DELETE Requests
- `PUT /api/vehicles` - Update vehicle
- `DELETE /api/vehicles` - Delete vehicle

All operations with MongoDB server are logged and saved!

