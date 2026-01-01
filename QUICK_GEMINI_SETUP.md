# Quick Gemini API Key Setup 🚀

## For Vercel (Production) - 3 Steps

### Step 1: Get API Key
1. Visit: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

### Step 2: Add to Vercel
1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
2. Click "Add New"
3. Enter:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** (paste your API key)
   - **Environments:** ✅ Production ✅ Preview ✅ Development
4. Click "Save"

### Step 3: Redeploy
- Go to Deployments tab
- Click "Redeploy" on latest deployment
- Or push a new commit to trigger auto-deploy

## For Local Development

Create `.env.local` in project root:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

Then restart: `npm run dev`

## Verify It Works

Test the API endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "model": "gemini-2.5-flash",
      "contents": "Hello, test"
    }
  }'
```

Should return: `{"success": true, "response": "..."}`

## That's It! ✅

Once the API key is set, all AI features will work:
- ✅ Intelligent search
- ✅ Auto-generated descriptions
- ✅ Pros & cons
- ✅ Price suggestions
- ✅ Search suggestions






