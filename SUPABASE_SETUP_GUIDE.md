# Supabase Setup Guide

## Getting Your Supabase Credentials

Follow these steps to get your Supabase API credentials:

### Step 1: Navigate to API Settings

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (e.g., `supabase-teal-island`)
3. In the left sidebar, click on **"Settings"** (gear icon)
4. Click on **"API"** in the Settings menu

### Step 2: Copy Your Credentials

On the API settings page, you'll find three important values:

#### 1. Project URL
- **Location**: Under "Project URL" section
- **Format**: `https://xxxxx.supabase.co`
- **Example**: `https://pqtrsoytudolnvuydvfo.supabase.co`
- **Usage**: Used to connect to your Supabase project

#### 2. anon public key
- **Location**: Under "Project API keys" → "anon public"
- **Description**: This is a public key that's safe to use in client-side code
- **Usage**: Used for client-side operations (browser, mobile apps)
- **Security**: Safe to expose - it respects Row Level Security (RLS) policies

#### 3. service_role key
- **Location**: Under "Project API keys" → "service_role" (click "Reveal" to see it)
- **Description**: This is a secret key with admin privileges
- **Usage**: Only for server-side operations (API routes, serverless functions)
- **Security**: ⚠️ **KEEP SECRET** - Never expose in client-side code or commit to git
- **Warning**: This key bypasses Row Level Security (RLS) policies

### Step 3: Add to Your Environment Variables

#### For Local Development:

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add the following variables:

```env
# Client-side (for React/Vite)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side (for API routes)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. Replace the placeholder values with your actual credentials
4. **Important**: Add `.env.local` to your `.gitignore` file to keep secrets safe

#### For Production (Vercel/Other Platforms):

1. Go to your deployment platform's environment variables settings
2. Add all the variables listed above
3. Make sure to set both `VITE_*` (client-side) and non-prefixed (server-side) versions

### Step 4: Verify Your Setup

After adding the credentials, restart your development server:

```bash
npm run dev
```

Your Supabase client should now be able to connect to your project!

## Quick Reference

| Variable | Client-side | Server-side | Security |
|----------|-------------|-------------|----------|
| Project URL | `VITE_SUPABASE_URL` | `SUPABASE_URL` | Public |
| Anon Key | `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` | Public (safe) |
| Service Role Key | ❌ Never use | `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Secret |

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the entire key (they're very long)
- Make sure there are no extra spaces or line breaks
- Verify you're using the correct key (anon vs service_role) for the right context

### "Project not found" error
- Verify your Project URL is correct
- Make sure your project is active (not paused) in Supabase dashboard

### Environment variables not loading
- Restart your development server after adding variables
- For Vite projects, make sure client-side variables start with `VITE_`
- Check that `.env.local` is in your project root directory

## Next Steps

After setting up your credentials, you can:
1. Install the Supabase client library: `npm install @supabase/supabase-js`
2. Create a Supabase client instance in your code
3. Start using Supabase features (Database, Auth, Storage, etc.)

For more information, visit: https://supabase.com/docs




