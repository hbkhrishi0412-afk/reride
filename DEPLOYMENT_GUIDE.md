# ReRide Deployment Guide

Complete guide for deploying the ReRide Vehicle Marketplace Platform to production.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Vercel Deployment](#vercel-deployment-recommended)
- [Manual Deployment](#manual-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

Before deploying, ensure all items are completed:

### Code Quality
- [ ] All tests passing (`npm test` and `npm run test:e2e`)
- [ ] No linting errors (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Code formatted (`npm run format:check`)
- [ ] No console.logs in production code
- [ ] No hardcoded secrets or API keys

### Build Verification
- [ ] Production build succeeds (`npm run build`)
- [ ] Build output verified (`npm run preview`)
- [ ] Bundle size within limits (< 1MB per chunk)
- [ ] No build warnings or errors

### Configuration
- [ ] Environment variables documented
- [ ] Production environment variables set
- [ ] Database migrations ready
- [ ] SSL certificate configured
- [ ] Domain DNS configured

### Testing
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Manual testing completed
- [ ] Cross-browser testing done
- [ ] Mobile testing completed

### Documentation
- [ ] README.md updated
- [ ] API documentation complete
- [ ] Deployment guide reviewed
- [ ] Changelog updated

---

## Vercel Deployment (Recommended)

Vercel is the recommended deployment platform for this project.

### Prerequisites

1. **Vercel Account**
   - Sign up at [vercel.com](https://vercel.com)
   - Install Vercel CLI: `npm i -g vercel`

2. **Git Repository**
   - Code pushed to GitHub/GitLab/Bitbucket
   - Main branch ready for deployment

### Step 1: Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your Git repository
4. Select the repository

### Step 2: Configure Project

**Framework Preset:** Vite

**Build Settings:**
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

**Root Directory:** `.` (root)

### Step 3: Environment Variables

Add all required environment variables in Vercel Dashboard:

**Client-side Variables (VITE_*):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SENTRY_DSN=your_sentry_dsn (optional)
```

**Server-side Variables:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_key (optional)
```

**How to Add:**
1. Go to Project Settings → Environment Variables
2. Add each variable
3. Select environments (Production, Preview, Development)
4. Save

### Step 4: Deploy

**Automatic Deployment:**
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment
- Open Pull Request → Preview deployment

**Manual Deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### Step 5: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as instructed
4. Wait for DNS propagation (up to 48 hours)

---

## Manual Deployment

### Option 1: Static Hosting (Frontend Only)

If deploying only the frontend:

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Upload `dist/` folder** to your hosting provider:
   - Netlify
   - GitHub Pages
   - AWS S3 + CloudFront
   - Any static hosting service

3. **Configure redirects:**
   - All routes should redirect to `index.html` (SPA routing)
   - Example `.htaccess` (Apache):
     ```apache
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
     ```

### Option 2: Full Stack Deployment

For full-stack deployment with API:

#### Using Railway

1. **Connect Repository:**
   - Go to [Railway](https://railway.app)
   - New Project → Deploy from GitHub

2. **Configure:**
   - Build Command: `npm run build`
   - Start Command: `npm run preview` (or custom server)

3. **Environment Variables:**
   - Add all required variables
   - Same as Vercel configuration

#### Using AWS

1. **Frontend (S3 + CloudFront):**
   ```bash
   # Build
   npm run build
   
   # Upload to S3
   aws s3 sync dist/ s3://your-bucket-name --delete
   
   # Invalidate CloudFront
   aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
   ```

2. **API (Lambda + API Gateway):**
   - Use Vercel CLI to export: `vercel build`
   - Deploy serverless functions to Lambda
   - Configure API Gateway

#### Using Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   
   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/nginx.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Build and Run:**
   ```bash
   docker build -t reride-app .
   docker run -p 80:80 reride-app
   ```

---

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file or set in hosting platform:

```env
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT (Required)
JWT_SECRET=your_secure_random_secret_here

# Optional
GEMINI_API_KEY=your_gemini_key
VITE_SENTRY_DSN=your_sentry_dsn
NODE_ENV=production
```

### Generating Secure Secrets

**JWT Secret:**
```bash
# Generate random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Save securely:**
- Never commit to Git
- Use environment variable management
- Rotate regularly

---

## Database Setup

### Supabase Database

1. **Create Supabase Project:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Create new project
   - Wait for provisioning (2-3 minutes)

2. **Run Schema Migration:**
   - Go to SQL Editor
   - Open `scripts/complete-supabase-schema.sql`
   - Copy and paste into SQL Editor
   - Click "Run"

3. **Verify Tables:**
   - Go to Table Editor
   - Verify all tables created:
     - `users`
     - `vehicles`
     - `conversations`
     - `notifications`
     - `new_cars`
     - `plans`
     - `service_providers`
     - `service_requests`

4. **Configure Row Level Security (RLS):**
   - RLS is enabled by default
   - Review and adjust policies as needed
   - See `scripts/SUPABASE_SCHEMA_SETUP.md` for details

5. **Set up Storage:**
   - Go to Storage
   - Create bucket: `vehicle-images`
   - Set public access if needed
   - Configure CORS

### Database Backup

**Automatic Backups:**
- Supabase provides automatic daily backups
- Configure in Project Settings → Database → Backups

**Manual Backup:**
```sql
-- Export data (use Supabase CLI or pg_dump)
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Check API health
curl https://your-domain.vercel.app/api/db-health

# Expected response:
{
  "status": "healthy",
  "database": "connected"
}
```

### 2. Frontend Verification

- [ ] Homepage loads correctly
- [ ] No console errors
- [ ] Images load properly
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] Authentication works

### 3. API Verification

```bash
# Test API endpoints
curl https://your-domain.vercel.app/api/vehicles
curl https://your-domain.vercel.app/api/db-health
```

### 4. Database Verification

```bash
# Verify database connection
npm run db:verify

# Or use deployment verification script
npm run verify-deployment
```

### 5. Performance Check

- [ ] Lighthouse score > 90
- [ ] Page load time < 3s
- [ ] API response time < 500ms
- [ ] No 404 errors
- [ ] No 500 errors

### 6. Security Check

- [ ] HTTPS enabled
- [ ] Security headers present
- [ ] No exposed secrets
- [ ] Authentication working
- [ ] CORS configured correctly

---

## Rollback Procedures

### Vercel Rollback

1. **Via Dashboard:**
   - Go to Deployments
   - Find previous successful deployment
   - Click "..." → "Promote to Production"

2. **Via CLI:**
   ```bash
   vercel rollback [deployment-url]
   ```

### Database Rollback

**If migration fails:**
```sql
-- Revert last migration
-- (Keep migration scripts for rollback)

-- Example: Drop added table
DROP TABLE IF EXISTS new_table_name;
```

**Restore from Backup:**
```bash
# Restore database
psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
```

### Code Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force
```

---

## Monitoring & Maintenance

### Error Tracking

**Sentry Setup:**
1. Create Sentry project
2. Add `VITE_SENTRY_DSN` to environment variables
3. Errors automatically tracked

**Monitor:**
- Error rates
- Error types
- User impact
- Performance issues

### Analytics

**Google Analytics:**
1. Create GA4 property
2. Add tracking ID to environment
3. Implement in code (if not already)

**Monitor:**
- Page views
- User behavior
- Conversion rates
- Performance metrics

### Uptime Monitoring

**Services:**
- UptimeRobot (free)
- Pingdom
- StatusCake

**Monitor:**
- API endpoints
- Frontend availability
- Response times

### Performance Monitoring

**Tools:**
- Vercel Analytics (built-in)
- Google PageSpeed Insights
- WebPageTest

**Metrics to Track:**
- Page load time
- API response time
- Error rate
- User sessions

### Regular Maintenance

**Weekly:**
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify backups
- [ ] Update dependencies (if needed)

**Monthly:**
- [ ] Security audit
- [ ] Performance optimization
- [ ] Database optimization
- [ ] Dependency updates

**Quarterly:**
- [ ] Full security review
- [ ] Backup restoration test
- [ ] Disaster recovery drill
- [ ] Documentation update

---

## Troubleshooting

### Deployment Fails

**Check:**
1. Build logs in Vercel dashboard
2. Environment variables set correctly
3. Dependencies installed
4. TypeScript errors

**Common Issues:**
- Missing environment variables
- Build timeout (increase in settings)
- Memory limit exceeded
- TypeScript errors

### API Not Working

**Check:**
1. API routes deployed correctly
2. Environment variables set
3. Database connection
4. CORS configuration

**Debug:**
```bash
# Test API locally
npm run dev:api

# Check logs
vercel logs [deployment-url]
```

### Database Connection Issues

**Check:**
1. Supabase credentials correct
2. Database accessible
3. Network connectivity
4. RLS policies

**Debug:**
```bash
npm run db:diagnose
npm run db:verify
```

### Performance Issues

**Optimize:**
1. Enable CDN caching
2. Optimize images
3. Enable compression
4. Review bundle size

**Tools:**
```bash
npm run build:analyze
npm run perf:analyze
```

---

## Security Checklist

Before going live:

- [ ] All environment variables set
- [ ] No secrets in code
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] Authentication working
- [ ] Authorization tested
- [ ] Error messages don't expose sensitive data

---

## Support

For deployment issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review Vercel/Platform logs
3. Check [README.md](./README.md)
4. Open GitHub issue

---

*Last Updated: 2024*
*Deployment Guide Version: 1.0*


