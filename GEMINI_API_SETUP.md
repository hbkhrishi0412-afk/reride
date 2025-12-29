# Gemini API Key Setup Guide ✅

## Overview

The AI features in ReRide use Google's Gemini API. This guide will help you set up the API key so all AI features work properly.

## AI Features That Use Gemini

- 🤖 **Intelligent Search** - Parse natural language search queries
- 📝 **Vehicle Descriptions** - Auto-generate compelling vehicle descriptions
- ✅ **Pros & Cons** - Generate balanced pros and cons for vehicles
- 💡 **Price Suggestions** - AI-powered pricing guidance for sellers
- 🎯 **Search Suggestions** - Smart search query suggestions
- 🤖 **Seller Suggestions** - AI recommendations for improving listings

## Step 1: Get Your Gemini API Key

1. **Visit Google AI Studio**
   - Go to: https://aistudio.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API Key" button
   - Select your Google Cloud project (or create a new one)
   - Copy the generated API key

3. **Important Notes**
   - Keep your API key secret - never commit it to version control
   - The API key has usage limits (check Google AI Studio for details)
   - Free tier includes generous usage limits

## Step 2: Add API Key to Vercel (Production)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Navigate to Environment Variables**
   - Go to: Settings → Environment Variables

3. **Add Gemini API Key**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API key (paste the key you copied)
   - **Environment:** Select all (Production, Preview, Development)

4. **Save and Redeploy**
   - Click "Save"
   - Redeploy your application for changes to take effect

## Step 3: Add API Key for Local Development

1. **Create/Edit `.env.local` file**
   ```bash
   # In your project root directory
   touch .env.local
   ```

2. **Add the API key**
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

3. **Restart Development Server**
   ```bash
   npm run dev
   ```

## Step 4: Verify Setup

### Test 1: Check API Endpoint
```bash
curl -X POST https://your-app.vercel.app/api/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "model": "gemini-2.5-flash",
      "contents": "Hello, test message"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "response": "Hello! How can I help you today?",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test 2: Test AI Features in App
1. Go to your deployed app
2. Try the intelligent search feature
3. Add a vehicle and use "Generate Description" button
4. Check vehicle detail page for pros/cons

### Test 3: Check Logs
If the API key is missing, you'll see:
```json
{
  "success": false,
  "reason": "GEMINI_API_KEY environment variable is not configured"
}
```

## Current Implementation

The API handler is located at `api/main.ts` (function `handleGemini`):

```typescript
// Line 3248: Checks for API key
if (!process.env.GEMINI_API_KEY) {
  return res.status(500).json({
    success: false,
    reason: 'GEMINI_API_KEY environment variable is not configured'
  });
}

// Line 3289: Uses API key in request
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
```

## API Endpoint Details

- **Endpoint:** `/api/gemini`
- **Method:** POST
- **Required:** `GEMINI_API_KEY` environment variable
- **Default Model:** `gemini-2.5-flash`
- **Supported Models:**
  - `gemini-2.5-flash` (default, fast and efficient)
  - `gemini-2.0-flash` (alternative)
  - `gemini-pro` (more capable, slower)

## Troubleshooting

### Issue: "GEMINI_API_KEY environment variable is not configured"
**Solution:**
- Verify the key is set in Vercel Environment Variables
- Make sure it's enabled for the correct environment (Production/Preview/Development)
- Redeploy after adding the variable

### Issue: "Gemini API call failed"
**Possible Causes:**
- Invalid API key
- API key has reached usage limits
- Network connectivity issues
- Invalid request format

**Solution:**
- Verify API key is correct in Google AI Studio
- Check API usage/quota in Google AI Studio
- Check server logs for specific error messages

### Issue: AI features not working in development
**Solution:**
- Make sure `.env.local` file exists with `GEMINI_API_KEY`
- Restart development server after adding the key
- Check that `.env.local` is in `.gitignore` (should not be committed)

## Security Best Practices

1. ✅ **Never commit API keys to Git**
   - `.env.local` should be in `.gitignore`
   - Use environment variables in production

2. ✅ **Use different keys for dev/prod** (optional but recommended)
   - Create separate API keys for development and production
   - Set different limits/restrictions per key

3. ✅ **Monitor API usage**
   - Check Google AI Studio dashboard regularly
   - Set up usage alerts if available

4. ✅ **Rotate keys if compromised**
   - If a key is exposed, revoke it immediately
   - Generate a new key and update environment variables

## Environment Variable Summary

| Variable | Required | Description | Where to Get |
|----------|----------|-------------|--------------|
| `GEMINI_API_KEY` | Yes (for AI features) | Google Gemini API key | [Google AI Studio](https://aistudio.google.com/app/apikey) |

## Status: ✅ Ready to Configure

The code is already set up to use the Gemini API key. You just need to:
1. Get your API key from Google AI Studio
2. Add it to Vercel environment variables
3. Redeploy your application

Once configured, all AI features will work automatically!




