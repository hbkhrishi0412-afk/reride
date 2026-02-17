# ReRide - Vehicle Marketplace Platform

A modern, full-stack vehicle marketplace platform built with React, TypeScript, and Supabase. Buy and sell quality used vehicles with AI-powered recommendations, certified inspections, and real-time messaging.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)
![React](https://img.shields.io/badge/React-19.2-blue.svg)

## 🚀 Features

- **Vehicle Listings**: Browse, search, and filter vehicles by category, price, location, and more
- **User Management**: Multi-role system (Customer, Seller, Admin, Service Provider)
- **Real-time Chat**: Instant messaging between buyers and sellers
- **AI-Powered Recommendations**: Smart vehicle suggestions based on user preferences
- **Certified Inspections**: Quality assurance for listed vehicles
- **Progressive Web App (PWA)**: Installable app with offline support
- **Mobile Responsive**: Optimized for mobile, tablet, and desktop
- **Advanced Search**: Filter by make, model, price range, location, and more
- **Seller Dashboard**: Manage listings, messages, and analytics
- **Admin Panel**: Platform management and moderation tools
- **Payment Integration**: Subscription plans and payment processing
- **Service Providers**: Connect with mechanics and service centers

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.x or v20.x recommended)
- **npm** (v9.x or later) or **yarn** or **pnpm**
- **Git**
- **Supabase Account** (for database and authentication)
- **Vercel Account** (for deployment, optional)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd reride
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   Then edit `.env.local` with your configuration (see [Environment Setup](#environment-setup))

4. **Set up the database**
   - Follow the instructions in `scripts/SUPABASE_SCHEMA_SETUP.md`
   - Run the SQL script: `scripts/complete-supabase-schema.sql` in your Supabase SQL Editor

5. **Seed the database (optional)**
   ```bash
   npm run seed:all
   ```

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

#### Supabase Configuration (Required)

```env
# Client-side (React app)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Server-side (API routes)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

#### Optional Configuration

```env
# JWT Secret (for custom authentication)
JWT_SECRET=your_jwt_secret_here

# Gemini API Key (for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Sentry DSN (for error tracking)
VITE_SENTRY_DSN=your_sentry_dsn_here
```

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the following:
   - **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

See `env.example` for detailed instructions.

## Development

### Start Development Server

```bash
# Start both frontend and API server
npm run dev

# Or start them separately:
npm run dev:api    # API server on port 3001
# In another terminal:
npm run dev        # Frontend on port 5173
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

### Development Scripts

```bash
# Development
npm run dev              # Start both frontend and API
npm run dev:api          # Start API server only
npm run dev:vercel       # Start with Vercel CLI

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
npm run type-check       # TypeScript type checking

# Testing
npm test                 # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e:debug   # Debug E2E tests

# Database
npm run db:verify        # Verify database connection
npm run db:setup          # Setup database collections
npm run db:diagnose      # Diagnose database issues

# Performance
npm run perf             # Performance optimization
npm run perf:analyze     # Analyze bundle size
npm run build:analyze    # Analyze build output
```

## Building for Production

### Build the Application

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Build Analysis

```bash
npm run build:analyze
```

This generates a visual bundle analysis to help optimize bundle sizes.

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Test Coverage

The project maintains a minimum coverage threshold of 70% for:
- Branches
- Functions
- Lines
- Statements

## Deployment

### Vercel Deployment (Recommended)

1. **Connect your repository to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import your Git repository

2. **Configure Environment Variables**
   - Add all environment variables from `.env.local` to Vercel
   - Ensure both `VITE_*` (client) and server-side variables are set

3. **Deploy**
   - Vercel will automatically deploy on push to main branch
   - Preview deployments are created for pull requests

### Manual Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## Project Structure

```
reride/
├── api/                    # API routes (Vercel serverless functions)
│   └── main.ts            # Main API handler
├── components/             # React components
│   ├── AdminPanel.tsx     # Admin dashboard
│   ├── Dashboard.tsx      # Seller dashboard
│   ├── Home.tsx           # Homepage
│   ├── VehicleList.tsx    # Vehicle listings
│   └── ...
├── e2e/                    # End-to-end tests
│   ├── accessibility.spec.ts
│   ├── auth.spec.ts
│   └── ...
├── __tests__/              # Unit tests
├── services/               # Business logic services
│   ├── supabase-user-service.ts
│   ├── supabase-vehicle-service.ts
│   └── ...
├── server/                  # Server-side utilities
│   └── supabase-admin-db.ts
├── utils/                  # Utility functions
│   ├── security.ts        # Security utilities
│   ├── logger.ts          # Logging utilities
│   └── ...
├── types.ts                # TypeScript type definitions
├── App.tsx                 # Main application component
├── index.tsx               # Application entry point
├── vite.config.ts         # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
└── vercel.json             # Vercel configuration
```

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API documentation.

### Quick API Reference

**Base URL**: `/api`

**Authentication**: Bearer token in `Authorization` header
```
Authorization: Bearer <jwt_token>
```

**Main Endpoints**:
- `GET /api/vehicles` - List vehicles
- `GET /api/vehicles/:id` - Get vehicle details
- `POST /api/vehicles` - Create vehicle listing
- `GET /api/users` - List users (admin only)
- `GET /api/conversations` - Get conversations
- `POST /api/conversations/:id/messages` - Send message

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test` and `npm run test:e2e`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **TypeScript**: Use TypeScript for all new code
- **Linting**: Code must pass ESLint (`npm run lint`)
- **Formatting**: Code must be formatted with Prettier (`npm run format`)
- **Testing**: New features must include tests
- **Documentation**: Update documentation for new features

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Verify database connection
npm run db:verify

# Diagnose connection issues
npm run db:diagnose
```

**Solution**: Ensure Supabase environment variables are correctly set in `.env.local`

#### Port Already in Use

```bash
# Error: Port 5173 is already in use
```

**Solution**: 
- Kill the process using the port
- Or change the port in `vite.config.ts`

#### Build Errors

```bash
# Clean build cache
npm run clean
npm run build
```

#### Test Failures

```bash
# Clear test cache
npm test -- --clearCache

# Run tests with verbose output
npm test -- --verbose
```

### Getting Help

- Check existing issues on GitHub
- Review [CONTRIBUTING.md](./CONTRIBUTING.md)
- See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment issues

## Technology Stack

### Frontend
- **React 19.2** - UI library
- **TypeScript 5.4** - Type safety
- **Vite 5.3** - Build tool
- **Tailwind CSS 3.4** - Styling
- **Framer Motion** - Animations
- **React Router** - Routing (view-based)

### Backend
- **Vercel Serverless Functions** - API routes
- **Supabase** - Database and authentication
- **Express.js** - API middleware
- **Socket.io** - Real-time communication

### Testing
- **Jest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing
- **axe-core** - Accessibility testing

### DevOps
- **GitHub Actions** - CI/CD
- **Vercel** - Hosting and deployment
- **Sentry** - Error tracking (optional)

## Performance

The application is optimized for performance:

- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Images and components loaded on demand
- **Image Optimization**: WebP/AVIF support with lazy loading
- **Bundle Optimization**: Manual chunk splitting for optimal caching
- **Caching**: Service worker for offline support
- **CDN**: Static assets served via CDN

### Performance Metrics

Target metrics:
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.5s
- **Cumulative Layout Shift (CLS)**: < 0.1

## Security

The application implements multiple security layers:

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: All inputs validated and sanitized
- **XSS Protection**: DOMPurify for content sanitization
- **CSRF Protection**: Security headers configured
- **Rate Limiting**: API rate limiting implemented
- **Secret Management**: Environment variables for secrets

See [CONTRIBUTING.md](./CONTRIBUTING.md) for security guidelines.

## License

This project is private and proprietary.

## Support

For support, please:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review existing documentation
3. Open an issue on GitHub (if applicable)

---

**Built with ❤️ by the ReRide Team**



