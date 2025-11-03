# Vercel Deployment Guide

## Environment Variables Required

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required Variables:

1. **MONGODB_URI**
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/reride`
   - Required for: User registration, authentication, vehicle data storage
   - Apply to: Production, Preview, Development

2. **GEMINI_API_KEY** (Optional)
   - Format: Your Google Gemini API key
   - Required for: AI-powered features (seller suggestions, recommendations)
   - Apply to: Production, Preview (optional for Development)

## MongoDB Atlas Configuration

1. **Network Access**
   - Go to MongoDB Atlas → Network Access
   - Add IP Address: `0.0.0.0/0` (Allow all IPs) OR add Vercel's IP ranges
   - Wait 2-3 minutes after adding IP whitelist

2. **Database User**
   - Create a database user with read/write permissions
   - Use this user's credentials in MONGODB_URI

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect Vercel to GitHub**
   - Import your repository in Vercel Dashboard
   - Vercel will auto-detect Vite framework

3. **Configure Environment Variables**
   - Add MONGODB_URI and GEMINI_API_KEY in Vercel Dashboard
   - Ensure they're enabled for Production environment

4. **Deploy**
   - Vercel will auto-deploy on push
   - Or manually trigger deployment from Dashboard

## Testing Deployment

After deployment, test these endpoints:

1. **Health Check**: `https://your-app.vercel.app/api/db-health`
   - Should return: `{"status":"ok","message":"Database connected successfully."}`

2. **Frontend**: `https://your-app.vercel.app/`
   - Should load the React application

3. **User Registration**: Try registering a new user
   - Should save to MongoDB successfully

## Common Issues

### Issue: MongoDB Connection Failed
**Solution**: 
- Check MONGODB_URI format in Vercel environment variables
- Verify MongoDB Atlas Network Access allows `0.0.0.0/0`
- Check database user permissions

### Issue: Build Fails
**Solution**:
- Check Node.js version (should be 20.x)
- Ensure all dependencies are in package.json
- Check build logs in Vercel Dashboard

### Issue: API Routes Not Working
**Solution**:
- Verify `vercel.json` has correct rewrites
- Check API files are in `/api` directory
- Ensure API functions export default handler

### Issue: Function Timeout
**Solution**:
- Increase `maxDuration` in `vercel.json` if needed (currently 10s)
- Optimize database queries
- Check MongoDB connection pooling settings

## Build Configuration

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: 20.x
- **Install Command**: `npm install`

## API Routes

All API routes are in `/api` directory and are automatically deployed as serverless functions:
- `/api/main` - Main user and vehicle API
- `/api/vehicles` - Vehicle endpoints
- `/api/vehicle-data` - Vehicle data configuration
- `/api/plans` - Subscription plans
- `/api/payments` - Payment processing
- `/api/ai` - AI features (Gemini)
- `/api/sell-car` - Sell car workflow

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Check MongoDB Atlas logs
3. Verify environment variables are set correctly
4. Test database connection using `/api/db-health` endpoint

