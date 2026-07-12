import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as core from './shared.js';
import { trackViewBodySchema, loginBodySchema, registerBodySchema } from '../../utils/api-schemas.js';
import { verifyViewTrackToken } from '../../utils/view-track-token.js';

async function handleUsers(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    // FIX: Handle HEAD requests immediately to prevent 405 errors
    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // Public dealer list must not 503 when Supabase is misconfigured (mobile WebView + /dealers).
    if (req.method === 'GET') {
      const pubAction = core.firstQueryParam(req.query.action);
      const pubEmail = core.firstQueryParam(req.query.email);
      const pubRole = core.firstQueryParam(req.query.role);
      if (pubRole === 'seller' && !pubAction && !pubEmail) {
        if (!core.USE_SUPABASE) {
          return res.status(200).json([]);
        }
        try {
          core.logInfo('📊 GET /users?role=seller: Public access - fetching sellers...');
          const sellers = await core.userService.findByRole('seller');
          core.logInfo(`✅ Fetched ${sellers.length} sellers from database`);
          const normalizedSellers = sellers
            .map((user) => {
              const normalized = core.normalizeUser(user);
              if (!normalized) {
                core.logWarn(`⚠️ Seller filtered out during normalization:`, {
                  email: user.email,
                  id: user.id,
                  hasId: !!user.id,
                  hasEmail: !!user.email,
                  hasRole: !!user.role,
                });
              }
              return normalized ? core.toPublicDirectoryUser(normalized) : null;
            })
            .filter((u): u is core.NormalizedUser => u !== null);
          core.logInfo(
            `✅ Returning ${normalizedSellers.length} normalized sellers (${sellers.length - normalizedSellers.length} filtered out)`,
          );
          return res.status(200).json(normalizedSellers);
        } catch (error) {
          core.logError('❌ Error fetching sellers:', error);
          return res.status(200).json([]);
        }
      }
      if (pubRole === 'service_provider' && !pubAction && !pubEmail) {
        if (!core.USE_SUPABASE) {
          return res.status(200).json([]);
        }
        try {
          core.logInfo('📊 GET /users?role=service_provider: Public access - fetching service providers...');
          const providers = await core.userService.findByRole('service_provider');
          core.logInfo(`✅ Fetched ${providers.length} service providers from database`);
          const normalizedProviders = providers
            .map((user) => {
              const normalized = core.normalizeUser(user);
              if (!normalized) {
                core.logWarn(`⚠️ Service provider filtered out during normalization:`, {
                  email: user.email,
                  id: user.id,
                });
              }
              return normalized ? core.toPublicDirectoryUser(normalized) : null;
            })
            .filter((u): u is core.NormalizedUser => u !== null);
          const { enrichPublicServiceProviderUsers } = await import('../../services/provider-trust-stats.js');
          const enrichedProviders = await enrichPublicServiceProviderUsers(normalizedProviders);
          core.logInfo(
            `✅ Returning ${enrichedProviders.length} enriched service providers (${providers.length - normalizedProviders.length} filtered out)`,
          );
          return res.status(200).json(enrichedProviders);
        } catch (error) {
          core.logError('❌ Error fetching service providers:', error);
          return res.status(503).json({
            success: false,
            reason: core.errorToPublicMessage(error),
          });
        }
      }
    }

    // Check Supabase availability (required for vehicles, users, etc.)
    if (!core.USE_SUPABASE) {
      const errorMsg = core.getSupabaseErrorMessage();
      core.logWarn('⚠️ Supabase not available:', errorMsg);
      return res.status(503).json({
        success: false,
        reason: errorMsg,
        details: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Project → Settings → Environment Variables (Production), then redeploy.',
        fallback: true
      });
    }

  // Handle authentication actions (POST with action parameter)
  if (req.method === 'POST') {
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const action = typeof body.action === 'string' ? body.action : undefined;
    const email = typeof body.email === 'string' ? body.email : undefined;
    const password = typeof body.password === 'string' ? body.password : undefined;
    const role = typeof body.role === 'string' ? body.role : undefined;
    const name = typeof body.name === 'string' ? body.name : undefined;
    const mobile = typeof body.mobile === 'string' ? body.mobile : undefined;
    const authProvider = typeof body.authProvider === 'string' ? body.authProvider : undefined;
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined;

    // Validate that action is provided
    if (!action || typeof action !== 'string') {
      core.logWarn('⚠️ POST /api/users: Missing or invalid action field', { body: req.body });
      return res.status(400).json({ 
        success: false, 
        reason: 'Invalid action. Please provide a valid action: login, register, request-password-reset, complete-password-reset, oauth-login, oauth-service-provider, refresh-token, or logout.' 
      });
    }

    if (action === 'logout') {
      core.clearRefreshTokenCookie(res);
      return res.status(200).json({ success: true });
    }

    // USERS-TABLE PASSWORD RESET (public.users bcrypt + optional Resend)
    if (action === 'request-password-reset') {
      try {
        if (!email || !core.validateEmail(String(email).toLowerCase().trim())) {
          return res.status(400).json({ success: false, reason: 'Valid email is required.' });
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        // Same response whether or not the account exists (avoid email enumeration)
        const genericOk = {
          success: true,
          message: 'If an account exists for this email, a reset link was sent.',
        } as const;

        let userRow: Awaited<ReturnType<typeof core.userService.findByEmail>> = null;
        try {
          userRow = await core.userService.findByEmail(normalizedEmail);
        } catch {
          return res.status(200).json(genericOk);
        }
        if (!userRow) {
          return res.status(200).json(genericOk);
        }

        let token: string;
        try {
          token = core.generatePasswordResetToken(normalizedEmail);
        } catch (tokErr) {
          core.logError('Password reset token generation failed:', tokErr);
          return res.status(503).json({
            success: false,
            reason: 'Password reset is temporarily unavailable. Please try again later.',
          });
        }

        const origin = core.getPublicAppOriginForPasswordReset();
        const resetUrl = `${origin}/forgot-password?token=${encodeURIComponent(token)}`;

        try {
          await core.sendPasswordResetEmail(normalizedEmail, resetUrl);
        } catch (sendErr) {
          core.logError('Failed to send password reset email:', sendErr);
          return res.status(503).json({
            success: false,
            reason:
              sendErr instanceof Error
                ? sendErr.message
                : 'Could not send reset email. Try again or contact support.',
          });
        }

        return res.status(200).json(genericOk);
      } catch (pwdResetReqErr) {
        core.logError('request-password-reset error:', pwdResetReqErr);
        return res.status(500).json({ success: false, reason: 'An unexpected error occurred.' });
      }
    }

    if (action === 'complete-password-reset') {
      try {
        const { token: resetToken, password: newPassword } = req.body as {
          token?: string;
          password?: string;
        };
        if (!resetToken || typeof resetToken !== 'string' || !newPassword || typeof newPassword !== 'string') {
          return res.status(400).json({ success: false, reason: 'Token and new password are required.' });
        }
        const passwordValidation = core.validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            reason: 'Password does not meet security requirements.',
            errors: passwordValidation.errors,
          });
        }
        let emailFromToken: string;
        try {
          emailFromToken = core.verifyPasswordResetToken(resetToken.trim()).email;
        } catch {
          return res.status(400).json({
            success: false,
            reason: 'This reset link is invalid or has expired. Request a new one.',
          });
        }
        const userRow = await core.userService.findByEmail(emailFromToken);
        if (!userRow) {
          return res.status(400).json({ success: false, reason: 'No account found for this reset link.' });
        }
        const hashed = await core.hashPassword(newPassword);
        try {
          await core.supabaseUserService.update(emailFromToken, {
            password: hashed,
            updatedAt: new Date().toISOString(),
          });
        } catch (upErr) {
          core.logError('complete-password-reset: DB update failed:', upErr);
          return res.status(500).json({ success: false, reason: 'Could not update password. Try again later.' });
        }
        // Sync Supabase Auth when an auth user exists (same as PUT /users)
        try {
          const supabaseAdmin = core.getSupabaseAdminClient();
          const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError && authUsers?.users?.length) {
            const authUser = authUsers.users.find(
              (u) => (u.email || '').toLowerCase().trim() === emailFromToken,
            );
            if (authUser) {
              const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
                password: newPassword,
              });
              if (authUpdateError) {
                core.logWarn('Supabase Auth password sync after table reset failed:', authUpdateError.message);
              }
            }
          }
        } catch (syncErr) {
          core.logWarn('Supabase Auth sync after table password reset failed:', syncErr);
        }
        return res.status(200).json({ success: true, message: 'Password updated. You can sign in now.' });
      } catch (completeErr) {
        core.logError('complete-password-reset error:', completeErr);
        return res.status(500).json({ success: false, reason: 'An unexpected error occurred.' });
      }
    }

    // LOGIN
    if (action === 'login') {
      try {
      const loginParsed = loginBodySchema.safeParse(req.body);
      if (!loginParsed.success) {
        return res.status(400).json({ success: false, reason: 'Email and password are required.' });
      }
      const loginEmail = loginParsed.data.email;
      const loginPassword = loginParsed.data.password;
      const loginRole = loginParsed.data.role ?? role;

      // Sanitize input
      const sanitizedData = await core.sanitizeObject({
        email: loginEmail,
        password: loginPassword,
        role: loginRole,
      });
      
      // Validate email format
      if (!core.validateEmail(sanitizedData.email)) {
        return res.status(400).json({ success: false, reason: 'Invalid email format.' });
      }
      
      // CRITICAL: Normalize email to lowercase for consistent database lookup
      // This MUST match the normalization used when saving users
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();

      const loginLock = await core.checkLoginAllowed(normalizedEmail);
      if (!loginLock.allowed) {
        return res.status(429).json({
          success: false,
          reason: loginLock.reason || 'Too many login attempts. Please try again later.',
        });
      }
      
      // Use Supabase for user lookup
      let user: core.UserType | null = null;
      
      try {
        // CRITICAL: Use normalized email for lookup (one retry for transient serverless/DB hiccups)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            user = await core.userService.findByEmail(normalizedEmail);
            break;
          } catch (lookupErr) {
            if (attempt === 0) {
              core.logWarn('⚠️ Login user lookup failed (will retry once):', lookupErr);
              await new Promise((r) => setTimeout(r, 120));
              continue;
            }
            throw lookupErr;
          }
        }
        // If user not found, log for debugging (but don't reveal to user for security)
        if (!user) {
          core.logWarn('⚠️ Login attempt - user not found:', {
            normalizedEmail,
            emailFormat: sanitizedData.email,
            role: sanitizedData.role
          });
        }
      } catch (error) {
        core.logError('❌ Supabase user lookup error:', error);
        return res.status(503).json({
          success: false,
          reason: 'Account lookup is temporarily unavailable. Please try again in a moment.',
          fallback: true,
        });
      }

      if (!user) {
        // Opt-in local dev bootstrap — requires ALLOW_TEST_USER_BOOTSTRAP=true and TEST_BOOTSTRAP_PASSWORD in .env
        const allowTestUserBootstrap =
          process.env.ALLOW_TEST_USER_BOOTSTRAP === 'true' &&
          process.env.NODE_ENV === 'development' &&
          String(process.env.VERCEL || '') !== '1';
        const bootstrapPassword = process.env.TEST_BOOTSTRAP_PASSWORD?.trim();

        if (allowTestUserBootstrap && bootstrapPassword) {
          const testUsers = {
            'admin@test.com': {
              name: 'Admin User',
              mobile: '9876543210',
              location: 'Mumbai, Maharashtra',
              role: 'admin' as const,
              status: 'active' as const,
              isVerified: true,
              subscriptionPlan: 'premium' as const,
              featuredCredits: 100,
            },
            'seller@test.com': {
              name: 'Prestige Motors',
              mobile: '+91-98765-43210',
              location: 'Delhi, NCR',
              role: 'seller' as const,
              status: 'active' as const,
              isVerified: true,
              subscriptionPlan: 'premium' as const,
              featuredCredits: 5,
              usedCertifications: 1,
              dealershipName: 'Prestige Motors',
              bio: 'Specializing in luxury and performance electric vehicles since 2020.',
              logoUrl: 'https://i.pravatar.cc/100?u=seller',
              avatarUrl: 'https://i.pravatar.cc/150?u=seller@test.com',
            },
            'customer@test.com': {
              name: 'Test Customer',
              mobile: '9876543212',
              location: 'Bangalore, Karnataka',
              role: 'customer' as const,
              status: 'active' as const,
              isVerified: false,
              subscriptionPlan: 'free' as const,
              featuredCredits: 0,
              avatarUrl: 'https://i.pravatar.cc/150?u=customer@test.com',
            }
          };

          const testUserConfig = testUsers[normalizedEmail as keyof typeof testUsers];
          
          if (testUserConfig && sanitizedData.role === testUserConfig.role) {
          try {
            core.logInfo(`⚠️ ${testUserConfig.role} user not found, auto-creating ${normalizedEmail}...`);
            
            // Check Supabase availability before creating
            if (!core.USE_SUPABASE) {
              core.logError('❌ Cannot auto-create user: Supabase not available');
              throw new Error('Supabase database is not available');
            }
            
            const hashedPassword = await core.hashPassword(bootstrapPassword);
            const newUser = await core.userService.create({
              email: normalizedEmail,
              ...testUserConfig,
              password: hashedPassword,
              authProvider: 'email',
              createdAt: new Date().toISOString()
            });
            user = newUser;
            core.logInfo(`✅ ${testUserConfig.role} user auto-created successfully`, {
              email: newUser.email,
              id: newUser.id,
              role: newUser.role
            });
          } catch (createError) {
            core.logError(`❌ Failed to auto-create ${testUserConfig.role} user:`, createError);
            // Log detailed error for debugging
            const errorDetails = createError instanceof Error 
              ? { message: createError.message, stack: createError.stack }
              : createError;
            core.logError('Auto-create error details:', errorDetails);
            // Fall through to return error
          }
          }
        }
        
        if (!user) {
          const { resolveDevMockUser } = await import('./dev-mock-users.js');
          const devMock = resolveDevMockUser(normalizedEmail, sanitizedData.password, sanitizedData.role);
          if (devMock) {
            user = devMock;
            core.logInfo('✅ Dev mock login user resolved:', { email: normalizedEmail, role: devMock.role });
          }
        }

        if (!user) {
          await core.recordFailedLogin(normalizedEmail);
          // Don't reveal whether email exists or not (security best practice)
          return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
        }
      }
      
      const isDevMockLogin =
        process.env.NODE_ENV === 'development' &&
        String(process.env.VERCEL || '') !== '1' &&
        (user.email === 'admin@test.com' ||
          user.email === 'seller@test.com' ||
          user.email === 'customer@test.com') &&
        sanitizedData.password === 'password';

      // OAuth/phone users without a password must use their original sign-in method.
      // Never allow setting a password via the email/password login form (account takeover risk).
      if (!isDevMockLogin && !user.password) {
        await core.recordFailedLogin(normalizedEmail);
        const provider = String(user.authProvider || 'email').toLowerCase();
        const methodHint =
          provider === 'google'
            ? 'Google'
            : provider === 'phone'
              ? 'phone OTP'
              : 'your original sign-in method';
        return res.status(401).json({
          success: false,
          reason:
            provider !== 'email'
              ? `This account uses ${methodHint} to sign in. Please use that method instead of email and password.`
              : 'No password set for this account. Please use "Forgot password" or your original sign-in method.',
        });
      }
      
      // Verify password using bcrypt (wrap to avoid 500 on invalid hash/corrupt data)
      let isPasswordValid = isDevMockLogin;
      if (!isDevMockLogin) {
        try {
          isPasswordValid = user.password
            ? await core.validatePassword(sanitizedData.password, user.password)
            : false;
        } catch (pwErr) {
          core.logWarn('⚠️ Password validation error (treating as invalid):', pwErr);
        }
      }

      if (
        !isPasswordValid &&
        user.password &&
        typeof user.password === 'string' &&
        !/^\$2[abxy]\$/.test(user.password)
      ) {
        core.logWarn('⚠️ Login rejected: account has non-bcrypt password storage — user must reset password:', {
          email: normalizedEmail,
        });
      }

      if (!isPasswordValid) {
        // SECURITY: Log minimal details - don't expose password hash prefixes
        if (process.env.NODE_ENV !== 'production') {
          core.logWarn('⚠️ Password validation failed:', {
            email: normalizedEmail,
            hasPassword: !!user.password,
            authProvider: user.authProvider,
            passwordIsHashed: user.password?.startsWith('$2') || false
          });
        }
        
        await core.recordFailedLogin(normalizedEmail);
        return res.status(401).json({ success: false, reason: 'Invalid credentials.' });
      }
      // Service providers should only login through the service provider login page
      if (core.normalizeUserRoleString(user.role) === 'seller') {
        try {
          const serviceProvider = await core.supabaseServiceProviderService.findByEmail(normalizedEmail);
          if (serviceProvider) {
            // User is a service provider - they must use the service provider login page
            core.logWarn('⚠️ Service provider attempted regular login:', {
              email: normalizedEmail,
              requestedRole: sanitizedData.role
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Service providers must login through the Service Provider login page.',
              isServiceProvider: true
            });
          }
        } catch (spError) {
          // If service provider lookup fails, log but don't block login
          // This ensures regular sellers can still login even if service provider service has issues
          core.logWarn('⚠️ Error checking service provider status:', spError);
        }
      }
      
      if (sanitizedData.role && !core.userRolesEqual(user.role, sanitizedData.role)) {
        return res.status(403).json({ success: false, reason: `User is not a registered ${sanitizedData.role}.` });
      }
      if (user.status === 'inactive') {
        return res.status(403).json({ success: false, reason: 'Your account has been deactivated.' });
      }

      // Ensure JWT_SECRET is set before generating tokens (prevents 500 in production)
      const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
      if (isProduction && !process.env.JWT_SECRET) {
        core.logError('❌ JWT_SECRET is not set in production - cannot issue tokens');
        return res.status(503).json({
          success: false,
          reason: 'Server configuration error. Please try again later.',
          error: 'JWT_SECRET is not configured.'
        });
      }

      // Generate JWT tokens (wrap in try/catch so core.config/jwt errors return 503, not 500)
      let accessToken: string;
      let refreshToken: string;
      try {
        accessToken = core.generateAccessToken(user);
        refreshToken = core.generateRefreshToken(user);
      } catch (tokenError) {
        const msg = tokenError instanceof Error ? tokenError.message : 'Token generation failed';
        core.logError('❌ Login token generation failed:', tokenError);
        return res.status(503).json({
          success: false,
          reason: 'Server configuration error. Please try again later.',
          error: msg.includes('JWT') || msg.includes('secret') ? 'JWT not configured.' : 'Token error'
        });
      }

      // Normalize user object for frontend (ensure role is present)
      let normalizedUser = core.normalizeUser(user);
      if (!normalizedUser || !normalizedUser.role) {
        core.logWarn('⚠️ Normalize returned null/invalid, building fallback from raw user:', {
          email: user.email,
          hasRole: !!user.role,
          id: user.id
        });
        const fallbackId = user.id || normalizedEmail.replace(/[.#$[\]]/g, '_');
        const fallbackEmail = (user.email && String(user.email).trim()) || normalizedEmail;
        const fallbackRole =
          user.role && ['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(user.role)
            ? (user.role as 'customer' | 'seller' | 'admin' | 'service_provider' | 'finance_partner')
            : 'customer';
        normalizedUser = {
          id: fallbackId,
          email: fallbackEmail.toLowerCase().trim(),
          role: fallbackRole,
          name: user.name || '',
          mobile: user.mobile || '',
          status: (user.status || 'active') as 'active' | 'inactive',
          createdAt: user.createdAt || new Date().toISOString(),
          isVerified: user.isVerified ?? false,
          subscriptionPlan: (user.subscriptionPlan || 'free') as 'free' | 'pro' | 'premium',
          featuredCredits: user.featuredCredits ?? 0,
          usedCertifications: user.usedCertifications ?? 0,
          location: user.location || '',
          authProvider: (user.authProvider || 'email') as 'email' | 'google' | 'phone',
          hasPassword: !!(user.password && String(user.password).trim()),
        };
      }

      if (!normalizedUser) {
        return res.status(500).json({ success: false, reason: 'Failed to normalize user account' });
      }

      // Validate role matches requested role (critical for seller dashboard access)
      if (sanitizedData.role && !core.userRolesEqual(normalizedUser.role, sanitizedData.role)) {
        core.logWarn('⚠️ Role mismatch in login response:', {
          userRole: normalizedUser.role,
          requestedRole: sanitizedData.role,
          email: normalizedUser.email
        });
        // Don't fail the login, but log the warning
        // The frontend will handle role validation
      }

      // Ensure email is present (critical for seller dashboard)
      if (!normalizedUser.email) {
        normalizedUser = { ...normalizedUser, email: normalizedEmail };
      }
      
      core.logInfo('✅ Login successful:', { 
        email: normalizedUser.email, 
        role: normalizedUser.role,
        userId: normalizedUser.id
      });

      core.clearLoginLockout(normalizedEmail);

      const rtMax = core.refreshCookieMaxAgeSeconds();
      if (!core.isCapacitorAppClient(req)) {
        core.appendRefreshTokenCookie(res, refreshToken, rtMax);
        const includeRefreshInBody = process.env.NODE_ENV !== 'production';
        return res.status(200).json({
          success: true,
          user: normalizedUser,
          accessToken,
          ...(includeRefreshInBody ? { refreshToken } : {}),
        });
      }

      return res.status(200).json({
        success: true,
        user: normalizedUser,
        accessToken,
        refreshToken,
      });
      } catch (loginError) {
        core.logError('❌ Login handler error:', loginError);
        const message = loginError instanceof Error ? loginError.message : 'Unknown error';
        return res.status(500).json({
          success: false,
          reason: 'Server error. Please try again later.',
          ...(process.env.NODE_ENV !== 'production' && { hint: message })
        });
      }
    }

    // REGISTER
    if (action === 'register') {
      const registerParsed = registerBodySchema.safeParse({ name, email, password, mobile, role });
      if (!registerParsed.success) {
        return res.status(400).json({
          success: false,
          reason: 'Validation failed',
          errors: registerParsed.error.flatten().fieldErrors,
        });
      }
      const reg = registerParsed.data;

      // Sanitize and validate input data
      const sanitizedData = await core.sanitizeObject({
        email: reg.email,
        password: reg.password,
        name: reg.name,
        mobile: reg.mobile,
        role: reg.role,
      });
      
      // SECURITY: Block admin role self-registration (defense in depth beyond Zod)
      if (String(sanitizedData.role || '').toLowerCase() === 'admin') {
        return res.status(403).json({ 
          success: false, 
          reason: 'Admin accounts cannot be created through public registration. Admin accounts must be provisioned internally.' 
        });
      }
      
      const validation = await core.validateUserInput(sanitizedData);
      
      if (!validation.isValid) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Validation failed', 
          errors: validation.errors 
        });
      }

      // Normalize email to lowercase for consistent duplicate checking
      // This MUST match the normalization used when saving (line 294)
      const normalizedEmail = sanitizedData.email.toLowerCase().trim();

      try {
        // Check if user already exists
        let existingUser: core.UserType | null = null;
        
        try {
          existingUser = await core.userService.findByEmail(normalizedEmail);
        } catch (error) {
          core.logError('❌ Supabase user lookup error:', error);
          return res.status(500).json({ success: false, reason: 'Database error. Please try again.' });
        }
        
        if (existingUser) {
          core.logWarn('⚠️ Registration attempt with existing email:', normalizedEmail);
          return res.status(400).json({ success: false, reason: 'User already exists.' });
        }

        // Hash password before storing
        const hashedPassword = await core.hashPassword(sanitizedData.password);
        // Never log password hashing status or user emails in production
        if (process.env.NODE_ENV !== 'production') {
          core.logInfo('🔐 Password hashed successfully for user:', normalizedEmail);
        }

        // CRITICAL FIX: Don't generate userId - supabase-user-service will use emailKey as id
        // This ensures consistent id format matching the Supabase key

        const userData: Omit<core.UserType, 'id'> = {
          email: normalizedEmail,
          password: hashedPassword,
          name: sanitizedData.name,
          mobile: sanitizedData.mobile,
          role: sanitizedData.role,
          location: '', // Default empty location, can be updated later
          authProvider: 'email', // CRITICAL: Set authProvider for email/password users
          status: 'active' as const,
          isVerified: false,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };

        let newUser: core.UserType;
        
        try {
          core.logInfo('💾 Attempting to save user to Supabase...');
          newUser = await core.userService.create(userData);
          core.logInfo('✅ New user registered and saved to Supabase:', normalizedEmail);
          
          // CRITICAL FIX: Add retry logic and better error handling
          let verifyUser = await core.userService.findByEmail(normalizedEmail);
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!verifyUser && retryCount < maxRetries) {
            core.logWarn(`⚠️ User not found after save, retrying... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            verifyUser = await core.userService.findByEmail(normalizedEmail);
            retryCount++;
          }
          
          if (!verifyUser) {
            // CRITICAL FIX: Check if user was actually created (might be a race condition)
            // Try one more time to find the user, and if found, use it
            // This prevents returning error when user was actually created
            const finalCheck = await core.userService.findByEmail(normalizedEmail);
            if (finalCheck) {
              core.logWarn('⚠️ User found on final check - race condition resolved');
              newUser = finalCheck;
            } else {
              core.logError('❌ User registration verification failed - user not found after save and retries');
              // CRITICAL: Check if user might have been created but verification is failing
              // In this case, we should still try to proceed if newUser was set from create()
              if (newUser && newUser.email === normalizedEmail) {
                core.logWarn('⚠️ Using user from create() despite verification failure - user may exist');
                // Continue with newUser from create() - verification might be a timing issue
              } else {
                return res.status(500).json({ 
                  success: false, 
                  reason: 'User registration failed - user was not saved to database. Please try again.' 
                });
              }
            }
          } else {
            core.logInfo('✅ User registration verified in database. User ID:', verifyUser.id);
            newUser = verifyUser;
          }
        } catch (error) {
          core.logError('❌ Error saving user to Supabase:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // CRITICAL FIX: Check for specific Supabase errors
          if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            core.logError('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production environment!');
            return res.status(500).json({ 
              success: false, 
              reason: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
                      'Please configure this environment variable in your production deployment (Vercel). ' +
                      'This is required for user registration to work.',
              error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
            });
          }
          
          if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED') || 
              errorMessage.includes('row-level security') || errorMessage.includes('RLS Policy')) {
            core.logError('❌ RLS Policy Error - User creation blocked by Row Level Security');
            return res.status(500).json({ 
              success: false, 
              reason: 'Database permission error: Row Level Security (RLS) is blocking user creation. ' +
                      'Either add an INSERT policy for the users table or ensure SUPABASE_SERVICE_ROLE_KEY is configured.',
              error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
            });
          }
          
          if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
            return res.status(400).json({ 
              success: false, 
              reason: 'User with this email already exists.' 
            });
          }
          
          // Log full error details in non-production for debugging
          if (process.env.NODE_ENV !== 'production') {
            core.logError('❌ Full error details:', {
              message: errorMessage,
              stack: error instanceof Error ? error.stack : undefined,
              error
            });
          }
          
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to save user to database. Please try again.',
            error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
          });
        }
      
        // Generate JWT tokens for new user
        const accessToken = core.generateAccessToken(newUser);
        const refreshToken = core.generateRefreshToken(newUser);
        
        if (!newUser || !newUser.role) {
          core.logError('❌ Failed to normalize new user object:', { email: userData.email, hasRole: !!userData.role });
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process user data. Please try again.' 
          });
        }
        
        core.logInfo('✅ Registration complete. User ID:', newUser.id);
        const normalizedNewUser = core.normalizeUser(newUser);
        if (!normalizedNewUser) {
          return res.status(500).json({
            success: false,
            reason: 'Failed to process user data. Please try again.',
          });
        }
        const rtMaxReg = core.refreshCookieMaxAgeSeconds();
        if (!core.isCapacitorAppClient(req)) {
          core.appendRefreshTokenCookie(res, refreshToken, rtMaxReg);
          return res.status(201).json({
            success: true,
            user: normalizedNewUser,
            accessToken,
          });
        }
        return res.status(201).json({
          success: true,
          user: normalizedNewUser,
          accessToken,
          refreshToken,
        });
      } catch (saveError) {
        core.logError('❌ Error saving user to Supabase:', saveError);
        const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
        
        // Check for duplicate key error (email already exists)
        if (saveError instanceof Error && 
            (errorMessage.includes('already exists') || 
             errorMessage.includes('duplicate'))) {
          return res.status(400).json({ 
            success: false, 
            reason: 'User with this email already exists.' 
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to save user to database. Please try again.',
          error: errorMessage
        });
      }
    }

    // OAUTH LOGIN
    if (action === 'oauth-login') {
      if (!name || !role) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      let supabaseUserRecord: { id: string; email?: string | null; phone?: string | null };
      try {
        const verified = await core.verifySupabaseToken(req.headers.authorization);
        supabaseUserRecord = {
          id: verified.uid,
          email: verified.user?.email ?? null,
          phone: verified.user?.phone ?? null,
        };
      } catch {
        return res.status(401).json({
          success: false,
          reason: 'Valid Supabase session required. Sign in again, then retry.',
        });
      }

      const bodyUid = String(req.body.firebaseUid ?? req.body.uid ?? '').trim();
      if (!bodyUid || bodyUid !== supabaseUserRecord.id) {
        return res.status(403).json({
          success: false,
          reason: 'Session does not match this account.',
        });
      }

      const tokenEmail = (supabaseUserRecord.email || '').toLowerCase().trim();
      const bodyEmail = String(email || '').toLowerCase().trim();
      const derivedPhoneEmail =
        !tokenEmail && supabaseUserRecord.phone
          ? `${String(supabaseUserRecord.phone).replace(/\D/g, '')}@phone.reride.co.in`.toLowerCase()
          : '';

      if (tokenEmail && bodyEmail && tokenEmail !== bodyEmail) {
        return res.status(403).json({
          success: false,
          reason: 'Email does not match signed-in account.',
        });
      }
      if (derivedPhoneEmail && bodyEmail && derivedPhoneEmail !== bodyEmail) {
        return res.status(403).json({
          success: false,
          reason: 'Account identity does not match signed-in session.',
        });
      }

      const normalizedEmail = tokenEmail || derivedPhoneEmail || bodyEmail;
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      // Sanitize OAuth data (email comes from verified session + rules above)
      const sanitizedData = await core.sanitizeObject({
        email: normalizedEmail,
        name,
        role,
        authProvider,
        avatarUrl,
      });
      const mobile = req.body.mobile || '';
      const location = req.body.location || '';

      // SECURITY: Block admin role in OAuth registration - admin accounts must be created internally
      if (sanitizedData.role === 'admin') {
        return res.status(403).json({ 
          success: false, 
          reason: 'Admin accounts cannot be created via OAuth. Admin accounts must be provisioned internally.' 
        });
      }
      
      // Validate role is one of allowed OAuth roles
      const allowedOauthRoles = ['customer', 'seller'] as const;
      if (!allowedOauthRoles.includes(sanitizedData.role as typeof allowedOauthRoles[number])) {
        return res.status(400).json({ 
          success: false, 
          reason: `Invalid role for OAuth registration. Allowed roles: ${allowedOauthRoles.join(', ')}` 
        });
      }
      let user = await core.userService.findByEmail(normalizedEmail);
      
      if (!user) {
        core.logInfo('🔄 OAuth registration - Creating new user:', normalizedEmail);
        const userData: Omit<core.UserType, 'id'> = {
          email: normalizedEmail,
          name: sanitizedData.name,
          mobile,
          location,
          role: sanitizedData.role,
          // REMOVED: firebaseUid - not used in Supabase
          authProvider: sanitizedData.authProvider,
          avatarUrl: sanitizedData.avatarUrl,
          status: 'active' as const,
          isVerified: true,
          subscriptionPlan: 'free' as const,
          featuredCredits: 0,
          usedCertifications: 0,
          createdAt: new Date().toISOString()
        };
        
        core.logInfo('💾 Saving OAuth user to Supabase...');
        user = await core.userService.create(userData);
        core.logInfo('✅ OAuth user saved to Supabase:', normalizedEmail);
        
        // CRITICAL FIX: Add retry logic for OAuth user verification
        let verifyUser = await core.userService.findByEmail(normalizedEmail);
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!verifyUser && retryCount < maxRetries) {
          core.logWarn(`⚠️ OAuth user not found after save, retrying... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          verifyUser = await core.userService.findByEmail(normalizedEmail);
          retryCount++;
        }
        
        if (!verifyUser) {
          // CRITICAL FIX: Check if user was actually created (might be a race condition)
          // Try one more time to find the user, and if found, use it
          const finalCheck = await core.userService.findByEmail(normalizedEmail);
          if (finalCheck) {
            core.logWarn('⚠️ OAuth user found on final check - race condition resolved');
            user = finalCheck;
          } else {
            core.logError('❌ OAuth user registration verification failed - user not found after save and retries');
            // CRITICAL: Check if user might have been created but verification is failing
            // In this case, we should still try to proceed if user was set from create()
            if (user && user.email === normalizedEmail) {
              core.logWarn('⚠️ Using OAuth user from create() despite verification failure - user may exist');
              // Continue with user from create() - verification might be a timing issue
            } else {
              return res.status(500).json({ 
                success: false, 
                reason: 'OAuth registration failed - user was not saved to database. Please try again.' 
              });
            }
          }
        } else {
          core.logInfo('✅ OAuth user registration verified in database. User ID:', verifyUser.id);
          // Use the verified user to ensure we have the latest data
          user = verifyUser;
        }
      } else {
        core.logInfo('✅ OAuth login - Existing user found:', sanitizedData.email);
      }

      // Generate JWT tokens for OAuth users
      const accessToken = core.generateAccessToken(user);
      const refreshToken = core.generateRefreshToken(user);

      // Normalize user object for frontend (ensure role is present)
      const normalizedUser = core.normalizeUser(user);
      
      if (!normalizedUser || !normalizedUser.role) {
        core.logError('❌ Failed to normalize OAuth user object:', { email: user.email, hasRole: !!user.role });
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to process user data. Please try again.' 
        });
      }
      
      const rtMaxOAuth = core.refreshCookieMaxAgeSeconds();
      if (!core.isCapacitorAppClient(req)) {
        core.appendRefreshTokenCookie(res, refreshToken, rtMaxOAuth);
        return res.status(200).json({
          success: true,
          user: normalizedUser,
          accessToken,
        });
      }
      return res.status(200).json({
        success: true,
        user: normalizedUser,
        accessToken,
        refreshToken,
      });
    }

    // GOOGLE (OR SUPABASE) OAUTH — SERVICE PROVIDER PROFILE
    if (action === 'oauth-service-provider') {
      let supabaseUserRecord: { id: string; email?: string | null; phone?: string | null };
      try {
        const verified = await core.verifySupabaseToken(req.headers.authorization);
        supabaseUserRecord = {
          id: verified.uid,
          email: verified.user?.email ?? null,
          phone: verified.user?.phone ?? null,
        };
      } catch {
        return res.status(401).json({
          success: false,
          reason: 'Valid Supabase session required. Sign in again, then retry.',
        });
      }

      const bodyUid = String(req.body.firebaseUid ?? req.body.uid ?? '').trim();
      if (!bodyUid || bodyUid !== supabaseUserRecord.id) {
        return res.status(403).json({
          success: false,
          reason: 'Session does not match this account.',
        });
      }

      const tokenEmail = (supabaseUserRecord.email || '').toLowerCase().trim();
      const bodyEmail = String(req.body.email || '').toLowerCase().trim();
      const derivedPhoneEmail =
        !tokenEmail && supabaseUserRecord.phone
          ? `${String(supabaseUserRecord.phone).replace(/\D/g, '')}@phone.reride.co.in`.toLowerCase()
          : '';

      if (tokenEmail && bodyEmail && tokenEmail !== bodyEmail) {
        return res.status(403).json({
          success: false,
          reason: 'Email does not match signed-in account.',
        });
      }
      if (derivedPhoneEmail && bodyEmail && derivedPhoneEmail !== bodyEmail) {
        return res.status(403).json({
          success: false,
          reason: 'Account identity does not match signed-in session.',
        });
      }

      const normalizedEmail = tokenEmail || derivedPhoneEmail || bodyEmail;
      if (!normalizedEmail) {
        return res.status(400).json({ success: false, reason: 'OAuth data incomplete.' });
      }

      const rawName = String(req.body.name || '').trim();
      const name =
        rawName ||
        (normalizedEmail.includes('@') ? normalizedEmail.split('@')[0] : normalizedEmail) ||
        'Service provider';

      let provider = await core.supabaseServiceProviderService.findById(supabaseUserRecord.id);
      if (!provider) {
        const byEmail = await core.supabaseServiceProviderService.findByEmail(normalizedEmail);
        if (byEmail && byEmail.id !== supabaseUserRecord.id) {
          return res.status(409).json({
            success: false,
            reason:
              'This email is already linked to another service provider account. Sign in the way you registered, or contact support.',
          });
        }
        provider = byEmail;
      }

      if (!provider) {
        try {
          await core.supabaseServiceProviderService.create({
            id: supabaseUserRecord.id,
            name,
            email: normalizedEmail,
            phone: '0000000000',
            city: '',
            workshops: [],
            skills: [],
            availability: 'weekdays',
          });
        } catch (createErr) {
          core.logError('❌ oauth-service-provider create failed:', createErr);
          return res.status(500).json({
            success: false,
            reason: 'Could not create service provider profile. Please try again or contact support.',
          });
        }
        provider = await core.supabaseServiceProviderService.findById(supabaseUserRecord.id);
      }

      if (!provider) {
        return res.status(500).json({
          success: false,
          reason: 'Service provider profile could not be loaded after sign-in.',
        });
      }

      try {
        const existingUser = await core.supabaseUserService.findByEmail(normalizedEmail);
        if (!existingUser) {
          await core.supabaseUserService.create({
            name,
            email: normalizedEmail,
            mobile: provider.phone || '0000000000',
            role: 'service_provider',
            location: provider.city && provider.city.toLowerCase() !== 'pending setup' ? provider.city : '',
            status: 'active',
            authProvider: 'google',
            firebaseUid: supabaseUserRecord.id,
            createdAt: new Date().toISOString(),
          });
        } else {
          await core.supabaseUserService.update(normalizedEmail, {
            name,
            mobile: existingUser.mobile || provider.phone || undefined,
            role: 'service_provider',
            authProvider: 'google',
            firebaseUid: supabaseUserRecord.id,
          });
        }
      } catch (userSyncErr) {
        core.logWarn('⚠️ Service provider users table sync failed (non-fatal):', userSyncErr);
      }

      const out = { ...provider, uid: provider.id };
      return res.status(200).json({
        success: true,
        provider: out,
      });
    }

    // TOKEN REFRESH (with rotation + revocation)
    if (action === 'refresh-token') {
      const incomingRefreshToken = core.getRefreshTokenFromRequest(req);

      if (!incomingRefreshToken) {
        core.logWarn('⚠️ Refresh token request missing token');
        return res.status(400).json({
          success: false,
          reason: 'Refresh token is required.',
          error: 'No refresh token in body or cookie',
        });
      }

      try {
        core.logInfo('🔄 Refreshing access token...');

        // Peek at the jti without fully trusting the payload yet.
        const preVerify = core.verifyToken(incomingRefreshToken);
        if (preVerify.type !== 'refresh') {
          throw new Error('Invalid token type');
        }
        if (await core.isRefreshTokenRevoked(preVerify.jti)) {
          // A revoked refresh token being reused is a strong signal of theft/replay.
          core.logSecurity('🚨 Revoked refresh token reuse attempt', {
            userId: preVerify.userId,
            email: preVerify.email,
            jti: preVerify.jti,
          });
          core.clearRefreshTokenCookie(res);
          return res.status(401).json({
            success: false,
            reason: 'Refresh token has been revoked. Please log in again.',
            error: 'refresh_token_revoked',
          });
        }

        const rotated = core.rotateRefreshToken(incomingRefreshToken);
        // Immediately revoke the old jti so it cannot be used again even if it leaked.
        await core.revokeRefreshToken(rotated.oldJti, rotated.oldTtlSeconds);

        core.logInfo('✅ Access token refreshed + rotated successfully');
        const rtMaxRot = core.refreshCookieMaxAgeSeconds();
        if (!core.isCapacitorAppClient(req)) {
          core.appendRefreshTokenCookie(res, rotated.refreshToken, rtMaxRot);
          return res.status(200).json({
            success: true,
            accessToken: rotated.accessToken,
          });
        }
        return res.status(200).json({
          success: true,
          accessToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        core.logWarn('❌ Refresh token failed:', errorMessage);
        core.clearRefreshTokenCookie(res);
        return res.status(401).json({
          success: false,
          reason: 'Invalid or expired refresh token. Please log in again.',
          error: errorMessage,
        });
      }
    }

    // REQUEST DATA DELETION (DPDP / Right to be Forgotten)
    if (action === 'request-data-deletion') {
      const auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user?.email) {
        return res.status(401).json({ success: false, reason: 'Authentication required to delete your account.' });
      }
      try {
        const normalizedEmail = auth.user.email.toLowerCase().trim();
        const existingUser = await core.userService.findByEmail(normalizedEmail);
        if (!existingUser) {
          return res.status(404).json({ success: false, reason: 'User not found.' });
        }
        await core.userService.delete(normalizedEmail);
        try {
          const supabaseAdmin = core.getSupabaseAdminClient();
          const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError) {
            const authUser = authUsers.users.find(
              (u) => u.email?.toLowerCase().trim() === normalizedEmail,
            );
            if (authUser) {
              await supabaseAdmin.auth.admin.deleteUser(authUser.id);
            }
          }
        } catch (authDeleteError) {
          core.logWarn('⚠️ request-data-deletion: auth user cleanup failed:', authDeleteError);
        }
        return res.status(200).json({
          success: true,
          message: 'Your account has been permanently deleted.',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        core.logError('request-data-deletion error:', msg);
        return res.status(500).json({ success: false, reason: msg });
      }
    }

    // Native app push token (FCM / APNs via Capacitor) — requires `push_device_tokens` table (see scripts/add-push-device-tokens.sql).
    if (action === 'save-push-token') {
      const auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user?.email) {
        return res.status(401).json({ success: false, reason: 'Authentication required.' });
      }
      const token = (req.body as { token?: string })?.token;
      const platform = (req.body as { platform?: string })?.platform;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, reason: 'token is required' });
      }
      try {
        const supabase = core.getSupabaseAdminClient();
        const user_email = auth.user.email.toLowerCase().trim();
        const { error } = await supabase.from('push_device_tokens').upsert(
          {
            user_email,
            token: token.trim(),
            platform: platform ? String(platform) : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_email' },
        );
        if (error) {
          core.logWarn('save-push-token:', error.message);
          return res.status(503).json({
            success: false,
            reason:
              'Push token storage is not available. Create table push_device_tokens (see scripts/add-push-device-tokens.sql).',
          });
        }
        return res.status(200).json({ success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({ success: false, reason: msg });
      }
    }

    // PWA Web Push subscription (VAPID) — requires `web_push_subscriptions` table (see scripts/add-web-push-subscriptions.sql).
    if (action === 'save-web-push-subscription') {
      const auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user?.email) {
        return res.status(401).json({ success: false, reason: 'Authentication required.' });
      }
      const subscription = (req.body as { subscription?: Record<string, unknown> })?.subscription;
      const endpoint =
        subscription && typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
      if (!endpoint) {
        return res.status(400).json({ success: false, reason: 'subscription.endpoint is required' });
      }
      try {
        const supabase = core.getSupabaseAdminClient();
        const user_email = auth.user.email.toLowerCase().trim();
        const { error } = await supabase.from('web_push_subscriptions').upsert(
          {
            endpoint,
            user_email,
            subscription,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' },
        );
        if (error) {
          core.logWarn('save-web-push-subscription:', error.message);
          return res.status(503).json({
            success: false,
            reason:
              'Web push storage is not available. Create table web_push_subscriptions (see scripts/add-web-push-subscriptions.sql).',
          });
        }
        return res.status(200).json({ success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return res.status(500).json({ success: false, reason: msg });
      }
    }

    // KARIX OTP - Send OTP via Karix SMS
    if (action === 'send-otp-karix') {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Phone number is required.' 
        });
      }

      try {
        // Import Karix service dynamically to avoid module load errors if not configured
        const { sendKarixOTP, getKarixConfig } = await import('../../services/karixService.js');
        const karixConfig = getKarixConfig();
        
        if (!karixConfig) {
          return res.status(503).json({ 
            success: false, 
            reason: 'Karix SMS service is not configured. Please set KARIX_API_KEY and KARIX_API_SECRET environment variables.' 
          });
        }

        // Format phone number (E.164 format)
        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        // Generate 6-digit OTP (crypto; max is exclusive)
        const otp = core.randomInt(100_000, 1_000_000).toString();
        
        // Store OTP in Supabase database with expiration (10 minutes)
        const supabase = core.getSupabaseAdminClient();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
        
        // Hash OTP for storage (use simple hash for now, or use crypto for better security)
        const crypto = await import('crypto');
        const jwtSecret = core.getSecurityConfig().JWT.SECRET;
        if (!jwtSecret) {
          return res.status(503).json({ success: false, reason: 'Server configuration error. Please try again later.' });
        }
        const otpHash = crypto.createHash('sha256').update(otp + jwtSecret).digest('hex');
        
        // Store OTP in a temporary table (create if doesn't exist)
        // Using Supabase's admin client to insert into a table
        const { error: storeError } = await supabase
          .from('otp_verifications')
          .upsert({
            phone: cleanedNumber,
            otp_hash: otpHash,
            expires_at: expiresAt,
            attempt_count: 0,
            locked_until: null,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'phone'
          });

        // If table doesn't exist, we'll handle it gracefully
        if (storeError && !storeError.message.includes('relation') && !storeError.message.includes('does not exist')) {
          core.logWarn('⚠️ Could not store OTP in database (table may not exist):', storeError.message);
          // Continue anyway - we can verify OTP from the hash
        }

        // Send OTP via Karix
        const karixResult = await sendKarixOTP(cleanedNumber, otp, karixConfig);
        
        if (!karixResult.success) {
          core.logError('❌ Karix SMS send failed:', karixResult.error);
          return res.status(500).json({ 
            success: false, 
            reason: karixResult.error || 'Failed to send OTP via Karix' 
          });
        }
        
        core.logInfo('✅ OTP sent via Karix to:', cleanedNumber);
        return res.status(200).json({ 
          success: true, 
          message: 'OTP sent successfully',
          phone: cleanedNumber,
          // Don't return OTP in production - only for testing
          ...(process.env.NODE_ENV !== 'production' ? { otp } : {})
        });
      } catch (error: any) {
        core.logError('❌ Karix OTP send error:', error);
        return res.status(500).json({ 
          success: false, 
          reason: error.message || 'Failed to send OTP' 
        });
      }
    }

    // KARIX OTP - Verify OTP (uses Supabase verification)
    if (action === 'verify-otp-karix') {
      const { phoneNumber, otp } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ 
          success: false, 
          reason: 'Phone number and OTP are required.' 
        });
      }

      try {
        const supabase = core.getSupabaseAdminClient();
        
        // Format phone number
        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        // Verify OTP using Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          phone: cleanedNumber,
          token: otp,
          type: 'sms',
        });

        if (error) {
          core.logError('❌ OTP verification failed:', error.message);
          return res.status(400).json({ 
            success: false, 
            reason: error.message || 'Invalid OTP' 
          });
        }

        if (!data.user) {
          return res.status(400).json({ 
            success: false, 
            reason: 'OTP verification failed' 
          });
        }

        // Get or create user in our database
        const userEmail = data.user.email || `${cleanedNumber.replace('+', '')}@phone.reride.co.in`;
        let user = await core.userService.findByEmail(userEmail);
        
        if (!user) {
          // Create user from phone auth
          const userData: Omit<core.UserType, 'id'> = {
            email: userEmail,
            name: `User ${cleanedNumber}`,
            mobile: cleanedNumber,
            role: req.body.role || 'customer',
            location: '', // Required field, can be updated later
            authProvider: 'phone',
            status: 'active' as const,
            isVerified: true,
            subscriptionPlan: 'free' as const,
            featuredCredits: 0,
            usedCertifications: 0,
            createdAt: new Date().toISOString()
          };
          user = await core.userService.create(userData);
        }

        // Generate JWT tokens
        const accessToken = core.generateAccessToken(user);
        const refreshToken = core.generateRefreshToken(user);
        const normalizedUser = core.normalizeUser(user);

        const rtMaxPhone = core.refreshCookieMaxAgeSeconds();
        if (!core.isCapacitorAppClient(req)) {
          core.appendRefreshTokenCookie(res, refreshToken, rtMaxPhone);
          return res.status(200).json({
            success: true,
            user: normalizedUser,
            accessToken,
          });
        }
        return res.status(200).json({
          success: true,
          user: normalizedUser,
          accessToken,
          refreshToken,
        });
      } catch (error: any) {
        core.logError('❌ OTP verification error:', error);
        return res.status(500).json({ 
          success: false, 
          reason: error.message || 'Failed to verify OTP' 
        });
      }
    }

    // MESSAGEBOT OTP — send via MessageBot SMS API, verify against hashed row in otp_verifications
    if (action === 'send-otp-messagebot') {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          reason: 'Phone number is required.',
        });
      }

      try {
        const { sendMessageBotOTP, getMessageBotConfig } = await import('../../services/messagebotService.js');
        const mbConfig = getMessageBotConfig();

        if (!mbConfig) {
          return res.status(503).json({
            success: false,
            reason:
              'MessageBot SMS is not configured. Set MESSAGEBOT_API_TOKEN and MESSAGEBOT_SENDER_ID (and DLT IDs for India).',
          });
        }

        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        const otp = core.randomInt(100_000, 1_000_000).toString();

        const supabase = core.getSupabaseAdminClient();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const nodeCrypto = await import('crypto');
        const jwtSecret = core.getSecurityConfig().JWT.SECRET;
        if (!jwtSecret) {
          return res.status(503).json({ success: false, reason: 'Server configuration error. Please try again later.' });
        }
        const otpHash = nodeCrypto.createHash('sha256').update(otp + jwtSecret).digest('hex');

        const { error: storeError } = await supabase
          .from('otp_verifications')
          .upsert(
            {
              phone: cleanedNumber,
              otp_hash: otpHash,
              expires_at: expiresAt,
              attempt_count: 0,
              locked_until: null,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'phone' },
          );

        if (storeError && !storeError.message.includes('relation') && !storeError.message.includes('does not exist')) {
          core.logWarn('⚠️ Could not store OTP in database:', storeError.message);
        }

        const mbResult = await sendMessageBotOTP(cleanedNumber, otp, mbConfig);

        if (!mbResult.success) {
          core.logError('❌ MessageBot SMS send failed:', mbResult.error);
          return res.status(500).json({
            success: false,
            reason: mbResult.error || 'Failed to send OTP via MessageBot',
          });
        }

        core.logInfo('✅ OTP sent via MessageBot to:', cleanedNumber);
        return res.status(200).json({
          success: true,
          message: 'OTP sent successfully',
          phone: cleanedNumber,
          ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to send OTP';
        core.logError('❌ MessageBot OTP send error:', error);
        return res.status(500).json({ success: false, reason: msg });
      }
    }

    if (action === 'verify-otp-messagebot') {
      const { phoneNumber, otp } = req.body;
      const requestedRole = (req.body.role as string) || 'customer';

      if (!phoneNumber || !otp) {
        return res.status(400).json({
          success: false,
          reason: 'Phone number and OTP are required.',
        });
      }

      if (requestedRole !== 'customer' && requestedRole !== 'seller') {
        return res.status(400).json({
          success: false,
          reason: 'Invalid role for phone OTP login.',
        });
      }

      try {
        const supabase = core.getSupabaseAdminClient();

        let cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        if (!cleanedNumber.startsWith('+')) {
          cleanedNumber = cleanedNumber.replace(/^(0|91)/, '');
          cleanedNumber = `+91${cleanedNumber}`;
        }

        const crypto = await import('crypto');
        const jwtSecret = core.getSecurityConfig().JWT.SECRET;
        if (!jwtSecret) {
          return res.status(503).json({ success: false, reason: 'Server configuration error.' });
        }

        const { data: row, error: fetchError } = await supabase
          .from('otp_verifications')
          .select('otp_hash, expires_at, attempt_count, locked_until')
          .eq('phone', cleanedNumber)
          .maybeSingle();

        if (fetchError || !row) {
          return res.status(400).json({
            success: false,
            reason: 'No OTP found for this number. Please request a new code.',
          });
        }

        const lockedUntil = row.locked_until ? new Date(String(row.locked_until)) : null;
        if (lockedUntil && lockedUntil.getTime() > Date.now()) {
          return res.status(429).json({
            success: false,
            reason: 'Too many failed attempts. Please request a new code in a few minutes.',
          });
        }

        const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          await supabase.from('otp_verifications').delete().eq('phone', cleanedNumber);
          return res.status(400).json({
            success: false,
            reason: 'OTP has expired. Please request a new code.',
          });
        }

        const expectedHash = crypto.createHash('sha256').update(String(otp) + jwtSecret).digest('hex');
        if (expectedHash !== row.otp_hash) {
          const priorAttempts = typeof row.attempt_count === 'number' ? row.attempt_count : 0;
          const nextAttempts = priorAttempts + 1;
          const maxAttempts = 5;
          const lockoutMs = 30 * 60 * 1000;
          const updatePayload: Record<string, unknown> = { attempt_count: nextAttempts };
          if (nextAttempts >= maxAttempts) {
            updatePayload.locked_until = new Date(Date.now() + lockoutMs).toISOString();
          }
          await supabase.from('otp_verifications').update(updatePayload).eq('phone', cleanedNumber);
          return res.status(400).json({
            success: false,
            reason:
              nextAttempts >= maxAttempts
                ? 'Too many failed attempts. Please request a new code.'
                : 'Invalid OTP. Please try again.',
          });
        }

        await supabase.from('otp_verifications').delete().eq('phone', cleanedNumber);

        const userEmail = `${cleanedNumber.replace('+', '')}@phone.reride.co.in`;
        let user = await core.userService.findByEmail(userEmail);

        if (!user) {
          const userData: Omit<core.UserType, 'id'> = {
            email: userEmail,
            name: `User ${cleanedNumber}`,
            mobile: cleanedNumber,
            role: requestedRole as 'customer' | 'seller',
            location: '',
            authProvider: 'phone',
            status: 'active' as const,
            isVerified: true,
            subscriptionPlan: 'free' as const,
            featuredCredits: 0,
            usedCertifications: 0,
            createdAt: new Date().toISOString(),
          };
          user = await core.userService.create(userData);
        } else if (user.role !== requestedRole) {
          return res.status(400).json({
            success: false,
            reason: `This number is registered as a ${user.role}. Please choose the correct account type.`,
            detectedRole: user.role,
          });
        }

        const accessToken = core.generateAccessToken(user);
        const refreshToken = core.generateRefreshToken(user);
        const normalizedUser = core.normalizeUser(user);

        const rtMaxMb = core.refreshCookieMaxAgeSeconds();
        if (!core.isCapacitorAppClient(req)) {
          core.appendRefreshTokenCookie(res, refreshToken, rtMaxMb);
          return res.status(200).json({
            success: true,
            user: normalizedUser,
            accessToken,
          });
        }
        return res.status(200).json({
          success: true,
          user: normalizedUser,
          accessToken,
          refreshToken,
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to verify OTP';
        core.logError('❌ MessageBot OTP verify error:', error);
        return res.status(500).json({ success: false, reason: msg });
      }
    }

    core.logWarn('⚠️ POST /api/users: Invalid action received', { action, bodyKeys: Object.keys(req.body || {}) });
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid action: "${action}". Please use one of: login, register, request-password-reset, complete-password-reset, oauth-login, oauth-service-provider, or refresh-token.` 
    });
  }

  // HEAD - Handle browser pre-flight checks
  if (req.method === 'HEAD') {
    // Return 200 OK with no body, same headers as GET would have
    return res.status(200).end();
  }

  // GET - Get users (authenticated)
  if (req.method === 'GET') {
    const action = core.firstQueryParam(req.query.action);
    const email = core.firstQueryParam(req.query.email);
    const role = core.firstQueryParam(req.query.role);
    
    // PUBLIC ACCESS: /users?role=seller is handled at the top of this handler (before Supabase gate).
    
    // For non-admin requests without auth, return empty array instead of 401
    // This prevents console errors when users aren't logged in
    const authResult = await core.authenticateRequestDual(req);
    if (!authResult.isValid) {
      // If no auth and not requesting specific action, return empty array gracefully
      if (!action && !email) {
        // Only log in development to avoid information leakage
        if (process.env.NODE_ENV !== 'production') {
          core.logInfo('📊 GET /users: No authentication, returning empty array');
        }
        return res.status(200).json([]);
      }
      // For specific actions (like trust-score), still require auth
      const auth = await core.requireAuth(req, res, 'GET /users');
      if (!auth) {
        return;
      }
    } else {
      // Auth is valid, continue with normal flow
      const auth = await core.requireAuth(req, res, 'GET /users');
      if (!auth) {
        return;
      }
    }
    
    // Get auth user for the rest of the handler
    const auth = await core.requireAuth(req, res, 'GET /users');
    if (!auth || !auth.user) {
      // This shouldn't happen if we got here, but handle it gracefully
      return res.status(200).json([]);
    }
    const authUser = auth.user;

    if (action === 'trust-score' && email) {
      try {
        // Sanitize and normalize email
        const sanitizedEmail = await core.sanitizeString(String(email));
        const normalizedEmail = sanitizedEmail.toLowerCase().trim();
        const normalizedAuthEmail = authUser?.email ? authUser.email.toLowerCase().trim() : '';

        if (authUser?.role !== 'admin' && normalizedAuthEmail !== normalizedEmail) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to trust score.' });
        }

        const user = await core.userService.findByEmail(normalizedEmail);
        if (!user) {
          return res.status(404).json({ success: false, reason: 'User not found' });
        }
        
        const trustScore = calculateTrustScore(user);
        return res.status(200).json({ 
          success: true, 
          trustScore,
          email: user.email,
          name: user.name
        });
      } catch (error) {
        core.logError('Error fetching trust score:', error);
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to fetch trust score',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    if (email) {
      try {
        const normalizedEmail = String(email).toLowerCase().trim();
        const normalizedAuthEmail = authUser?.email ? String(authUser.email).toLowerCase().trim() : '';

        // Non-admin users can only fetch their own profile.
        if (authUser?.role !== 'admin' && normalizedAuthEmail !== normalizedEmail) {
          return res.status(403).json({ success: false, reason: 'Forbidden. You can only access your own user record.' });
        }

        const one = await core.userService.findByEmail(normalizedEmail);
        if (!one) {
          return res.status(404).json({ success: false, reason: 'User not found.' });
        }
        const normalized = core.normalizeUser(one);
        if (!normalized) {
          return res.status(404).json({ success: false, reason: 'User not found.' });
        }
        return res.status(200).json(normalized);
      } catch (error) {
        core.logError('❌ Error fetching single user by email:', error);
        return res.status(500).json({
          success: false,
          reason: 'Failed to fetch user profile.',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (authUser?.role !== 'admin') {
      // Non-admin list requests are expected from some dashboard/bootstrap flows.
      // Return an empty list instead of 403 to avoid noisy client-side error spam.
      return res.status(200).json([]);
    }
    
    try {
      core.logInfo('📊 GET /api/users: Admin request - Fetching all users from Supabase...');
      core.logInfo('📊 Admin user details:', { 
        email: authUser.email, 
        role: authUser.role, 
        id: authUser.userId 
      });
      
      // Check Supabase availability
      if (!core.USE_SUPABASE) {
        const errorMsg = core.getSupabaseErrorMessage();
        core.logError('❌ Supabase not available for user fetch:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: []
        });
      }
      
      // CRITICAL: Check if SUPABASE_SERVICE_ROLE_KEY is configured
      // This is required for admin operations to bypass RLS
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey || 
          serviceRoleKey.trim() === '' ||
          serviceRoleKey.includes('your_supabase_service_role_key')) {
        const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
                        'This is required for fetching users in the admin panel. ' +
                        'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables (Production). ' +
                        'Get the key from Supabase Dashboard → Settings → API → service_role key. ' +
                        'IMPORTANT: After adding the key, you must redeploy your application for it to take effect.';
        core.logError('❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing for user fetch:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Service role key is required to bypass RLS policies and fetch users'
        });
      }
      
      // Verify key format (should be a JWT token, typically 100+ characters)
      if (serviceRoleKey.length < 50) {
        core.logWarn('⚠️ SUPABASE_SERVICE_ROLE_KEY seems too short. Expected 100+ characters. Current length:', serviceRoleKey.length);
        core.logWarn('   This might indicate the key was not copied completely.');
      }
      
      core.logInfo('✅ SUPABASE_SERVICE_ROLE_KEY is configured (length: ' + serviceRoleKey.length + ' characters)');
      
      core.logInfo('✅ SUPABASE_SERVICE_ROLE_KEY is configured, proceeding with user fetch...');
      
      // Test the service role key by attempting to create admin client
      try {
        core.getSupabaseAdminClient();
        core.logInfo('✅ Supabase admin client created successfully');
      } catch (clientError: any) {
        const clientErrorMessage = clientError instanceof Error ? clientError.message : String(clientError);
        core.logError('❌ Failed to create Supabase admin client:', clientErrorMessage);
        return res.status(503).json({
          success: false,
          reason: `Failed to initialize Supabase admin client: ${clientErrorMessage}. ` +
                  'This might indicate the SUPABASE_SERVICE_ROLE_KEY is invalid or malformed. ' +
                  'Please verify the key is correct in Vercel environment variables.',
          users: [],
          diagnostic: 'Service role key validation failed during client initialization'
        });
      }
      
      // CRITICAL: Add direct database query test before using service
      core.logInfo('🔍 Testing direct database query with admin client...');
      try {
        const testClient = core.getSupabaseAdminClient();
        const { data: testData, error: testError, count: testCount } = await testClient
          .from('users')
          .select('*', { count: 'exact', head: false })
          .limit(1);
        
        if (testError) {
          core.logError('❌ Direct query test failed:', {
            message: testError.message,
            details: testError.details,
            hint: testError.hint,
            code: testError.code
          });
        } else {
          core.logInfo(`✅ Direct query test: Found ${testCount || 0} users in database`);
          if (testData && testData.length > 0) {
            core.logInfo('📊 Sample row from direct query:', {
              hasId: !!testData[0].id,
              id: testData[0].id,
              hasEmail: !!testData[0].email,
              email: testData[0].email,
              hasRole: !!testData[0].role,
              role: testData[0].role,
              rowKeys: Object.keys(testData[0])
            });
          }
        }
      } catch (testErr) {
        core.logError('❌ Direct query test exception:', testErr);
      }
      
      const users = await core.userService.findAll();
      core.logInfo(`✅ Fetched ${users.length} raw users from Supabase database via core.userService`);
      
      if (users.length === 0) {
        core.logWarn('⚠️ Supabase returned 0 users. This might indicate:');
        core.logWarn('   1. No users exist in the database');
        core.logWarn('   2. RLS (Row Level Security) policies are blocking access (even with service role key)');
        core.logWarn('   3. Database connection issue');
        core.logWarn('   4. Table name mismatch (expected: "users")');
        core.logWarn('   5. Service role key might not have proper permissions');
        core.logWarn('   6. SUPABASE_SERVICE_ROLE_KEY might not be configured in Vercel environment variables');
        core.logWarn('   7. Users might be getting filtered out during conversion');
        
        // CRITICAL: Try a raw count query to verify users exist
        try {
          const countClient = core.getSupabaseAdminClient();
          const { count, error: countError } = await countClient
            .from('users')
            .select('*', { count: 'exact', head: true });
          
          if (countError) {
            core.logError('❌ Count query error:', countError);
          } else {
            core.logInfo(`📊 Raw count query result: ${count || 0} users in database`);
            if (count && count > 0) {
              core.logWarn('⚠️ Users exist in database but core.userService.findAll() returned 0!');
              core.logWarn('   This suggests an issue with the core.userService.findAll() method or data conversion.');
            }
          }
        } catch (countErr) {
          core.logError('❌ Count query exception:', countErr);
        }
        
        // Return a warning but still return empty array (not an error)
        return res.status(200).json([]);
      }
      
      // CRITICAL FIX: Log user data structure for debugging
      if (users.length > 0) {
        const sampleUser = users[0];
        core.logInfo('📊 Sample user structure:', {
          hasId: !!sampleUser.id,
          idType: typeof sampleUser.id,
          idValue: sampleUser.id,
          hasEmail: !!sampleUser.email,
          email: sampleUser.email,
          hasRole: !!sampleUser.role,
          role: sampleUser.role,
          keys: Object.keys(sampleUser)
        });
      }
      
      // SECURITY FIX: Normalize all users to remove passwords
      // CRITICAL FIX: Don't filter out users - fix them instead
      const normalizedUsers = users.map(user => {
        // CRITICAL FIX: If user doesn't have an id, try to generate one from email
        if (!user.id && user.email) {
          const emailKey = user.email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
          core.logWarn(`⚠️ User missing id, generating from email:`, { email: user.email, generatedId: emailKey });
          user.id = emailKey;
        }
        
        const normalized = core.normalizeUser(user);
        if (!normalized) {
          core.logWarn(`⚠️ User filtered out during normalization:`, { 
            email: user.email, 
            id: user.id, 
            hasId: !!user.id, 
            hasEmail: !!user.email,
            hasRole: !!user.role,
            roleValue: user.role,
            fullUser: JSON.stringify(user).substring(0, 200) // First 200 chars for debugging
          });
        }
        return normalized;
      }).filter((u): u is core.NormalizedUser => u !== null);
      
      const filteredCount = users.length - normalizedUsers.length;
      if (filteredCount > 0) {
        core.logWarn(`⚠️ ${filteredCount} users were filtered out during normalization`);
        core.logWarn(`   Original count: ${users.length}, Normalized count: ${normalizedUsers.length}`);
      }
      
      core.logInfo(`✅ Returning ${normalizedUsers.length} normalized users to admin panel (from ${users.length} raw users)`);
      return res.status(200).json(normalizedUsers);
    } catch (error) {
      core.logError('❌ Error fetching users from Supabase:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Check for service role key errors specifically
      if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        const errorMsg = 'SUPABASE_SERVICE_ROLE_KEY is not configured or invalid. ' +
                        'This is required for fetching users in the admin panel. ' +
                        'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables (Production). ' +
                        'Get the key from Supabase Dashboard → Settings → API → service_role key. ' +
                        'After setting, redeploy your application.';
        core.logError('❌ CRITICAL: Service role key error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Service role key is required to bypass RLS policies and fetch users',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      // Check for RLS policy errors
      if (errorMessage.includes('permission denied') || 
          errorMessage.includes('row-level security') || 
          errorMessage.includes('RLS') ||
          errorMessage.includes('42501')) {
        const errorMsg = 'Row Level Security (RLS) policy is blocking access to users table. ' +
                        'Even with service role key, RLS policies might be misconfigured. ' +
                        'Check your Supabase RLS policies for the users table. ' +
                        'Service role key should bypass RLS, but verify the key is correct.';
        core.logError('❌ RLS Policy Error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'RLS policy blocking access - verify service role key and RLS policies',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      // Check for database connection errors
      if (errorMessage.includes('connection') || 
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          errorMessage.includes('ECONNREFUSED')) {
        const errorMsg = 'Database connection error. Unable to connect to Supabase. ' +
                        'Please check your SUPABASE_URL and network connectivity.';
        core.logError('❌ Database Connection Error:', errorMsg);
        return res.status(503).json({
          success: false,
          reason: errorMsg,
          users: [],
          diagnostic: 'Database connection failed - check SUPABASE_URL and network',
          error: process.env.NODE_ENV !== 'production' ? errorMessage : undefined
        });
      }
      
      core.logError('❌ Error details:', { 
        message: errorMessage, 
        stack: errorStack,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      // Return error details in development, but still return empty array to prevent crashes
      const isDevelopment = process.env.NODE_ENV !== 'production';
      if (isDevelopment) {
        return res.status(500).json({
          success: false,
          reason: `Failed to fetch users: ${errorMessage}`,
          error: errorMessage,
          users: [],
          debug: {
            stack: errorStack,
            supabaseAvailable: core.USE_SUPABASE
          }
        });
      }
      
      // In production, return empty array gracefully but log the error
      res.setHeader('X-Data-Fallback', 'true');
      res.setHeader('X-Error', 'true');
      return res.status(200).json([]);
    }
  }

  // PUT - Update user
  if (req.method === 'PUT') {
    // SECURITY FIX: Verify Auth
    const auth = await core.authenticateRequestDual(req);
    if (!auth.isValid) {
      core.logWarn('⚠️ PUT /users - Authentication failed:', auth.error);
      return res.status(401).json({ 
        success: false, 
        reason: auth.error || 'Authentication failed. Please log in again.',
        error: 'Invalid or expired authentication token'
      });
    }
    try {
      // Supabase connection is handled automatically
      const { email, ...updateData } = req.body;

      // Non-admins cannot self-elevate or mutate privileged fields
      if (auth.user?.role !== 'admin') {
        const privilegedKeys = [
          'role',
          'status',
          'isVerified',
          'subscriptionPlan',
          'featuredCredits',
          'usedCertifications',
          'trustScore',
          'authProvider',
          'firebaseUid',
          'phoneVerified',
          'emailVerified',
          'govtIdVerified',
          'id',
        ] as const;
        for (const key of privilegedKeys) {
          if (key in updateData) {
            delete (updateData as Record<string, unknown>)[key];
          }
        }
      }
      
      // SECURITY FIX: Authorization Check
      // Only allow updates if user is admin or updating their own profile
      // Normalize emails for comparison (critical for production)
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      const normalizedRequestEmail = email ? String(email).toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedAuthEmail !== normalizedRequestEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You can only update your own profile.' });
      }
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for update.' });
      }

      // Only log in development to avoid information leakage
      core.logInfo('🔄 PUT /users - Updating user:', { email, hasPassword: !!updateData.password, fields: Object.keys(updateData) });

      // Separate null values (to be unset) from regular updates
      const updateFields: Record<string, unknown> = {};
      const unsetFields: Record<string, unknown> = {};
      
      // Handle password update separately - it needs to be hashed
      // CRITICAL: Store plain text password before hashing for Supabase Auth sync
      let plainTextPassword: string | null = null;
      
      if (updateData.password !== undefined && updateData.password !== null) {
        try {
          // Validate password is a string
          if (typeof updateData.password !== 'string' || updateData.password.trim().length === 0) {
            return res.status(400).json({ 
              success: false, 
              reason: 'Password must be a non-empty string.' 
            });
          }

          // Check if password is already hashed (bcrypt hashes start with $2)
          // If not hashed, hash it before updating
          const isAlreadyHashed = updateData.password.startsWith('$2');

          if (isAlreadyHashed) {
            if (process.env.NODE_ENV === 'production') {
              return res.status(400).json({
                success: false,
                reason: 'Invalid password format. Submit a plain-text password.',
              });
            }
            // Dev-only backward compatibility for pre-hashed payloads
            updateFields.password = updateData.password;
            // Only log in development to avoid information leakage
            if (process.env.NODE_ENV !== 'production') {
              core.logInfo('🔐 Password already hashed, using as-is');
            }
            // Cannot sync to Supabase Auth if password is already hashed
            plainTextPassword = null;
          } else {
            // Store plain text password for Supabase Auth sync (before hashing)
            plainTextPassword = updateData.password;
            
            // Hash the plain text password before updating users table
            // Only log in development to avoid information leakage
            if (process.env.NODE_ENV !== 'production') {
              core.logInfo('🔐 Hashing password...');
            }
            updateFields.password = await core.hashPassword(updateData.password);
            // Never log password hashing success in production
            if (process.env.NODE_ENV !== 'production') {
              core.logInfo('✅ Password hashed successfully');
            }
          }
        } catch (hashError) {
          // Only log errors in development to avoid information leakage
          if (process.env.NODE_ENV !== 'production') {
            core.logError('❌ Error hashing password:', hashError);
          }
          const errorMessage = hashError instanceof Error ? hashError.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: 'Failed to process password update. Please try again.',
            error: errorMessage
          });
        }
      }
      
      // Process other fields
      Object.keys(updateData).forEach(key => {
        // Skip password as it's already handled above
        if (key === 'password') {
          return;
        }
        
        if (updateData[key] === null) {
          unsetFields[key] = '';
        } else if (updateData[key] !== undefined) {
          updateFields[key] = updateData[key];
        }
      });

      const MAX_NOTIFICATION_MUTE_KEYS = 200;
      const MAX_NOTIFICATION_MUTE_KEY_LEN = 200;
      if (updateFields.notificationMuteKeys !== undefined) {
        const raw = updateFields.notificationMuteKeys;
        if (!Array.isArray(raw)) {
          delete updateFields.notificationMuteKeys;
        } else {
          updateFields.notificationMuteKeys = raw
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.slice(0, MAX_NOTIFICATION_MUTE_KEY_LEN))
            .slice(0, MAX_NOTIFICATION_MUTE_KEYS);
        }
      }
      
      // CRITICAL: Sync verificationStatus with individual verification fields
      // If verificationStatus is being updated, also update individual fields
      if (updateFields.verificationStatus && typeof updateFields.verificationStatus === 'object') {
        const verificationStatus = updateFields.verificationStatus as Record<string, unknown>;
        
        // Sync phoneVerified
        if (verificationStatus.phoneVerified !== undefined && typeof verificationStatus.phoneVerified === 'boolean') {
          updateFields.phoneVerified = verificationStatus.phoneVerified;
        }
        
        // Sync emailVerified
        if (verificationStatus.emailVerified !== undefined && typeof verificationStatus.emailVerified === 'boolean') {
          updateFields.emailVerified = verificationStatus.emailVerified;
        }
        
        // Sync govtIdVerified
        if (verificationStatus.govtIdVerified !== undefined && typeof verificationStatus.govtIdVerified === 'boolean') {
          updateFields.govtIdVerified = verificationStatus.govtIdVerified;
        }
      }
      
      // Also sync in reverse: if individual fields are updated, update verificationStatus
      if (!updateFields.verificationStatus) {
        updateFields.verificationStatus = {} as Partial<core.VerificationStatus>;
      }
      
      const verificationStatus = updateFields.verificationStatus as Partial<core.VerificationStatus>;
      if (updateFields.phoneVerified !== undefined && updateFields.phoneVerified !== null && typeof updateFields.phoneVerified === 'boolean') {
        verificationStatus.phoneVerified = updateFields.phoneVerified;
      }
      if (updateFields.emailVerified !== undefined && updateFields.emailVerified !== null && typeof updateFields.emailVerified === 'boolean') {
        verificationStatus.emailVerified = updateFields.emailVerified;
      }
      if (updateFields.govtIdVerified !== undefined && updateFields.govtIdVerified !== null && typeof updateFields.govtIdVerified === 'boolean') {
        verificationStatus.govtIdVerified = updateFields.govtIdVerified;
      }

      // Build update object for Supabase
      const supabaseUpdates: Record<string, unknown> = {};
      
      // Add fields to update
      Object.keys(updateFields).forEach(key => {
        supabaseUpdates[key] = updateFields[key];
      });
      
      // For unset fields, set to null (Supabase will handle null values)
      Object.keys(unsetFields).forEach(key => {
        supabaseUpdates[key] = null;
      });

      // Only proceed with update if there are fields to update
      if (Object.keys(supabaseUpdates).length === 0) {
        return res.status(400).json({ success: false, reason: 'No fields to update.' });
      }

      core.logInfo('💾 Updating user in Supabase...', { 
        email, 
        hasPasswordUpdate: !!updateFields.password,
        updateFields: Object.keys(supabaseUpdates)
      });

      // Sanitize and normalize email
      const sanitizedEmail = await core.sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      
      let existingUser: core.UserType | null;
      try {
        existingUser = await core.userService.findByEmail(normalizedEmail);
      } catch (findError) {
        core.logError('❌ Error finding user:', findError);
        const errorMessage = findError instanceof Error ? findError.message : 'Unknown error';
        return res.status(500).json({ 
          success: false, 
          reason: `Database error while finding user: ${errorMessage}`,
          error: 'Database connection error'
        });
      }
      
      if (!existingUser) {
        core.logWarn('⚠️ User not found:', email);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      core.logInfo('📝 Found user, applying update operation...');
      
      // Update user in Supabase
      try {
        await core.userService.update(normalizedEmail, supabaseUpdates);
        core.logInfo('✅ User update operation completed in Supabase');
        
        // Fetch updated user
        let updatedUser: core.UserType | null;
        try {
          updatedUser = await core.userService.findByEmail(normalizedEmail);
        } catch (fetchError) {
          core.logError('❌ Error fetching updated user:', fetchError);
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: `Database error while fetching updated user: ${errorMessage}`,
            error: 'Database connection error'
          });
        }
        
        if (!updatedUser) {
          core.logError('❌ Failed to fetch updated user after update');
          return res.status(500).json({ 
            success: false, 
            reason: 'User update completed but failed to verify. Please refresh and try again.',
            error: 'Verification error'
          });
        }

        core.logInfo('✅ User updated successfully:', updatedUser.email);

        // CRITICAL FIX: Sync password update with Supabase Auth
        // When password is updated in users table, also update Supabase Auth password
        // This must be done BEFORE updating the users table to ensure both are in sync
        if (plainTextPassword) {
          try {
            const supabaseAdmin = core.getSupabaseAdminClient();
            
            // Get the user's auth ID from Supabase Auth by email
            // Use listUsers with pagination to find the user efficiently
            const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            
            if (listError) {
              core.logWarn('⚠️ Could not list auth users to sync password:', listError.message);
            } else {
              // Find the auth user by email (case-insensitive)
              const authUser = authUsers.users.find(u => 
                u.email?.toLowerCase().trim() === normalizedEmail
              );
              
              if (authUser) {
                // Update password in Supabase Auth (use plain text password)
                // Supabase Auth will hash it with its own algorithm
                const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
                  authUser.id,
                  { password: plainTextPassword }
                );
                
                if (authUpdateError) {
                  core.logWarn('⚠️ Failed to update Supabase Auth password:', authUpdateError.message);
                  // Don't fail the entire update - users table password was updated successfully
                } else {
                  core.logInfo('✅ Password synced to Supabase Auth successfully');
                }
              } else {
                core.logWarn('⚠️ Auth user not found for email (user may not have Supabase Auth account):', normalizedEmail);
                // This is OK - user might only exist in users table (legacy users)
              }
            }
          } catch (authSyncError) {
            core.logWarn('⚠️ Error syncing password to Supabase Auth:', authSyncError);
            // Don't fail the entire update - users table password was updated successfully
          }
        } else if (updateFields.password) {
          core.logWarn('⚠️ Password was updated but plain text not available for Supabase Auth sync (password was already hashed)');
        }

        // SYNC VEHICLE EXPIRY DATES when planExpiryDate is updated
        if (updateFields.planExpiryDate !== undefined || unsetFields.planExpiryDate !== undefined) {
          try {
            const normalizedEmail = email.toLowerCase().trim();
            const newPlanExpiryDate = updateFields.planExpiryDate || null;
            
            // PERFORMANCE FIX: Use findBySellerEmail instead of fetching all vehicles
            // This uses the idx_vehicles_seller_email index for fast lookup
            const allSellerVehicles = await core.vehicleService.findBySellerEmail(normalizedEmail);
            const sellerVehicles = allSellerVehicles.filter(v => v.status === 'published');
            
            if (sellerVehicles.length > 0) {
              const now = new Date();
              
              for (const vehicle of sellerVehicles) {
                const vehicleUpdateFields: Record<string, unknown> = {};
                
                if (updatedUser.subscriptionPlan === 'premium' && newPlanExpiryDate) {
                  const expiryDate =
                    newPlanExpiryDate instanceof Date
                      ? newPlanExpiryDate
                      : new Date(String(newPlanExpiryDate));
                  vehicleUpdateFields.listingExpiresAt = expiryDate.toISOString();
                  
                  if (expiryDate >= now) {
                    vehicleUpdateFields.listingStatus = 'active';
                    if (vehicle.status !== 'published') {
                      vehicleUpdateFields.status = 'published';
                    }
                  }
                } else {
                  // Free/Pro plans (or premium without expiry): 30-day listing window
                  const expiryDate = new Date();
                  expiryDate.setDate(expiryDate.getDate() + 30);
                  vehicleUpdateFields.listingExpiresAt = expiryDate.toISOString();
                  vehicleUpdateFields.listingStatus = 'active';
                }
                
                if (Object.keys(vehicleUpdateFields).length > 0) {
                  await core.vehicleService.update(vehicle.id, vehicleUpdateFields);
                }
              }
              
              core.logInfo(`✅ Synced ${sellerVehicles.length} vehicle expiry dates for seller ${normalizedEmail}`);
            }
          } catch (syncError) {
            core.logError('⚠️ Error syncing vehicle expiry dates:', syncError);
            // Don't fail the user update if vehicle sync fails
          }
        }

        // Verify the update by querying again
        const verifyEmail = await core.sanitizeString(String(email));
        const verifyUser = await core.userService.findByEmail(verifyEmail.toLowerCase().trim());
        if (!verifyUser) {
          core.logWarn('⚠️ User update verification failed - user not found after update');
        } else {
          core.logInfo('✅ User update verified in database');
        }

        const normalizedUpdatedUser = core.normalizeUser(updatedUser);
        if (!normalizedUpdatedUser) {
          return res.status(500).json({
            success: false,
            reason: 'User update completed but failed to process response.',
          });
        }

        // CRITICAL FIX: Signal to frontend that password was updated so it can clear cache
        if (updateFields.password) {
          res.setHeader('X-Password-Updated', 'true');
          core.logInfo('🔐 Password update completed - frontend should clear cache');
        }
        
        return res.status(200).json({ success: true, user: normalizedUpdatedUser });
      } catch (dbError) {
        core.logError('❌ Database error during user update:', dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        
        // Provide more specific error messages based on error type
        let userFriendlyReason = 'Database error occurred. Please try again later.';
        
        if (errorMessage.includes('permission') || errorMessage.includes('Permission denied')) {
          userFriendlyReason = 'Permission denied. Please check your authentication and try again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          userFriendlyReason = 'Database connection error. Please check your internet connection and try again.';
        } else if (errorMessage.includes('timeout')) {
          userFriendlyReason = 'Request timed out. Please try again.';
        } else if (updateFields.password) {
          // Password-specific error
          userFriendlyReason = 'Failed to update password. Please try again or contact support if the issue persists.';
        }
        
        return res.status(500).json({ 
          success: false, 
          reason: userFriendlyReason,
          error: errorMessage
        });
      }
    } catch (putError) {
      core.logError('❌ Error in PUT handler:', putError);
      return res.status(500).json({
        success: false,
        reason: 'Failed to update user',
        error: putError instanceof Error ? putError.message : 'Unknown error'
      });
    }
  }

  // DELETE - Delete user
  if (req.method === 'DELETE') {
    // SECURITY FIX: Verify Auth
    const auth = await core.authenticateRequestDual(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const { email } = req.body;
      
      // SECURITY FIX: Authorization Check
      // Normalize emails for comparison (critical for production)
      const normalizedAuthEmail = auth.user?.email ? auth.user.email.toLowerCase().trim() : '';
      const normalizedRequestEmail = email ? String(email).toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedAuthEmail !== normalizedRequestEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized action.' });
      }
      
      if (!email) {
        return res.status(400).json({ success: false, reason: 'Email is required for deletion.' });
      }

      // Sanitize email
      const sanitizedEmail = await core.sanitizeString(String(email));
      const normalizedEmail = sanitizedEmail.toLowerCase().trim();
      core.logInfo('🔄 DELETE /users - Deleting user:', normalizedEmail);

      // Check if user exists
      const existingUser = await core.userService.findByEmail(normalizedEmail);
      if (!existingUser) {
        core.logWarn('⚠️ User not found for deletion:', normalizedEmail);
        return res.status(404).json({ success: false, reason: 'User not found.' });
      }

      // Delete user from Supabase users table
      await core.userService.delete(normalizedEmail);
      core.logInfo('✅ User deleted successfully from Supabase users table:', normalizedEmail);

      // CRITICAL FIX: Also delete user from Supabase Auth
      try {
        const supabaseAdmin = core.getSupabaseAdminClient();
        
        // Get the user's auth ID from Supabase Auth by email
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          core.logWarn('⚠️ Could not list auth users to delete:', listError.message);
        } else {
          // Find the auth user by email
          const authUser = authUsers.users.find(u => 
            u.email?.toLowerCase().trim() === normalizedEmail
          );
          
          if (authUser) {
            // Delete user from Supabase Auth
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
              authUser.id
            );
            
            if (authDeleteError) {
              core.logWarn('⚠️ Failed to delete user from Supabase Auth:', authDeleteError.message);
              // Don't fail the entire deletion - users table record was deleted successfully
            } else {
              core.logInfo('✅ User deleted from Supabase Auth successfully');
            }
          } else {
            core.logWarn('⚠️ Auth user not found for email (may have been deleted already):', normalizedEmail);
          }
        }
      } catch (authDeleteError) {
        core.logWarn('⚠️ Error deleting user from Supabase Auth:', authDeleteError);
        // Don't fail the entire deletion - users table record was deleted successfully
      }

      // Verify the user was deleted by querying it
      const verifyUser = await core.userService.findByEmail(normalizedEmail);
      if (verifyUser) {
        core.logError('❌ User deletion verification failed - user still exists in database');
      } else {
        core.logInfo('✅ User deletion verified in database');
      }

      return res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
      core.logError('❌ Error deleting user:', error);
      return res.status(500).json({
        success: false,
        reason: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    // Extract detailed error information for better debugging
    const errorDetails = error instanceof Error 
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...(error as any)
        }
      : typeof error === 'object' && error !== null
      ? error
      : { value: error };
    core.logError('❌ Error in handleUsers:', errorDetails);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    // For GET requests, surface outage instead of silent empty data
    if (req.method === 'GET') {
      return core.respondServiceUnavailable(res, error, 'Unable to load users.');
    }
    
    // Check for server configuration errors (e.g. JWT_SECRET missing)
    const isConfigError = error instanceof Error && (
      error.message.includes('JWT_SECRET') ||
      error.message.includes('JWT secret') ||
      error.message.includes('environment variables')
    );
    if (isConfigError) {
      console.error('❌ Server configuration error in handleUsers:', error instanceof Error ? error.message : 'Unknown error');
      return res.status(503).json({
        success: false,
        reason: 'Server configuration error. Please try again later.',
        error: error instanceof Error ? error.message : 'Configuration error'
      });
    }

    // Check for Supabase database errors
    const isDbError = error instanceof Error && (
      error.message.includes('Supabase') ||
      error.message.includes('supabase') ||
      error.message.includes('database') && error.message.includes('unavailable')
    );
    
    if (isDbError) {
      console.error('❌ Database connection error detected:', error instanceof Error ? error.message : 'Unknown error');
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true,
        error: error instanceof Error ? error.message : 'Database connection error'
      });
    }
    
    // For authentication/authorization errors (user auth, NOT database auth), return 401 instead of 500
    // Only check for user authentication errors if it's NOT a database error
    // IMPORTANT: Only return 401 if it's clearly a USER authentication error (JWT tokens, login sessions)
    // NOT database authentication errors (those are already handled above as 503)
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      // Check for user authentication errors (JWT tokens, login sessions, Bearer tokens)
      // These are distinct from database authentication errors
      const isUserAuthError = 
        errorMsg.includes('jwt') || 
        errorMsg.includes('token') || 
        errorMsg.includes('bearer') ||
        errorMsg.includes('login') ||
        errorMsg.includes('session') ||
        errorMsg.includes('unauthorized') ||
        (errorMsg.includes('authentication') && (
          errorMsg.includes('user') ||
          errorMsg.includes('invalid') ||
          errorMsg.includes('expired')
        ));
      
      // Only return 401 if it's clearly a user auth error
      // If it contains "authentication" but doesn't match user auth patterns, treat as 500 (safer)
      if (isUserAuthError && !errorMsg.includes('firebase') && !errorMsg.includes('database') && !errorMsg.includes('connection')) {
        return res.status(401).json({
          success: false,
          reason: 'Authentication failed. Please log in again.',
          error: error.message
        });
      }
    }
    
    // For other errors on non-GET requests, return 500 with error details
    // But log the full error for debugging
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Unexpected error in handleUsers:', {
      message: errMsg,
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url
    });
    return res.status(500).json({
      success: false,
      reason: 'An error occurred while processing the request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicles handler - preserves exact functionality from vehicles.ts
async function handleVehicles(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    // FIX: Handle HEAD requests immediately to prevent 405 errors
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', '0');
      return res.status(200).end();
    }

    // Vercel may pass query values as string | string[] — strict equality on type breaks catalog routing.
    const type = core.firstQueryParam(req.query.type);

    // Public catalog JSON must never 503: mobile WebView treats it as hard failure + CORS noise.
    if (!core.USE_SUPABASE && type === 'data' && req.method === 'GET') {
      core.logWarn('⚠️ Supabase unavailable — returning default vehicle catalog for type=data');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({
        FOUR_WHEELER: [
          {
            name: 'Maruti Suzuki',
            models: [
              { name: 'Swift', variants: ['LXi', 'VXi', 'VXi (O)', 'ZXi', 'ZXi+'] },
              { name: 'Baleno', variants: ['Sigma', 'Delta', 'Zeta', 'Alpha'] },
            ],
          },
        ],
        TWO_WHEELER: [
          {
            name: 'Honda',
            models: [{ name: 'Activa 6G', variants: ['Standard', 'DLX', 'Smart'] }],
          },
        ],
      });
    }

    const aggregate = core.firstQueryParam(req.query.aggregate);
    if (!core.USE_SUPABASE && req.method === 'GET' && aggregate === 'storefront') {
      core.logWarn('⚠️ Supabase unavailable — empty storefront aggregate fallback');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, categories: {}, cities: {} });
    }

    // Check Supabase availability (required for vehicles listing CRUD, etc.)
    if (!core.USE_SUPABASE) {
      const errorMsg = core.getSupabaseErrorMessage();
      core.logWarn('⚠️ Supabase not available:', errorMsg);
      return res.status(503).json({
        success: false,
        reason: errorMsg,
        details: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Project → Settings → Environment Variables (Production), then redeploy.',
        fallback: true
      });
    }
    const action = core.firstQueryParam(req.query.action);

  // VEHICLE DATA ENDPOINTS (brands, models, variants)
  if (type === 'data') {
    // Ensure JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // Default vehicle data (fallback)
    const defaultData = {
      FOUR_WHEELER: [
        {
          name: "Maruti Suzuki",
          models: [
            { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
            { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] },
            { name: "Dzire", variants: ["LXi", "VXi", "ZXi", "ZXi+"] }
          ]
        },
        {
          name: "Hyundai",
          models: [
            { name: "i20", variants: ["Magna", "Sportz", "Asta", "Asta (O)"] },
            { name: "Verna", variants: ["S", "SX", "SX (O)", "SX Turbo"] }
          ]
        },
        {
          name: "Tata",
          models: [
            { name: "Nexon", variants: ["XE", "XM", "XZ+", "XZ+ (O)"] },
            { name: "Safari", variants: ["XE", "XM", "XZ", "XZ+"] }
          ]
        }
      ],
      TWO_WHEELER: [
        {
          name: "Honda",
          models: [
            { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] },
            { name: "Shine", variants: ["Standard", "SP", "SP (Drum)"] }
          ]
        },
        {
          name: "Bajaj",
          models: [
            { name: "Pulsar 150", variants: ["Standard", "DTS-i", "NS"] },
            { name: "CT 100", variants: ["Standard", "X"] }
          ]
        }
      ]
    };

    try {
      if (req.method === 'GET') {
        try {
          const fromSupabase = await core.readVehicleCatalogFromSupabase();
          if (fromSupabase) {
            return res.status(200).json(fromSupabase);
          }
          // Legacy: Firebase / supabase-admin-db path
          const vehicleData = await core.adminRead<{ data: typeof defaultData }>(core.DB_PATHS.VEHICLE_DATA, 'default');
          if (vehicleData && vehicleData.data) {
            return res.status(200).json(vehicleData.data);
          }
          
          // If no data exists, create default using Admin SDK (bypasses security rules)
          await core.adminCreate(core.DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
          return res.status(200).json(defaultData);
        } catch (dbError) {
          console.warn('⚠️ Database connection failed for vehicles data, returning default data:', dbError);
          // Return default data as fallback - NEVER return 500
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json(defaultData);
        }
      }

      if (req.method === 'POST') {
        try {
      if (!(await core.requireAdmin(req, res, 'Vehicle data update'))) {
        return;
      }
          const sbResult = await core.writeVehicleCatalogToSupabase(req.body);
          if (!sbResult.skipped && !sbResult.ok) {
            return res.status(500).json({
              success: false,
              reason: sbResult.error || 'Failed to save vehicle catalog to Supabase.',
            });
          }

          if (sbResult.ok) {
            core.logInfo('✅ Vehicle catalog saved to Supabase (app_config.vehicle_data)');
            try {
              await core.adminUpdate(core.DB_PATHS.VEHICLE_DATA, 'default', {
                data: req.body,
                updatedAt: new Date().toISOString()
              });
            } catch (mirrorErr) {
              core.logWarn('⚠️ Legacy DB mirror failed after Supabase save:', mirrorErr);
            }
            return res.status(200).json({ 
              success: true, 
              data: req.body,
              message: 'Vehicle data updated successfully',
              timestamp: new Date().toISOString(),
              storage: 'supabase'
            });
          }

          // No service role: persist via legacy path only
          await core.adminUpdate(core.DB_PATHS.VEHICLE_DATA, 'default', {
            data: req.body,
            updatedAt: new Date().toISOString()
          });
          
          core.logInfo('✅ Vehicle data saved successfully to legacy store');
          return res.status(200).json({ 
            success: true, 
            data: req.body,
            message: 'Vehicle data updated successfully',
            timestamp: new Date().toISOString(),
            storage: 'legacy'
          });
        } catch (dbError) {
          console.warn('⚠️ Database connection failed for vehicles data save:', dbError);
          
          core.logInfo('📝 Returning success with fallback indication for POST request');
          res.setHeader('X-Data-Fallback', 'true');
          return res.status(200).json({
            success: true,
            data: req.body,
            message: 'Vehicle data processed (database unavailable, using fallback)',
            fallback: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      // Ultimate fallback - catch any unexpected errors
      console.error('⚠️ Unexpected error in handleVehicles type=data:', error);
      res.setHeader('X-Data-Fallback', 'true');
      if (req.method === 'GET') {
        return res.status(200).json(defaultData);
      } else {
        return res.status(200).json({
          success: true,
          data: req.body || {},
          message: 'Vehicle data processed (error occurred, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // VEHICLE CRUD OPERATIONS
  if (req.method === 'GET') {
    try {
      if (core.firstQueryParam(req.query.aggregate) === 'storefront') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        const now = Date.now();
        const cachedAggregate = core.storefrontAggregateCache;
        if (
          cachedAggregate &&
          now - cachedAggregate.timestamp < core.STOREFRONT_AGGREGATE_CACHE_TTL_MS
        ) {
          return res.status(200).json(cachedAggregate.body);
        }
        try {
          const counts = await core.vehicleService.getStorefrontDiscoveryCounts();
          const body = { success: true, ...counts };
          core.setStorefrontAggregateCache({ body, timestamp: now });
          return res.status(200).json(body);
        } catch (aggErr) {
          const msg = aggErr instanceof Error ? aggErr.message : String(aggErr);
          console.error('❌ storefront aggregate failed:', msg);
          res.setHeader('X-Data-Fallback', 'true');
          // Never 500 here — mobile WebView needs 200 + JSON so UI and CORS stay usable.
          const fallbackBody = {
            success: true as const,
            categories: {} as Record<string, number>,
            cities: {} as Record<string, number>,
          };
          core.setStorefrontAggregateCache({ body: fallbackBody, timestamp: now });
          return res.status(200).json(fallbackBody);
        }
      }

      if (action === 'city-stats' && core.firstQueryParam(req.query.city)) {
        // Sanitize city input
        const sanitizedCity = await core.sanitizeString(String(core.firstQueryParam(req.query.city)));
        // PERFORMANCE FIX: Use database-level filtering instead of fetching all vehicles
        const cityVehicles = await core.vehicleService.findByCityAndStatus(sanitizedCity, 'published');
        const stats = {
          totalVehicles: cityVehicles.length,
          averagePrice: cityVehicles.reduce((sum, v) => sum + (v.price || 0), 0) / (cityVehicles.length || 1),
          popularMakes: getPopularMakes(cityVehicles),
          priceRange: getPriceRange(cityVehicles)
        };
        return res.status(200).json(stats);
      }

      if (action === 'radius-search' && req.query.lat && req.query.lng && req.query.radius) {
        const lat = parseFloat(String(req.query.lat));
        const lng = parseFloat(String(req.query.lng));
        const radiusKm = parseFloat(String(req.query.radius));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) {
          return res.status(400).json({ success: false, reason: 'Invalid lat, lng, or radius.' });
        }
        const cappedRadius = Math.min(Math.max(radiusKm, 0.5), 50);
        let nearbyVehicles: Awaited<ReturnType<typeof core.vehicleService.findWithinRadius>> | null = null;
        if (typeof core.vehicleService.findWithinRadius === 'function') {
          try {
            nearbyVehicles = await core.vehicleService.findWithinRadius(lat, lng, cappedRadius, 100);
          } catch (geoErr) {
            console.warn('PostGIS radius search unavailable, falling back to in-memory filter:', geoErr);
            nearbyVehicles = null;
          }
        }
        if (nearbyVehicles === null) {
          const publishedBatch = await core.vehicleService.findByStatus('published', {
            orderBy: 'created_at',
            orderDirection: 'desc',
            limit: 500,
          });
          nearbyVehicles = publishedBatch
            .filter((vehicle) => {
              if (!vehicle.exactLocation?.lat || !vehicle.exactLocation?.lng) return false;
              const distance = core.calculateDistance(lat, lng, vehicle.exactLocation.lat, vehicle.exactLocation.lng);
              return distance <= cappedRadius;
            })
            .slice(0, 100);
        }
        return res.status(200).json(nearbyVehicles);
      }

      // SELLER ENDPOINT: Return all of the authenticated seller's vehicles (any status)
      if (action === 'seller-mine') {
        const sellerAuth = await core.authenticateRequestDual(req);
        if (!sellerAuth.isValid || !sellerAuth.user?.email) {
          return res.status(401).json({ success: false, reason: sellerAuth.error || 'Authentication required' });
        }
        const sellerRole = core.normalizeUserRoleString(sellerAuth.user.role);
        if (sellerRole !== 'seller' && sellerRole !== 'admin') {
          return res.status(403).json({
            success: false,
            reason: 'Forbidden. Seller access required to view your inventory.',
          });
        }
        const sellerEmail = sellerAuth.user.email.toLowerCase().trim();
        try {
          const sellerVehicles = await core.vehicleService.findBySellerEmail(sellerEmail);
          const ownedOnly = sellerVehicles.filter(
            (v) => (v.sellerEmail || '').toLowerCase().trim() === sellerEmail,
          );
          const sortedVehicles = ownedOnly.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
          core.logInfo(`📊 SELLER: Returning ${sortedVehicles.length} vehicles for ${sellerEmail}`);
          return res.status(200).json(sortedVehicles);
        } catch (error) {
          console.error('❌ Error fetching seller inventory:', error);
          return res.status(500).json({
            success: false,
            reason: 'Failed to fetch seller inventory',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // ADMIN ENDPOINT: Return all vehicles including unpublished/sold (requires admin auth)
      if (action === 'admin-all') {
        const adminAuth = await core.authenticateRequestDual(req);
        if (!adminAuth.isValid) {
          return res.status(401).json({ success: false, reason: adminAuth.error || 'Authentication required' });
        }
        let adminRole = adminAuth.user?.role;
        if (adminRole !== 'admin' && adminAuth.user?.email && core.USE_SUPABASE) {
          try {
            const dbUser = await core.userService.findByEmail(adminAuth.user.email.toLowerCase().trim());
            if (dbUser && core.normalizeUserRoleString(dbUser.role) === 'admin') {
              adminRole = 'admin';
            }
          } catch {
            /* non-fatal */
          }
        }
        if (adminRole !== 'admin') {
          return res.status(403).json({
            success: false,
            reason: 'Forbidden. Admin access required to view all vehicles.',
          });
        }
        
        try {
          // PERFORMANCE FIX: Use COUNT queries for status breakdown instead of fetching all
          const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
            core.vehicleService.countByStatus('published'),
            core.vehicleService.countByStatus('unpublished'),
            core.vehicleService.countByStatus('sold')
          ]);
          const totalCount = publishedCount + unpublishedCount + soldCount;
          const statusCounts = {
            published: publishedCount,
            unpublished: unpublishedCount,
            sold: soldCount,
            total: totalCount
          };
          core.logInfo(`🔍 ADMIN: Vehicle status breakdown:`, statusCounts);
          
          // Fetch all vehicles for admin view (admin endpoints need full data)
          const allVehicles = await core.vehicleService.findAll();
          core.logInfo(`📊 ADMIN: Returning ${allVehicles.length} total vehicles (all statuses)`);
          
          // Sort by createdAt descending
          const sortedVehicles = allVehicles.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
          
          return res.status(200).json(sortedVehicles);
        } catch (error) {
          console.error('❌ Error fetching all vehicles for admin:', error);
          return res.status(500).json({
            success: false,
            reason: 'Failed to fetch all vehicles',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // DEBUG ENDPOINT: Return all vehicles including unpublished (for testing)
      if (action === 'debug-all') {
        const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
        if (isProduction) {
          return res.status(403).json({ success: false, reason: 'Debug endpoint disabled in production' });
        }
        const adminAuth = await core.requireAdmin(req, res, 'Debug vehicles');
        if (!adminAuth) {
          return;
        }
        // PERFORMANCE FIX: Use COUNT queries for status breakdown instead of fetching all first
        const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
          core.vehicleService.countByStatus('published'),
          core.vehicleService.countByStatus('unpublished'),
          core.vehicleService.countByStatus('sold')
        ]);
        const totalCount = publishedCount + unpublishedCount + soldCount;
        const statusCounts = {
          published: publishedCount,
          unpublished: unpublishedCount,
          sold: soldCount,
          total: totalCount
        };
        core.logInfo(`🔍 DEBUG: Vehicle status breakdown:`, statusCounts);
        
        // Fetch all vehicles for debug view (debug endpoints need full data)
        const allVehicles = await core.vehicleService.findAll();
        return res.status(200).json({
          total: allVehicles.length,
          statusCounts,
          vehicles: allVehicles
        });
      }

      // ADMIN: Fetch and save a single vehicle image by make/model/year, then update DB
      if (action === 'resolve') {
        const resolveAuth = await core.authenticateRequestDual(req);
        if (!resolveAuth.isValid) {
          return res.status(401).json({ success: false, reason: resolveAuth.error || 'Unauthorized' });
        }
        const normalizedAuthEmail = core.normalizeAuthActorEmail(resolveAuth);
        const mutation = await core.resolveVehicleForMutation(req.query as Record<string, unknown>, {
          sellerEmailHint: normalizedAuthEmail || undefined,
        });
        if (!mutation.ok) {
          return res.status(mutation.status).json({ success: false, reason: mutation.reason });
        }
        const normalizedVehicleSellerEmail = mutation.vehicle.sellerEmail
          ? mutation.vehicle.sellerEmail.toLowerCase().trim()
          : '';
        if (
          resolveAuth.user?.role !== 'admin' &&
          normalizedVehicleSellerEmail &&
          normalizedAuthEmail !== normalizedVehicleSellerEmail
        ) {
          return res.status(403).json({ success: false, reason: 'Unauthorized' });
        }
        return res.status(200).json({ success: true, vehicle: mutation.vehicle });
      }

      if (action === 'fetch-vehicle-image') {
        const adminAuth = await core.authenticateRequestDual(req);
        if (!adminAuth.isValid || adminAuth.user?.role !== 'admin') {
          return res.status(adminAuth.isValid ? 403 : 401).json({
            success: false,
            reason: adminAuth.isValid ? 'Admin required' : (adminAuth.error || 'Unauthorized')
          });
        }
        try {
          const mutation = await core.resolveVehicleForMutation(req.query as Record<string, unknown>);
          if (!mutation.ok) {
            return res.status(mutation.status).json({ success: false, reason: mutation.reason });
          }
          const vehicle = mutation.vehicle;
          const { fetchImageAndUpdateVehicle } = await import('../../services/vehicleImageFetchService.js');
          const result = await fetchImageAndUpdateVehicle({
            id: vehicle.id,
            make: vehicle.make || '',
            model: vehicle.model || '',
            year: vehicle.year || 0,
            images: vehicle.images
          });
          if (!result.success) {
            return res.status(500).json({ success: false, reason: result.error });
          }
          return res.status(200).json({ success: true, path: result.path });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return res.status(500).json({ success: false, reason: msg });
        }
      }

      // ADMIN: Fetch and save images for all vehicles that have no images
      if (action === 'fetch-all-vehicle-images') {
        const adminAuth = await core.authenticateRequestDual(req);
        if (!adminAuth.isValid || adminAuth.user?.role !== 'admin') {
          return res.status(adminAuth.isValid ? 403 : 401).json({
            success: false,
            reason: adminAuth.isValid ? 'Admin required' : (adminAuth.error || 'Unauthorized')
          });
        }
        try {
          const allVehicles = await core.vehicleService.findAll();
          const needImages = allVehicles.filter(
            (v) => !Array.isArray(v.images) || v.images.length === 0
          );
          const { fetchImageAndUpdateVehicle } = await import('../../services/vehicleImageFetchService.js');
          const results: { id: number; success: boolean; path?: string; error?: string }[] = [];
          for (const v of needImages) {
            const r = await fetchImageAndUpdateVehicle({
              id: v.id,
              make: v.make || '',
              model: v.model || '',
              year: v.year || 0,
              images: v.images
            });
            results.push({ id: v.id, success: r.success, path: r.path, error: r.error });
            await new Promise((r) => setTimeout(r, 400));
          }
          const ok = results.filter((r) => r.success).length;
          return res.status(200).json({
            success: true,
            total: needImages.length,
            updated: ok,
            failed: results.length - ok,
            results
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return res.status(500).json({ success: false, reason: msg });
        }
      }

      // PERFORMANCE OPTIMIZATION: Check cache first, then query only published vehicles
      // This dramatically reduces the amount of data fetched and processed
      core.cleanupVehicleCache();
      const cacheKey = 'published_vehicles';
      const cached = core.vehicleCache.get(cacheKey);
      
      // PAGINATION SUPPORT: Parse pagination parameters early
      // Default to pagination (50 per page) for better performance. limit=0 means return all (no pagination).
      const page = parseInt(String(core.firstQueryParam(req.query.page) ?? '1'), 10) || 1;
      const rawLimit = core.firstQueryParam(req.query.limit);
      const parsedLimit =
        rawLimit === undefined || rawLimit === '' ? 50 : parseInt(String(rawLimit), 10);
      let limit = (Number.isNaN(parsedLimit) || parsedLimit < 0) ? 50 : parsedLimit;
      const skipExpiryCheck = core.firstQueryParam(req.query.skipExpiryCheck) === 'true';
      const isProductionEnv =
        process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
      // In production, never load the entire catalog in one request (limit=0).
      if (limit === 0 && isProductionEnv) {
        limit = 80;
      }
      
      let vehicles: core.VehicleType[];
      let totalVehiclesCount: number = 0;
      
      if (cached && (Date.now() - cached.timestamp) < core.VEHICLE_CACHE_TTL && limit === 0) {
        // Use cache only for non-paginated requests (cache contains full list)
        core.logInfo(`📊 Using cached published vehicles (${cached.vehicles.length} vehicles)`);
        vehicles = cached.vehicles;
        totalVehiclesCount = vehicles.length;
      } else {
        // PERFORMANCE: Use database-level sorting and pagination (much faster)
        if (limit > 0) {
          // For paginated requests, fetch only the paginated subset
          const offset = (page - 1) * limit;
          vehicles = await core.vehicleService.findByStatus('published', {
            orderBy: 'created_at',
            orderDirection: 'desc',
            limit,
            offset
          });
          
          // Get total count from cache if available, otherwise use COUNT query (much faster)
          const cachedCount = cached?.totalCount;
          if (cachedCount !== undefined) {
            totalVehiclesCount = cachedCount;
            core.logInfo(`📊 Using cached total count: ${totalVehiclesCount}`);
          } else {
            // Use COUNT query instead of fetching all vehicles (dramatically faster)
            try {
              totalVehiclesCount = await core.vehicleService.countByStatus('published');
              // Update cache with total count
              if (cached) {
                cached.totalCount = totalVehiclesCount;
              } else {
                core.vehicleCache.set(cacheKey, { vehicles: [], timestamp: Date.now(), totalCount: totalVehiclesCount });
              }
              core.logInfo(`📊 Fetched total count using COUNT query: ${totalVehiclesCount}`);
            } catch (countError) {
              // Fallback to old method if COUNT query fails
              console.warn('⚠️ COUNT query failed, falling back to fetch-all method:', countError);
              const allVehiclesForCount = await core.vehicleService.findByStatus('published', {
                orderBy: 'created_at',
                orderDirection: 'desc',
                limit: 0
              });
              totalVehiclesCount = allVehiclesForCount.length;
              if (cached) {
                cached.totalCount = totalVehiclesCount;
              } else {
                core.vehicleCache.set(cacheKey, { vehicles: [], timestamp: Date.now(), totalCount: totalVehiclesCount });
              }
              core.logInfo(`📊 Fetched and cached total count (fallback): ${totalVehiclesCount}`);
            }
          }
          
          core.logInfo(`📊 Published vehicles fetched (paginated): ${vehicles.length} of ${totalVehiclesCount} total`);
        } else {
          // For non-paginated requests (limit=0), fetch all with database sorting
          // Skip extra COUNT query for fast full-list fetches used by initial client hydration.
          vehicles = await core.vehicleService.findByStatus('published', {
            orderBy: 'created_at',
            orderDirection: 'desc',
            limit: 0
          });
          if (skipExpiryCheck) {
            totalVehiclesCount = vehicles.length;
            core.logInfo(`📊 Published vehicles fetched (fast path): ${vehicles.length}`);
          } else {
            // Use COUNT query for total count instead of vehicles.length
            try {
              totalVehiclesCount = await core.vehicleService.countByStatus('published');
              core.logInfo(`📊 Published vehicles fetched: ${vehicles.length} (total: ${totalVehiclesCount})`);
            } catch (countError) {
              totalVehiclesCount = vehicles.length;
              core.logInfo(`📊 Published vehicles fetched: ${vehicles.length} (count query failed, using length)`);
            }
          }
          
          // DIAGNOSTIC: Log if no vehicles found
          if (vehicles.length === 0) {
            console.warn('⚠️ No published vehicles found in database. Checking all vehicles...');
            try {
              // PERFORMANCE FIX: Use COUNT queries instead of fetching all vehicles
              const [publishedCount, unpublishedCount, soldCount] = await Promise.all([
                core.vehicleService.countByStatus('published'),
                core.vehicleService.countByStatus('unpublished'),
                core.vehicleService.countByStatus('sold')
              ]);
              const totalCount = publishedCount + unpublishedCount + soldCount;
              const statusBreakdown = {
                published: publishedCount,
                unpublished: unpublishedCount,
                sold: soldCount,
                total: totalCount
              };
              console.warn('⚠️ Vehicle status breakdown:', statusBreakdown);
              
              // If there are vehicles but none published, log a warning
              if (totalCount > 0 && statusBreakdown.published === 0) {
                console.warn('⚠️ Database has vehicles but none are published. Consider publishing some vehicles.');
              } else if (totalCount === 0) {
                console.warn('⚠️ Database is empty. No vehicles found at all.');
              }
            } catch (diagError) {
              console.error('❌ Failed to run diagnostic query:', diagError);
            }
          }
          
          // Cache the full result with total count for non-paginated requests
          core.vehicleCache.set(cacheKey, { vehicles, timestamp: Date.now(), totalCount: totalVehiclesCount });
        }
      }
      
      // Only sort in-memory if we got cached data (database already sorted new queries)
      if (cached && vehicles === cached.vehicles) {
        vehicles = vehicles.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      }
      
      // Expiry enforcement: always run to keep listings accurate
      const sellerMap = new Map<string, core.UserType>();
      const vehicleUpdates: Array<{ id: number; primaryKey: string; updates: Partial<core.VehicleType> }> = [];
      
      {
        const now = new Date();
        const sellerEmails = new Set<string>();
        
        // Collect seller emails for vehicles missing expiry or needing plan checks
        vehicles.forEach(vehicle => {
          if (vehicle.sellerEmail) {
            const email = vehicle.sellerEmail.toLowerCase();
            if (!vehicle.listingExpiresAt || vehicle.status === 'published') {
              sellerEmails.add(email);
            }
          }
        });
        
        // PERFORMANCE OPTIMIZATION: Batch fetch all sellers in a single query (much faster)
        if (sellerEmails.size > 0) {
          try {
          // Use batch fetch method if available (much faster than individual queries)
          const sellerEmailArray = Array.from(sellerEmails);
          const sellers = await core.userService.findByEmails(sellerEmailArray);
          
          // Build seller map from batch-fetched users
          sellers.forEach(seller => {
            if (seller && seller.email) {
              const normalizedEmail = seller.email.toLowerCase().trim();
              sellerMap.set(normalizedEmail, seller);
            }
          });
          
          core.logInfo(`📊 Batch fetched ${sellerMap.size} sellers for expiry checks (out of ${sellerEmails.size} needed)`);
        } catch (batchError) {
          // Fallback to individual fetches if batch fails
          console.warn('⚠️ Batch user fetch failed, falling back to individual queries:', batchError);
          const sellerEmailArray = Array.from(sellerEmails);
          const userPromises = sellerEmailArray.map(async (email) => {
            try {
              return await core.userService.findByEmail(email);
            } catch (err) {
              console.warn(`⚠️ Failed to fetch user ${email}:`, err);
              return null;
            }
          });
          
          const results = await Promise.allSettled(userPromises);
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              const seller = result.value;
              if (seller && seller.email) {
                const normalizedEmail = seller.email.toLowerCase().trim();
                sellerMap.set(normalizedEmail, seller);
              }
            }
          });
          
          core.logInfo(`📊 Fetched ${sellerMap.size} sellers (fallback method)`);
          }
        }
        
        // Process expiry checks only if not skipped
        vehicles.forEach(vehicle => {
        const updateFields: Record<string, any> = {};
        
        if (!vehicle.listingExpiresAt && vehicle.status === 'published' && vehicle.sellerEmail) {
          const seller = sellerMap.get(vehicle.sellerEmail.toLowerCase());
          if (seller) {
            // If seller's plan has expired, force-unpublish even if listingExpiresAt is not set
            if (seller.planExpiryDate) {
              const sellerExpiry = new Date(seller.planExpiryDate);
              if (!isNaN(sellerExpiry.getTime()) && sellerExpiry < now) {
                updateFields.status = 'unpublished';
                updateFields.listingStatus = 'expired';
              }
            }
            
            // Set listing expiry based on plan
            if (seller.subscriptionPlan === 'premium' && seller.planExpiryDate) {
              updateFields.listingExpiresAt = seller.planExpiryDate;
            } else if (seller.subscriptionPlan !== 'premium') {
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + 30);
              updateFields.listingExpiresAt = expiryDate.toISOString();
            }
            // Premium without expiry: leave listingExpiresAt undefined (no expiry)
          }
        }
        
        if (vehicle.listingExpiresAt && vehicle.status === 'published') {
          const expiryDate = new Date(vehicle.listingExpiresAt);
          const seller = sellerMap.get(vehicle.sellerEmail?.toLowerCase());
          
          // Sync expiry date with plan expiry if they don't match (for Premium plans)
          if (seller?.subscriptionPlan === 'premium' && seller?.planExpiryDate) {
            const planExpiry = new Date(seller.planExpiryDate);
            const vehicleExpiry = new Date(vehicle.listingExpiresAt);
            
            // If plan expiry is different from vehicle expiry, sync them
            if (Math.abs(planExpiry.getTime() - vehicleExpiry.getTime()) > 1000) { // More than 1 second difference
              updateFields.listingExpiresAt = seller.planExpiryDate;
              
              // If vehicle was expired but plan is now valid, reactivate it
              if (vehicleExpiry < now && planExpiry >= now) {
                updateFields.listingStatus = 'active';
                updateFields.status = 'published';
              }
            }
          }
          
          // Auto-unpublish if listing has expired
          if (expiryDate < now) {
            updateFields.status = 'unpublished';
            updateFields.listingStatus = 'expired';
          }
        }
        
        if (Object.keys(updateFields).length > 0) {
          vehicleUpdates.push({
            id: vehicle.id,
            primaryKey: vehicle.databaseId || String(vehicle.id),
            updates: updateFields,
          });
        }
      });
      } // End of expiry check block
      
      // Enforce plan listing limits: keep most recent listings within limit, unpublish extras
      {
      try {
        // Build per-seller published vehicles list (newest first)
        const sellerToPublished: Map<string, core.VehicleType[]> = new Map();
        vehicles.forEach(v => {
          if (v.status === 'published' && v.sellerEmail) {
            const key = v.sellerEmail.toLowerCase();
            if (!sellerToPublished.has(key)) sellerToPublished.set(key, []);
            sellerToPublished.get(key)!.push(v);
          }
        });
        sellerToPublished.forEach(list => {
          list.sort((a, b) => {
            // Use createdAt if available, otherwise use a default timestamp
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        });
        
        // For each seller, apply plan limit (uses DB plan overrides when Supabase is enabled)
        for (const [email, publishedVehicles] of sellerToPublished.entries()) {
          const seller = sellerMap.get(email);
          const planDetails = seller
            ? await core.resolveSellerPlanDetails(seller, core.USE_SUPABASE)
            : core.PLAN_DETAILS.free;
          const limit = planDetails.listingLimit;
          if (limit === 'unlimited') {
            return;
          }
          const numericLimit = Number(limit) || 0;
          if (publishedVehicles.length > numericLimit) {
            const extras = publishedVehicles.slice(numericLimit); // older ones
            extras.forEach(v => {
              if (v.id) {
                vehicleUpdates.push({
                  id: v.id,
                  primaryKey: v.databaseId || String(v.id),
                  updates: { status: 'unpublished', listingStatus: 'suspended' }
                });
              }
            });
          }
        }
      } catch (limitErr) {
        console.warn('⚠️ Error applying plan listing limits:', limitErr);
      }
      } // End of plan limits check
      
      // Apply all updates in background to not block response
      if (vehicleUpdates.length > 0) {
        // Do updates in background to not block response
        Promise.all(vehicleUpdates.map(update => 
          core.vehicleService.update(update.primaryKey, update.updates).catch(err => 
            console.warn(`⚠️ Failed to update vehicle ${update.primaryKey}:`, err)
          )
        )).then(() => {
          // Invalidate cache after updates (in background)
          core.vehicleCache.delete('published_vehicles');
        });
      }
      
      let finalVehicles = vehicles;
      if (vehicleUpdates.length > 0) {
        // Only refresh published vehicles after updates (with database sorting)
        const refreshOffset = limit > 0 ? (page - 1) * limit : 0;
        finalVehicles = await core.vehicleService.findByStatus('published', {
          orderBy: 'created_at',
          orderDirection: 'desc',
          limit,
          offset: refreshOffset
        });
        core.logInfo(`📊 Refreshed ${finalVehicles.length} published vehicles after ${vehicleUpdates.length} updates`);
      }
      
      // Always hide expired listings from the public catalog (even when skipExpiryCheck skips DB writes)
      finalVehicles = finalVehicles.filter(core.isPublicBuyListing);
      
      // Normalize sellerEmail to lowercase for consistent filtering
      const normalizedVehicles = core.attachViewTrackTokens(
        core.normalizeVehiclesList(
        finalVehicles.map((v) => ({
          ...v,
          sellerEmail: v.sellerEmail?.toLowerCase().trim() || v.sellerEmail,
        })),
        ),
      );

      core.setVehicleApiCacheHeaders(req, res);

      // Use the total count we fetched earlier (or from cache)
      const finalTotalCount = totalVehiclesCount || normalizedVehicles.length;
      
      // Return paginated response with metadata if pagination was requested
      if (limit > 0) {
        const totalPages = Math.max(1, Math.ceil(finalTotalCount / limit));
        const hasMore =
          page < totalPages &&
          !(normalizedVehicles.length === 0 && page > 1);
        core.logInfo(`📊 Returning ${normalizedVehicles.length} published vehicles (page ${page} of ${totalPages}, total: ${finalTotalCount})`);
        return res.status(200).json({
          vehicles: normalizedVehicles,
          pagination: {
            page,
            limit,
            total: finalTotalCount,
            pages: totalPages,
            hasMore
          }
        });
      }
      
      // Return all vehicles if no pagination requested (backward compatible)
      core.logInfo(`📊 Returning ${normalizedVehicles.length} published vehicles to client`);
      return res.status(200).json(normalizedVehicles);
    } catch (error) {
      console.error('❌ Error fetching vehicles:', error);
      res.setHeader('X-Data-Error', 'true');
      const isProd =
        process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
      return res.status(isProd ? 503 : 200).json([]);
    }
  }

  if (req.method === 'POST') {
    // PUBLIC ACTION: Track view doesn't require authentication (it's just tracking public views)
    if (action === 'track-view') {
      try {
        const ip = core.getClientIP(req);
        const rate = await core.checkTrackViewRateLimit(ip);
        if (!rate.allowed) {
          return res.status(429).json({
            success: false,
            reason: 'Too many view tracking requests. Please try again later.',
          });
        }

        const parsed = trackViewBodySchema.safeParse(req.body || {});
        if (!parsed.success) {
          return res.status(400).json({ success: false, reason: 'Invalid request body' });
        }

        const mutation = await core.resolveVehicleForMutation(parsed.data as Record<string, unknown>);
        if (!mutation.ok) {
          return res.status(mutation.status).json({ success: false, reason: mutation.reason });
        }

        if (
          !verifyViewTrackToken(
            parsed.data.viewToken,
            mutation.vehicle.id,
            mutation.vehicle.databaseId,
          )
        ) {
          return res.status(403).json({ success: false, reason: 'Invalid or expired view token' });
        }

        const optionalAuth = await core.authenticateRequestDual(req);
        if (optionalAuth.isValid && optionalAuth.user?.email) {
          const viewerEmail = optionalAuth.user.email.toLowerCase().trim();
          const sellerEmail = (mutation.vehicle.sellerEmail || '').toLowerCase().trim();
          if (sellerEmail && viewerEmail === sellerEmail) {
            const currentViews = typeof mutation.vehicle.views === 'number' ? mutation.vehicle.views : 0;
            return res.status(200).json({ success: true, views: currentViews, skipped: true });
          }
        }

        const currentViews = typeof mutation.vehicle.views === 'number' ? mutation.vehicle.views : 0;
        const currentViews7 =
          typeof mutation.vehicle.viewsLast7Days === 'number' ? mutation.vehicle.viewsLast7Days : 0;
        const currentViews30 =
          typeof mutation.vehicle.viewsLast30Days === 'number' ? mutation.vehicle.viewsLast30Days : 0;
        const updated = await core.vehicleService.update(mutation.primaryKey, {
          views: currentViews + 1,
          viewsLast7Days: currentViews7 + 1,
          viewsLast30Days: currentViews30 + 1,
        });

        return res.status(200).json({ success: true, views: updated.views });
      } catch (error) {
        core.logWarn('⚠️ track-view failed (non-fatal):', error);
        return res.status(200).json({ success: false });
      }
    }

    // CRITICAL FIX: Verify Auth for all other POST actions BEFORE processing
    const auth = await core.authenticateRequestDual(req);
    if (!auth.isValid) {
      core.logWarn('⚠️ POST /vehicles - Authentication failed:', auth.error);
      return res.status(401).json({ 
        success: false, 
        reason: auth.error || 'Authentication required to create vehicles. Please log in again.',
        error: 'Invalid or expired authentication token'
      });
    }
    
    // CRITICAL FIX: Verify user exists in database
    const authenticatedEmail = core.normalizeAuthActorEmail(auth);
    const user = await core.userService.findByEmail(authenticatedEmail || '');
    if (!user) {
      core.logError('❌ POST /vehicles - User not found in database:', auth.user?.email);
      return res.status(401).json({ 
        success: false, 
        reason: 'User account not found. Please log in again.' 
      });
    }
    
    // CRITICAL FIX: Ensure sellerEmail matches authenticated user
    // Auto-correct sellerEmail to match authenticated user (security: prevent users from creating vehicles for other users)
    if (!req.body.sellerEmail || req.body.sellerEmail.toLowerCase() !== authenticatedEmail.toLowerCase()) {
      core.logWarn('⚠️ POST /vehicles - sellerEmail mismatch or missing:', {
        provided: req.body.sellerEmail,
        authenticated: authenticatedEmail
      });
      // Auto-correct sellerEmail to match authenticated user
      req.body.sellerEmail = authenticatedEmail;
    }
    
    // CRITICAL FIX: Enforce plan expiry and listing limits for creation (no action or unknown action)
    // Only applies to standard create flow (i.e., when not handling action sub-routes above)
    if (!action || (action !== 'refresh' && action !== 'boost' && action !== 'certify' && action !== 'sold' && action !== 'unsold' && action !== 'feature')) {
      try {
        // CRITICAL FIX: Use authenticated email (already normalized and verified)
        const normalizedEmail = authenticatedEmail.toLowerCase().trim();
        if (!normalizedEmail) {
          return res.status(400).json({ success: false, reason: 'Seller email is required' });
        }
            // Load seller
            const seller = await core.userService.findByEmail(normalizedEmail);
        if (!seller) {
          return res.status(404).json({ success: false, reason: 'Seller not found' });
        }
        // Check plan expiry
        const nowIso = new Date();
        const planExpired = core.isSellerPlanExpired(seller);
        if (planExpired) {
          return res.status(403).json({
            success: false,
            reason: 'Your subscription plan has expired. Please renew your plan to create new listings.',
            planExpired: true,
            expiredOn: seller.planExpiryDate
          });
        }
        // Determine listing limit for current plan (includes admin DB overrides)
        const sellerVehicles = await core.vehicleService.findBySellerEmail(normalizedEmail);
        const validation = await core.validateSellerCanCreateListing(seller, sellerVehicles, core.USE_SUPABASE);
        if (!validation.allowed) {
          return res.status(403).json(core.listingLimitGuardResponse(validation));
        }
      } catch (guardError) {
        console.error('❌ Error validating plan/limits before vehicle creation:', guardError);
        return res.status(500).json({
          success: false,
          reason: 'Failed to validate plan or listing limits. Please try again.',
        });
      }
    }

    if (action === 'refresh') {
      const { refreshAction, sellerEmail } = req.body;
      const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>);
      if (!mutation.ok) {
        return res.status(mutation.status).json({ success: false, reason: mutation.reason });
      }
      const vehicle = mutation.vehicle;

      const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
      const normalizedRequestSellerEmail = sellerEmail ? String(sellerEmail).toLowerCase().trim() : '';
      if (normalizedVehicleSellerEmail !== normalizedRequestSellerEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized' });
      }

      const updates: Partial<core.VehicleType> = {};
      if (refreshAction === 'refresh') {
        updates.views = 0;
        updates.inquiriesCount = 0;
      } else if (refreshAction === 'renew') {
        const seller = await core.userService.findByEmail(normalizedRequestSellerEmail);
        if (!seller) {
          return res.status(404).json({ success: false, reason: 'Seller not found' });
        }

        const sellerVehicles = await core.vehicleService.findBySellerEmail(normalizedRequestSellerEmail);
        const validation = await core.validateSellerCanPublishListing(
          seller,
          vehicle,
          sellerVehicles,
          core.USE_SUPABASE,
        );
        if (!validation.allowed) {
          return res.status(403).json(core.listingLimitGuardResponse(validation));
        }

        Object.assign(updates, core.buildListingRenewalUpdates(seller, vehicle));
      }

      const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, updates);
      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

    if (action === 'boost') {
      const {
        packageId,
        razorpay_order_id: boostOrderId,
        razorpay_payment_id: boostPaymentId,
        razorpay_signature: boostSignature,
      } = req.body;
      const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>);
      if (!mutation.ok) {
        return res.status(mutation.status).json({ success: false, reason: mutation.reason });
      }
      const vehicle = mutation.vehicle;
      const vehicleIdNum = vehicle.id;

      // SECURITY: Only the vehicle's seller (or admin) may boost it.
      const sellerEmailLower = String(vehicle.sellerEmail || '').toLowerCase().trim();
      const authedEmailLower = core.normalizeAuthActorEmail(auth);
      if (auth.user?.role !== 'admin' && sellerEmailLower && authedEmailLower !== sellerEmailLower) {
        return res.status(403).json({ success: false, reason: 'You can only boost your own listings.' });
      }

      // REVENUE GATE: Require a verified Razorpay payment for this boost.
      // Admins may bypass for manual promotions, otherwise we require signed payment proof.
      if (auth.user?.role !== 'admin') {
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          return res.status(503).json({ success: false, reason: 'Boost payments are not configured. Please contact support.' });
        }
        if (!boostOrderId || !boostPaymentId || !boostSignature) {
          return res.status(402).json({
            success: false,
            reason: 'Payment required. Please complete the Razorpay checkout before boosting.',
            requiresPayment: true,
          });
        }
        const expectedBoostSig = core.createHmac('sha256', keySecret)
          .update(`${String(boostOrderId)}|${String(boostPaymentId)}`)
          .digest('hex');
        if (expectedBoostSig !== String(boostSignature)) {
          return res.status(400).json({ success: false, reason: 'Invalid Razorpay signature for boost payment.' });
        }
      }

      // Add boost information if packageId is provided
      // packageId format is like "top_search_3", "homepage_spot", etc.
      // Extract type and duration from packageId
      let boostType: 'top_search' | 'homepage_spotlight' | 'featured_badge' | 'multi_city' = 'top_search';
      let boostDuration = 7; // Default 7 days
      
      if (packageId) {
        const parts = packageId.split('_');
        if (parts.length >= 2) {
          // Extract type (first parts except last if it's a number)
          const lastPart = parts[parts.length - 1];
          const isLastPartNumber = !isNaN(Number(lastPart));
          
          if (isLastPartNumber) {
            const extractedType = parts.slice(0, -1).join('_');
            // Validate and set boostType
            if (extractedType === 'top_search' || extractedType === 'homepage_spotlight' || 
                extractedType === 'featured_badge' || extractedType === 'multi_city') {
              boostType = extractedType;
            }
            boostDuration = Number(lastPart);
          } else {
            const extractedType = parts.join('_');
            // Validate and set boostType
            if (extractedType === 'top_search' || extractedType === 'homepage_spotlight' || 
                extractedType === 'featured_badge' || extractedType === 'multi_city') {
              boostType = extractedType;
            }
            // Use default duration based on package
            boostDuration = 7; // Default
          }
        }
      }
      
      const boostInfo = {
        id: `boost_${Date.now()}`,
        vehicleId: vehicleIdNum,
        packageId: packageId || 'standard',
        type: boostType,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + boostDuration * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      };
      
      const activeBoosts = vehicle.activeBoosts || [];
      activeBoosts.push(boostInfo);
      
      const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, {
        activeBoosts,
        isFeatured: true,
      });

      // Record the boost payment (if any) so admins have a full audit trail.
      if (boostPaymentId && boostOrderId) {
        try {
          const nowIso = new Date().toISOString();
          const prId = `payment_boost_${Date.now()}`;
          await core.adminCreate('payment_requests', {
            id: prId,
            sellerEmail: sellerEmailLower || authedEmailLower,
            amount: Number(req.body.amount) || 0,
            plan: 'boost',
            planId: packageId || 'boost',
            status: 'approved',
            paymentMethod: 'razorpay',
            transactionId: String(boostPaymentId),
            razorpayOrderId: String(boostOrderId),
            createdAt: nowIso,
            requestedAt: nowIso,
            updatedAt: nowIso,
            reviewedAt: nowIso,
            notes: `Boost for vehicle ${vehicleIdNum} (${boostType}, ${boostDuration}d)`,
            vehicleId: vehicleIdNum,
            boostType,
            boostDuration,
          }, String(prId));
        } catch (paymentLogErr) {
          core.logWarn('Failed to log boost payment:', paymentLogErr);
        }
      }

      return res.status(200).json({ success: true, vehicle: updatedVehicle });
    }

      if (action === 'certify') {
        try {
          const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>);
          if (!mutation.ok) {
            return res.status(mutation.status).json({ success: false, reason: mutation.reason });
          }
          const vehicle = mutation.vehicle;
          
          // Sanitize seller email
          const sanitizedSellerEmail = await core.sanitizeString(String(vehicle.sellerEmail));
          const seller = await core.userService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle' });
          }

          const planKey = (seller.subscriptionPlan || 'free') as keyof typeof core.PLAN_DETAILS;
          const planDetails = core.PLAN_DETAILS[planKey] || core.PLAN_DETAILS.free;
          const allowedCertifications = planDetails.freeCertifications ?? 0;
          const usedCertifications = seller.usedCertifications ?? 0;

          if (allowedCertifications <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include certification requests. Please upgrade your plan.'
            });
          }

          if (usedCertifications >= allowedCertifications) {
            return res.status(403).json({
              success: false,
              reason: `You have used all ${allowedCertifications} certification requests included in your plan.`
            });
          }

          if (vehicle.certificationStatus === 'requested') {
            return res.status(200).json({
              success: true,
              vehicle,
              alreadyRequested: true,
              usedCertifications,
              remainingCertifications: Math.max(allowedCertifications - usedCertifications, 0)
            });
          }

          const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, {
            certificationStatus: 'requested',
            certificationRequestedAt: new Date().toISOString(),
          });

          await core.userService.update(seller.email, {
            usedCertifications: usedCertifications + 1,
          });

          const updatedSeller = await core.userService.findByEmail(seller.email);
          const totalUsed = updatedSeller?.usedCertifications ?? usedCertifications + 1;
          const remaining = Math.max(allowedCertifications - totalUsed, 0);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: updatedVehicle,
            usedCertifications: totalUsed,
            remainingCertifications: remaining 
          });
        } catch (error) {
          console.error('❌ Error requesting vehicle certification:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'feature') {
        try {
          const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>);
          if (!mutation.ok) {
            return res.status(mutation.status).json({ success: false, reason: mutation.reason });
          }
          const vehicle = mutation.vehicle;

          // Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Feature action failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only feature your own listings.' 
            });
          }

          if (vehicle.isFeatured) {
            return res.status(200).json({ 
              success: true, 
              vehicle,
              alreadyFeatured: true 
            });
          }

          const sellerEmail = vehicle.sellerEmail;
          if (!sellerEmail) {
            return res.status(400).json({ success: false, reason: 'Vehicle does not have an associated seller.' });
          }

          // Sanitize seller email
          const sanitizedSellerEmail = await core.sanitizeString(String(sellerEmail));
          const seller = await core.userService.findByEmail(sanitizedSellerEmail.toLowerCase().trim());
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found for this vehicle.' });
          }

          // Determine plan-based featured credit allowance
          const FEATURE_CREDIT_LIMITS: Record<string, number> = {
            free: 0,
            pro: 2,
            premium: 5
          };

          const sellerPlan = (seller.subscriptionPlan || 'free') as string;
          const planLimit = FEATURE_CREDIT_LIMITS[sellerPlan] ?? 0;

          // Initialize featured credits if undefined
          let remainingCredits = typeof seller.featuredCredits === 'number' ? seller.featuredCredits : planLimit;
          if (!Number.isFinite(remainingCredits)) {
            remainingCredits = 0;
          }

          if (planLimit === 0) {
            return res.status(403).json({
              success: false,
              reason: 'Your current plan does not include featured listings. Upgrade to unlock featured credits.',
              remainingCredits
            });
          }

          if (remainingCredits <= 0) {
            return res.status(403).json({
              success: false,
              reason: 'You have no featured credits remaining. Upgrade your plan or wait until your credits refresh.',
              remainingCredits
            });
          }

          const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, {
            isFeatured: true,
            featuredAt: new Date().toISOString(),
          });

          await core.userService.update(seller.email, {
            featuredCredits: Math.max(0, remainingCredits - 1),
          });

          const updatedSeller = await core.userService.findByEmail(seller.email);
          
          return res.status(200).json({ 
            success: true, 
            vehicle: updatedVehicle,
            remainingCredits: updatedSeller?.featuredCredits ?? 0
          });
        } catch (error) {
          console.error('❌ Error featuring vehicle:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      if (action === 'sold') {
        try {
          const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
          const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>, {
            sellerEmailHint: normalizedAuthEmail || undefined,
          });
          if (!mutation.ok) {
            return res.status(mutation.status).json({ success: false, reason: mutation.reason });
          }
          const vehicle = mutation.vehicle;
          core.logInfo('📝 Marking vehicle as sold:', mutation.primaryKey);

          // SECURITY FIX: Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Mark as sold failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only mark your own listings as sold.' 
            });
          }
          
          core.logInfo('✏️ Updating vehicle status to sold...');
          const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, {
            status: 'sold',
            listingStatus: 'sold',
            soldAt: new Date().toISOString(),
          });

          core.logInfo('✅ Vehicle saved successfully');
          return res.status(200).json({ success: true, vehicle: updatedVehicle });
        } catch (error) {
          console.error('❌ Error marking vehicle as sold:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return res.status(500).json({ 
            success: false, 
            reason: errorMessage
          });
        }
      }

      if (action === 'unsold') {
        try {
          const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
          const mutation = await core.resolveVehicleForMutation((req.body || {}) as Record<string, unknown>, {
            sellerEmailHint: normalizedAuthEmail || undefined,
          });
          if (!mutation.ok) {
            return res.status(mutation.status).json({ success: false, reason: mutation.reason });
          }
          const vehicle = mutation.vehicle;

          // SECURITY FIX: Verify ownership (unless admin)
          const normalizedVehicleSellerEmail = vehicle.sellerEmail ? vehicle.sellerEmail.toLowerCase().trim() : '';
          if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
            console.error('❌ Mark as unsold failed: Ownership mismatch', { 
              vehicleSeller: normalizedVehicleSellerEmail, 
              authenticated: normalizedAuthEmail 
            });
            return res.status(403).json({ 
              success: false, 
              reason: 'Unauthorized: You can only mark your own listings as unsold.' 
            });
          }
          
          const seller = await core.userService.findByEmail(normalizedVehicleSellerEmail);
          if (!seller) {
            return res.status(404).json({ success: false, reason: 'Seller not found' });
          }

          const sellerVehicles = await core.vehicleService.findBySellerEmail(normalizedVehicleSellerEmail);
          const publishValidation = await core.validateSellerCanPublishListing(
            seller,
            vehicle,
            sellerVehicles,
            core.USE_SUPABASE,
          );
          if (!publishValidation.allowed) {
            return res.status(403).json(core.listingLimitGuardResponse(publishValidation));
          }

          const unsoldUpdates: Partial<core.VehicleType> = {
            status: 'published',
            listingStatus: 'active',
            soldAt: undefined,
          };
          const listingExpired =
            Boolean(vehicle.listingExpiresAt) &&
            new Date(vehicle.listingExpiresAt as string) < new Date();
          if (listingExpired) {
            Object.assign(unsoldUpdates, core.buildListingRenewalUpdates(seller, vehicle));
          }

          const updatedVehicle = await core.vehicleService.update(mutation.primaryKey, unsoldUpdates);

          if ((seller.soldListings || 0) > 0) {
            await core.userService.update(normalizedVehicleSellerEmail, {
              soldListings: Math.max(0, (seller.soldListings || 0) - 1),
            });
          }

          return res.status(200).json({ success: true, vehicle: updatedVehicle });
        } catch (error) {
          console.error('❌ Error marking vehicle as unsold:', error);
          return res.status(500).json({ 
            success: false, 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

    // Create new vehicle
    // SECURITY FIX: Verify Auth
    const vehicleAuth = await core.authenticateRequestDual(req);
    if (!vehicleAuth.isValid) {
      console.error('❌ Vehicle creation failed: Authentication required');
      return res.status(401).json({ success: false, reason: vehicleAuth.error });
    }
    
    // Verify seller email matches authenticated user (unless admin)
    if (req.body.sellerEmail) {
      const sanitizedEmail = (await core.sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const normalizedAuthEmail = core.normalizeAuthActorEmail(vehicleAuth);
      
      if (vehicleAuth.user?.role !== 'admin' && sanitizedEmail !== normalizedAuthEmail) {
        console.error('❌ Vehicle creation failed: Seller email mismatch', { 
          provided: sanitizedEmail, 
          authenticated: normalizedAuthEmail 
        });
        return res.status(403).json({ 
          success: false, 
          reason: 'Unauthorized: You can only create listings for your own account.' 
        });
      }
      
      // Check if seller's plan has expired and block creation if so
      const seller = await core.userService.findByEmail(sanitizedEmail);
      if (seller && seller.planExpiryDate) {
        const expiryDate = new Date(seller.planExpiryDate);
        const isExpired = expiryDate < new Date();
        if (isExpired) {
          console.error('❌ Vehicle creation failed: Plan expired', { email: sanitizedEmail, expiryDate: seller.planExpiryDate });
          return res.status(403).json({ 
            success: false, 
            reason: 'Your subscription plan has expired. Please renew your plan to create new vehicle listings.' 
          });
        }
      }
    }
    
    // Set listingExpiresAt based on seller's plan
    let listingExpiresAt: string | undefined;
    if (req.body.sellerEmail) {
      const sanitizedEmail = (await core.sanitizeString(String(req.body.sellerEmail))).toLowerCase().trim();
      const seller = await core.userService.findByEmail(sanitizedEmail);
      if (seller) {
        listingExpiresAt = core.computeListingExpiresAtForSeller(seller);
      }
    }
    
    // Normalize images to always be an array; reject inline base64 (must be storage URLs).
    const normalizedImages = core.sanitizeVehicleMediaUrls(
      Array.isArray(req.body.images)
        ? req.body.images
        : typeof req.body.images === 'string'
          ? [req.body.images]
          : [],
    );
    
    if (normalizedImages.length > 10) {
      core.logWarn('⚠️ Vehicle has too many images, limiting to 10', { 
        provided: normalizedImages.length,
        sellerEmail: req.body.sellerEmail 
      });
      normalizedImages.splice(10); // Keep only first 10 images
    }
    
    // Estimate total payload size for unusually large URL lists
    const totalImageSize = normalizedImages.reduce((total: number, img: string) => {
      return total + (typeof img === 'string' ? img.length : 0);
    }, 0);
    
    const maxRecommendedSize = 10 * 1024 * 1024;
    if (totalImageSize > maxRecommendedSize) {
      core.logWarn('⚠️ Vehicle image URL payload is very large', {
        totalSize: `${(totalImageSize / 1024 / 1024).toFixed(2)} MB`,
        imageCount: normalizedImages.length,
        sellerEmail: req.body.sellerEmail,
      });
    }

    // SECURITY: Field allowlist — `...req.body` previously let attackers inject
    // `isFeatured: true`, `views: 999999`, `certificationStatus: 'certified'`,
    // `trustScore: 100`, etc. Only allow fields the client is legitimately expected to set.
    const ALLOWED_VEHICLE_CREATE_FIELDS = [
      'category', 'make', 'model', 'year', 'price', 'mileage',
      'fuelType', 'transmission', 'color', 'bodyType', 'numberOfOwners',
      'noOfOwners',
      'description', 'features', 'location', 'city', 'state', 'pincode',
      'registrationNumber', 'registrationYear', 'insuranceValidTill', 'insuranceValidity',
      'insuranceType', 'condition',
      'sellerName', 'sellerPhone', 'sellerType',
      'qualityReport', 'offerDetails',
      'offerEnabled', 'offerTitle', 'offerStartDate', 'offerEndDate', 'offerDateLabel',
      'offerDescription', 'offerHighlight', 'offerDisclaimer',
      'tags', 'title', 'engine', 'engineCc',
      'kmDriven', 'variant', 'listingType', 'negotiable', 'status',
      'rto', 'displacement', 'groundClearance', 'bootSpace', 'documents',
    ] as const;
    const body = (req.body || {}) as Record<string, unknown>;
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of ALLOWED_VEHICLE_CREATE_FIELDS) {
      if (key in body) sanitizedBody[key] = body[key];
    }
    // Client form uses noOfOwners; legacy/alternate key is numberOfOwners
    if (sanitizedBody.noOfOwners === undefined && body.numberOfOwners !== undefined) {
      sanitizedBody.noOfOwners = body.numberOfOwners;
    }
    // Accept either insurance validity field name from clients
    if (sanitizedBody.insuranceValidity === undefined && body.insuranceValidTill !== undefined) {
      sanitizedBody.insuranceValidity = body.insuranceValidTill;
    } else if (sanitizedBody.insuranceValidity === undefined && sanitizedBody.insuranceValidTill !== undefined) {
      sanitizedBody.insuranceValidity = sanitizedBody.insuranceValidTill;
    }
    // Clamp status to the published/unpublished/sold enum — prevent free-text injection.
    const validStatuses = new Set(['published', 'unpublished', 'sold', 'archived']);
    const requestedStatus = typeof sanitizedBody.status === 'string' ? sanitizedBody.status : '';
    const clampedStatus = validStatuses.has(requestedStatus) ? requestedStatus : 'published';
    // Admins may additionally seed privileged fields (e.g. bulk import of certified listings).
    const ADMIN_ONLY_FIELDS = ['isFeatured', 'certificationStatus', 'trustScore', 'activeBoosts'] as const;
    const adminExtras: Record<string, unknown> = {};
    if (auth.user?.role === 'admin') {
      for (const key of ADMIN_ONLY_FIELDS) {
        if (key in body) adminExtras[key] = body[key];
      }
    }

    if (Array.isArray(sanitizedBody.documents)) {
      sanitizedBody.documents = (sanitizedBody.documents as Array<{ url?: string }>)
        .map((doc) => ({
          ...doc,
          url: typeof doc.url === 'string' && !doc.url.startsWith('data:') ? doc.url : '',
        }))
        .filter((doc) => Boolean(doc.url));
    }

    const vehicleData: Record<string, unknown> = {
      ...sanitizedBody,
      ...adminExtras,
      // Server-controlled fields — never take these from client input.
      sellerEmail: authenticatedEmail,
      images: normalizedImages,
      views: 0,
      inquiriesCount: 0,
      status: clampedStatus,
      ...(auth.user?.role === 'admin' ? {} : {
        isFeatured: false,
        certificationStatus: 'none',
      }),
      createdAt: new Date().toISOString(),
      listingExpiresAt,
      listingStatus: 'active',
    };
    
    try {
      core.logInfo('💾 Saving new vehicle to Firebase...', { 
        make: vehicleData.make, 
        model: vehicleData.model,
        sellerEmail: vehicleData.sellerEmail 
      });
      
      const newVehicle = await core.vehicleService.create(vehicleData as unknown as Omit<core.VehicleType, 'id'>);
      core.logInfo('✅ Vehicle saved successfully to Firebase:', newVehicle.id);
      
      // Verify the vehicle was saved by querying it back
      const verifyVehicle = await core.vehicleService.findById(newVehicle.id);
      if (!verifyVehicle) {
        console.error('❌ Vehicle creation verification failed - vehicle not found after save', { id: newVehicle.id });
        return res.status(500).json({ 
          success: false, 
          reason: 'Vehicle was created but could not be verified. Please refresh and check your listings.' 
        });
      } else {
        core.logInfo('✅ Vehicle creation verified in database', { id: verifyVehicle.id });
      }
      
      return res.status(201).json(verifyVehicle);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to create vehicle in Firebase:', errorMessage, error);
      return res.status(500).json({ 
        success: false, 
        reason: `Failed to create vehicle: ${errorMessage}`,
        error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }

  if (req.method === 'PUT') {
    // SECURITY FIX: Verify Auth
    const auth = await core.authenticateRequestDual(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const { id: _id, databaseId: _databaseId, ...updateData } = body;
      const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);

      const mutation = await core.resolveVehicleForMutation(body, {
        sellerEmailHint: normalizedAuthEmail || undefined,
      });
      if (!mutation.ok) {
        const reason =
          mutation.reason === 'Vehicle ID is required.'
            ? 'Vehicle ID is required for update.'
            : mutation.reason;
        return res.status(mutation.status).json({ success: false, reason });
      }
      const existingVehicle = mutation.vehicle;
      const rowPk = mutation.primaryKey;

      if (process.env.NODE_ENV !== 'production') {
        core.logInfo('🔄 PUT /vehicles - Updating vehicle:', {
          id: existingVehicle.id,
          databaseId: rowPk,
          fields: Object.keys(updateData),
        });
      }
      
      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = existingVehicle.sellerEmail ? existingVehicle.sellerEmail.toLowerCase().trim() : '';
      if (!auth.user || (auth.user.role !== 'admin' && normalizedVehicleSellerEmail !== normalizedAuthEmail)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }
      
      // Normalize images to always be an array
      if (updateData.images !== undefined) {
        updateData.images = Array.isArray(updateData.images) 
          ? updateData.images 
          : typeof updateData.images === 'string' 
            ? [updateData.images] 
            : [];
      }

      // SECURITY: Field allowlist for vehicle PUT — prevent non-admins from tampering with
      // views, featured status, certification status, trust score, or seller email.
      const ALLOWED_VEHICLE_UPDATE_FIELDS = [
        'category', 'make', 'model', 'year', 'price', 'mileage',
        'fuelType', 'transmission', 'color', 'bodyType', 'numberOfOwners',
        'noOfOwners', 'registrationYear',
        'description', 'features', 'location', 'city', 'state', 'pincode',
        'registrationNumber', 'insuranceValidTill', 'insuranceValidity', 'insuranceType',
        'condition',
        'sellerName', 'sellerPhone', 'sellerType',
        'qualityReport', 'offerDetails',
        'offerEnabled', 'offerTitle', 'offerStartDate', 'offerEndDate', 'offerDateLabel',
        'offerDescription', 'offerHighlight', 'offerDisclaimer',
        'tags', 'title', 'engine', 'engineCc', 'fuelEfficiency',
        'kmDriven', 'variant', 'listingType', 'negotiable',
        'rto', 'displacement', 'groundClearance', 'bootSpace', 'documents',
        'images', 'status', 'listingStatus', 'soldAt',
        // Moderation / metadata (stored in vehicles.metadata via supabase-vehicle-service)
        'isFlagged', 'flagReason', 'flaggedAt',
      ] as const;
      const ADMIN_ONLY_UPDATE_FIELDS = [
        'isFeatured', 'certificationStatus', 'trustScore', 'activeBoosts',
        'views', 'inquiriesCount', 'sellerEmail', 'listingExpiresAt'
      ] as const;
      const rawUpdate = updateData as Record<string, unknown>;
      const sanitizedUpdate: Record<string, unknown> = {};
      for (const key of ALLOWED_VEHICLE_UPDATE_FIELDS) {
        if (key in rawUpdate) sanitizedUpdate[key] = rawUpdate[key];
      }
      if (auth.user?.role === 'admin') {
        for (const key of ADMIN_ONLY_UPDATE_FIELDS) {
          if (key in rawUpdate) sanitizedUpdate[key] = rawUpdate[key];
        }
      }
      // Client form uses noOfOwners; legacy key is numberOfOwners
      if (sanitizedUpdate.noOfOwners === undefined && rawUpdate.numberOfOwners !== undefined) {
        sanitizedUpdate.noOfOwners = rawUpdate.numberOfOwners;
      }
      // Accept either insurance validity field name from clients (e.g. EditVehicleModal)
      if (sanitizedUpdate.insuranceValidity === undefined && rawUpdate.insuranceValidTill !== undefined) {
        sanitizedUpdate.insuranceValidity = rawUpdate.insuranceValidTill;
      } else if (
        sanitizedUpdate.insuranceValidity === undefined &&
        sanitizedUpdate.insuranceValidTill !== undefined
      ) {
        sanitizedUpdate.insuranceValidity = sanitizedUpdate.insuranceValidTill;
      }
      // Clamp status to the valid enum.
      if ('status' in sanitizedUpdate) {
        const validStatuses = new Set(['published', 'unpublished', 'sold', 'archived']);
        if (typeof sanitizedUpdate.status !== 'string' || !validStatuses.has(sanitizedUpdate.status)) {
          delete sanitizedUpdate.status;
        }
      }

      const nextStatus = sanitizedUpdate.status as string | undefined;
      if (nextStatus === 'published' && existingVehicle.status !== 'published' && normalizedVehicleSellerEmail) {
        const seller = await core.userService.findByEmail(normalizedVehicleSellerEmail);
        if (!seller) {
          return res.status(404).json({ success: false, reason: 'Seller not found' });
        }
        const sellerVehicles = await core.vehicleService.findBySellerEmail(normalizedVehicleSellerEmail);
        const publishValidation = await core.validateSellerCanPublishListing(
          seller,
          existingVehicle,
          sellerVehicles,
          core.USE_SUPABASE,
        );
        if (!publishValidation.allowed) {
          return res.status(403).json(core.listingLimitGuardResponse(publishValidation));
        }

        sanitizedUpdate.listingStatus = 'active';
        if (existingVehicle.status === 'sold') {
          sanitizedUpdate.soldAt = null;
        }

        const listingExpired =
          Boolean(existingVehicle.listingExpiresAt) &&
          new Date(existingVehicle.listingExpiresAt as string) < new Date();
        if (listingExpired) {
          Object.assign(sanitizedUpdate, core.buildListingRenewalUpdates(seller, existingVehicle));
        } else if (!existingVehicle.listingExpiresAt) {
          sanitizedUpdate.listingExpiresAt = core.computeListingExpiresAtForSeller(seller);
        }
      } else if (nextStatus === 'unpublished' && existingVehicle.status === 'published') {
        sanitizedUpdate.listingStatus = 'draft';
      }

      const updatedVehicle = await core.vehicleService.update(rowPk, sanitizedUpdate);
      core.logInfo('✅ Vehicle updated and saved successfully:', rowPk);

      return res.status(200).json(updatedVehicle);
    } catch (error) {
      console.error('❌ Error updating vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  if (req.method === 'DELETE') {
    // SECURITY FIX: Verify Auth
    const auth = await core.authenticateRequestDual(req);
    if (!auth.isValid) {
      return res.status(401).json({ success: false, reason: auth.error });
    }
    try {
      const body = (req.body || {}) as { id?: unknown; databaseId?: unknown };
      const databaseId =
        typeof body.databaseId === 'string' && body.databaseId.trim() !== ''
          ? body.databaseId.trim()
          : '';
      const idRaw = body.id;
      const vehicleIdNum =
        idRaw === undefined || idRaw === null || idRaw === ''
          ? NaN
          : typeof idRaw === 'string'
            ? parseInt(idRaw, 10)
            : Number(idRaw);

      let vehicleToDelete: Awaited<ReturnType<typeof core.vehicleService.findByPrimaryKey>> = null;
      let rowPk = '';

      if (databaseId) {
        vehicleToDelete = await core.vehicleService.findByPrimaryKey(databaseId);
        if (!vehicleToDelete) {
          return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
        }
        rowPk = vehicleToDelete.databaseId || databaseId;
        if (Number.isFinite(vehicleIdNum) && vehicleIdNum > 0 && vehicleToDelete.id !== vehicleIdNum) {
          return res.status(400).json({ success: false, reason: 'Vehicle id does not match listing.' });
        }
      } else if (Number.isFinite(vehicleIdNum) && vehicleIdNum > 0) {
        vehicleToDelete = await core.vehicleService.findById(vehicleIdNum);
        if (!vehicleToDelete) {
          return res.status(404).json({ success: false, reason: 'Vehicle not found.' });
        }
        rowPk = vehicleToDelete.databaseId || String(vehicleIdNum);
      } else {
        return res.status(400).json({
          success: false,
          reason: 'Vehicle ID is required for deletion (send id and optional databaseId for UUID rows).',
        });
      }

      if (process.env.NODE_ENV !== 'production') {
        core.logInfo('🔄 DELETE /vehicles - Deleting vehicle row:', rowPk);
      }

      // Normalize emails for comparison (critical for production)
      const normalizedVehicleSellerEmail = vehicleToDelete.sellerEmail
        ? vehicleToDelete.sellerEmail.toLowerCase().trim()
        : '';
      const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
      const normalizedAuthUid = auth.user?.userId ? String(auth.user.userId).toLowerCase().trim() : '';
      const authMatchesSeller =
        Boolean(normalizedVehicleSellerEmail) &&
        (normalizedVehicleSellerEmail === normalizedAuthEmail ||
          (normalizedAuthUid && normalizedVehicleSellerEmail === normalizedAuthUid));
      if (!auth.user || (auth.user.role !== 'admin' && !authMatchesSeller)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized: You do not own this listing.' });
      }

      await core.vehicleService.delete(rowPk);
      core.logInfo('✅ Vehicle deleted successfully:', rowPk);

      const verifyVehicle = await core.vehicleService.findByPrimaryKey(rowPk);
      if (verifyVehicle) {
        console.error('❌ Vehicle deletion verification failed - vehicle still exists in database');
      } else {
        core.logInfo('✅ Vehicle deletion verified in database');
      }

      return res.status(200).json({ success: true, message: 'Vehicle deleted successfully.' });
    } catch (error) {
      console.error('❌ Error deleting vehicle:', error);
      return res.status(500).json({ 
        success: false, 
        reason: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    console.error('Error in handleVehicles:', error);
    res.setHeader('Content-Type', 'application/json');

    const isVehicleDataEndpoint = core.firstQueryParam(req.query?.type) === 'data';
    if (isVehicleDataEndpoint) {
      return core.respondServiceUnavailable(res, error, 'Vehicle catalog data is temporarily unavailable.');
    }

    if (req.method === 'GET') {
      return core.respondServiceUnavailable(res, error, 'Unable to load vehicles.');
    }

    return res.status(500).json({
      success: false,
      reason: core.errorToPublicMessage(error),
    });
  }
}

// Vehicle specs proxy — CarQuery (browser cannot call carqueryapi.com due to CORS).
async function handleVehicleSpecs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  const make = core.firstQueryParam(req.query?.make)?.trim();
  const model = core.firstQueryParam(req.query?.model)?.trim();
  const yearRaw = core.firstQueryParam(req.query?.year);
  const year = yearRaw ? parseInt(yearRaw, 10) : NaN;

  if (!make || !model || !Number.isFinite(year) || year < 1900) {
    return res.status(400).json({
      success: false,
      reason: 'Query params make, model, and year are required',
    });
  }

  try {
    const specs = await core.lookupVehicleSpecsFromCarQuery(make, model, year);
    return res.status(200).json({
      success: Boolean(specs),
      specs: specs ?? null,
    });
  } catch (error) {
    core.logError('CarQuery vehicle-specs proxy error:', error);
    return res.status(200).json({
      success: false,
      specs: null,
      reason: 'CarQuery lookup failed',
    });
  }
}

// Image upload handler - uses service role so app-authenticated users (e.g. admin) can upload without Supabase session
async function handleUploadImage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }
  const uploadAuth = await core.authenticateRequestDual(req);
  if (!uploadAuth.isValid) {
    return res.status(401).json({
      success: false,
      reason: uploadAuth.error || 'Authentication required to upload images.',
    });
  }
  if (!core.USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      reason: 'Storage is not available. Configure Supabase environment variables.',
    });
  }
  try {
    let body = req.body as { fileBase64?: string; fileName?: string; mimeType?: string; folder?: string } | undefined;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as typeof body;
      } catch {
        return res.status(400).json({ success: false, reason: 'Invalid JSON body.' });
      }
    }
    const { fileBase64, fileName, mimeType, folder = 'vehicles' } = body || {};
    if (!fileBase64 || !fileName) {
      return res.status(400).json({
        success: false,
        reason: 'Missing fileBase64 or fileName in request body.',
      });
    }
    const sanitizedBase64 = String(fileBase64).trim();
    if (!sanitizedBase64 || !/^[A-Za-z0-9+/=\r\n]+$/.test(sanitizedBase64)) {
      return res.status(400).json({
        success: false,
        reason: 'Invalid base64 payload for image upload.',
      });
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(sanitizedBase64, 'base64');
    } catch {
      return res.status(400).json({
        success: false,
        reason: 'Could not decode upload payload. Please retry with a smaller image.',
      });
    }
    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        reason: 'Decoded upload payload is empty.',
      });
    }
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, reason: 'Image must be under 10MB.' });
    }
    const allowedImageMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const allowedAudioMime = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/aac',
      'audio/x-m4a',
      'audio/m4a',
    ];
    const detectedMime = core.detectBufferContentType(buffer);
    if (!detectedMime) {
      return res.status(400).json({
        success: false,
        reason: 'Unrecognized file content. Only valid images or chat audio are allowed.',
      });
    }
    const sanitizedFolder = String(folder || 'vehicles').replace(/[^a-zA-Z0-9@._\-/]/g, '').slice(0, 120);
    const isChatFolder = sanitizedFolder.startsWith('chat-messages');
    const isImageMime = allowedImageMime.includes(detectedMime);
    const isAudioMime =
      allowedAudioMime.includes(detectedMime) || detectedMime === 'audio/mp4';
    if (isChatFolder) {
      if (!isImageMime && !isAudioMime) {
        return res.status(400).json({
          success: false,
          reason:
            'Only images (JPEG, PNG, WebP) or voice (WebM, MP4, OGG, etc.) are allowed in chat uploads.',
        });
      }
    } else if (!isImageMime) {
      return res.status(400).json({
        success: false,
        reason: 'Only JPEG, PNG and WebP images are allowed.',
      });
    }
    const allowedFolderPrefixes = ['vehicles', 'chat-messages', 'listings', 'profiles'];
    const folderBase = sanitizedFolder.split('/')[0] || 'vehicles';
    if (!allowedFolderPrefixes.includes(folderBase) && !folderBase.includes('@')) {
      return res.status(400).json({
        success: false,
        reason: 'Invalid upload folder.',
      });
    }
    const uploaderEmail = uploadAuth.user?.email?.toLowerCase().trim() || '';
    const emailPrefix = uploaderEmail.replace(/[^a-zA-Z0-9@._-]/g, '');
    if (emailPrefix && folderBase !== 'vehicles' && folderBase !== 'chat-messages') {
      if (!sanitizedFolder.startsWith(`${emailPrefix}/`) && sanitizedFolder !== emailPrefix) {
        return res.status(403).json({
          success: false,
          reason: 'Upload folder must be scoped to your account.',
        });
      }
    }
    if (folderBase === 'chat-messages' && emailPrefix) {
      const chatPrefix = `chat-messages/${emailPrefix}`;
      if (!sanitizedFolder.startsWith(chatPrefix) && sanitizedFolder !== 'chat-messages') {
        return res.status(403).json({
          success: false,
          reason: 'Chat uploads must use your account folder.',
        });
      }
    }
    const mime = detectedMime;
    const timestamp = Date.now();
    const randomStr = core.randomBytes(8).toString('hex');
    let ext = (fileName.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '');
    if (allowedAudioMime.includes(mime)) {
      if (!ext || ext === 'jpg' || ext === 'jpeg') {
        if (mime.includes('webm')) ext = 'webm';
        else if (mime.includes('mp4') || mime.includes('m4a')) ext = 'm4a';
        else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';
        else if (mime.includes('ogg')) ext = 'ogg';
        else if (mime.includes('wav')) ext = 'wav';
        else ext = 'webm';
      }
    }
    const storageFileName = `${timestamp}_${randomStr}.${ext}`;
    const filePath = `${sanitizedFolder}/${storageFileName}`;
    const supabase = core.getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, buffer, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });
    if (error) {
      core.logError('Upload image API error:', error);
      return res.status(500).json({
        success: false,
        reason: core.errorToPublicMessage(error),
      });
    }
    const { data: urlData } = supabase.storage.from('Images').getPublicUrl(filePath);
    return res.status(200).json({
      success: true,
      url: urlData.publicUrl,
      imageId: filePath,
    });
  } catch (err) {
    core.logError('handleUploadImage error:', err);
    return res.status(500).json({ success: false, reason: core.errorToPublicMessage(err) });
  }
}

// Seed handler - preserves exact functionality from seed.ts
async function handleSeed(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }

  // SECURITY: Require secret key for seeding - never use default in production
  const secretKey = req.headers['x-seed-secret'] || req.body?.secretKey;
  const validSecret = process.env.SEED_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const isLocalDev =
    process.env.NODE_ENV === 'development' && String(process.env.VERCEL || '') !== '1';
  
  // Require valid secret key everywhere except local dev
  if (!isLocalDev) {
    if (!validSecret) {
      core.logError('❌ SEED_SECRET_KEY not configured in production');
      return res.status(503).json({
        success: false,
        reason: 'Seeding is disabled in production without SEED_SECRET_KEY configuration.'
      });
    }
    if (!secretKey || secretKey !== validSecret) {
      return res.status(403).json({
        success: false,
        reason: 'Invalid or missing secret key for production seeding. Provide x-seed-secret header or secretKey in body.'
      });
    }
  }

  if (!core.USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      message: 'Firebase is not configured. Cannot seed data.',
      fallback: true
    });
  }

  try {
    const users = await core.seedUsers(isProduction ? secretKey : undefined);
    const vehicles = await core.seedVehicles();
    
    // SECURITY: Don't return credentials in response - they should be logged separately or retrieved via admin panel
    return res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      data: { 
        users: { inserted: users.length }, 
        vehicles: { inserted: vehicles.length } 
      }
      // SECURITY: Credentials removed from response - use admin panel to view user details
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Seeding failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Vehicle Data handler - preserves exact functionality from vehicle-data.ts
async function handleVehicleData(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  // Ensure JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  const defaultData = {
    FOUR_WHEELER: [
      {
        name: "Maruti Suzuki",
        models: [
          { name: "Swift", variants: ["LXi", "VXi", "VXi (O)", "ZXi", "ZXi+"] },
          { name: "Baleno", variants: ["Sigma", "Delta", "Zeta", "Alpha"] }
        ]
      }
    ],
    TWO_WHEELER: [
      {
        name: "Honda",
        models: [
          { name: "Activa 6G", variants: ["Standard", "DLX", "Smart"] }
        ]
      }
    ]
  };

  if (!core.USE_SUPABASE && req.method === 'GET') {
    res.setHeader('X-Data-Fallback', 'true');
    return res.status(200).json(defaultData);
  }

  try {
    if (req.method === 'GET') {
      try {
        const fromSupabase = await core.readVehicleCatalogFromSupabase();
        if (fromSupabase) {
          return res.status(200).json(fromSupabase);
        }
        const vehicleData = await core.adminRead<{ data: typeof defaultData }>(core.DB_PATHS.VEHICLE_DATA, 'default');
        if (vehicleData && vehicleData.data) {
          return res.status(200).json(vehicleData.data);
        }
        
        await core.adminCreate(core.DB_PATHS.VEHICLE_DATA, { data: defaultData }, 'default');
        return res.status(200).json(defaultData);
      } catch (dbError) {
        core.logWarn('⚠️ Database connection failed for vehicle-data, returning default data:', dbError);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json(defaultData);
      }
    }

    if (req.method === 'POST') {
      try {
        if (!(await core.requireAdmin(req, res, 'Vehicle data update'))) {
          return;
        }
        const sbResult = await core.writeVehicleCatalogToSupabase(req.body);
        if (!sbResult.skipped && !sbResult.ok) {
          return res.status(500).json({
            success: false,
            reason: sbResult.error || 'Failed to save vehicle catalog to Supabase.',
          });
        }

        if (sbResult.ok) {
          core.logInfo('✅ Vehicle catalog saved to Supabase (app_config.vehicle_data)');
          try {
            await core.adminUpdate(core.DB_PATHS.VEHICLE_DATA, 'default', {
              data: req.body,
              updatedAt: new Date().toISOString()
            });
          } catch (mirrorErr) {
            core.logWarn('⚠️ Legacy DB mirror failed after Supabase save:', mirrorErr);
          }
          return res.status(200).json({ 
            success: true, 
            data: req.body,
            message: 'Vehicle data updated successfully',
            timestamp: new Date().toISOString(),
            storage: 'supabase'
          });
        }

        await core.adminUpdate(core.DB_PATHS.VEHICLE_DATA, 'default', {
          data: req.body,
          updatedAt: new Date().toISOString()
        });
        
        core.logInfo('✅ Vehicle data saved successfully to legacy store');
        return res.status(200).json({ 
          success: true, 
          data: req.body,
          message: 'Vehicle data updated successfully',
          timestamp: new Date().toISOString(),
          storage: 'legacy'
        });
      } catch (dbError) {
        core.logWarn('⚠️ Database connection failed for vehicle-data save:', dbError);
        
        core.logInfo('📝 Returning success with fallback indication for POST request');
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          data: req.body,
          message: 'Vehicle data processed (database unavailable, using fallback)',
          fallback: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Ultimate fallback - catch any unexpected errors
    core.logError('⚠️ Unexpected error in handleVehicleData:', error);
    res.setHeader('X-Data-Fallback', 'true');
    if (req.method === 'GET') {
      return res.status(200).json(defaultData);
    } else {
      return res.status(200).json({
        success: true,
        data: req.body || {},
        message: 'Vehicle data processed (error occurred, using fallback)',
        fallback: true,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Note: In-memory caching is removed for serverless compatibility
// Each function invocation will load fresh data from constants
// For production, consider using Vercel KV or Redis for caching

async function getFallbackVehicles(): Promise<core.VehicleType[]> {
  // Never serve demo inventory — return empty so clients show a proper empty/error state.
  return [];
}

async function getFallbackUsers(): Promise<core.NormalizedUser[]> {
  return [];
}

// Helper functions
function calculateTrustScore(user: any): number {
  let score = 50; // Base score
  
  const plan = user.subscriptionPlan || user.plan;
  if (user.isVerified) score += 20;
  if (plan === 'premium') score += 15;
  if (plan === 'pro') score += 10;
  if (user.status === 'active') score += 10;
  
  return Math.min(100, score);
}

function getPopularMakes(vehicles: core.VehicleType[]): string[] {
  const makeCounts: { [key: string]: number } = {};
  vehicles.forEach(v => {
    makeCounts[v.make] = (makeCounts[v.make] || 0) + 1;
  });
  
  return Object.entries(makeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([make]) => make);
}

function getPriceRange(vehicles: core.VehicleType[]): { min: number; max: number } {
  if (vehicles.length === 0) return { min: 0, max: 0 };
  
  const prices = vehicles.map(v => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };
}

// AI handler - consolidates ai.ts

export {
  handleUsers,
  handleVehicles,
  handleVehicleSpecs,
  handleUploadImage,
  handleSeed,
  handleVehicleData,
};
