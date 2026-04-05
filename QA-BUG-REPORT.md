# ReRide — Comprehensive QA Bug Report

**Project:** ReRide (Used Cars, New Cars, Dealers, Car Services Marketplace)  
**Platforms:** Web (Vite + React 19) + Android (Capacitor 8)  
**Production URL:** https://www.reride.co.in  
**Date:** April 5, 2026  
**Total Issues Found:** 203  

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 15 | Security vulnerabilities, data loss, application crashes |
| **HIGH** | 56 | Significant bugs, auth bypasses, broken features |
| **MEDIUM** | 96 | UI bugs, validation gaps, performance issues |
| **LOW** | 36 | Code quality, minor UX, dead code |

### Top 5 Showstoppers

1. **OAuth login bypass** — Anyone can impersonate any user by sending a POST to `/api/login` with `action: oauth-login` and any email. No OAuth token verification.
2. **Role elevation via API** — Any authenticated user can promote themselves to admin via `PUT /api/users` (no field allowlist).
3. **Hashed passwords sent to client** — `supabase-user-service.ts` includes `password` field in User objects returned to the browser.
4. **4.6 MB single JavaScript bundle** — IIFE build format disables all code-splitting. Initial page load downloads entire app.
5. **Offline messages permanently lost** — `syncPendingMessages()` in `realtimeChatService.ts` has an empty loop body; queued messages are silently discarded.

---

## SECTION 1: CRITICAL ISSUES (15)

### 1.1 Security — Authentication Bypass

| ID | File | Description |
|----|------|-------------|
| C-01 | `api/main.ts` ~L1568-1687 | **OAuth login impersonation.** The `oauth-login` action accepts `email`, `name`, `role` from the request body and creates/returns JWT tokens WITHOUT verifying the caller actually authenticated via OAuth. Any attacker can POST `{ action: "oauth-login", email: "victim@gmail.com", role: "seller" }` and receive valid tokens. |
| C-02 | `api/main.ts` ~L2590-2602 | **Role elevation via PUT /users.** The update handler copies all `updateData` fields without filtering sensitive fields (`role`, `isVerified`, `status`, `subscriptionPlan`, `featuredCredits`). Any authenticated user can set their own role to `admin`. |
| C-03 | `api/main.ts` ~L1186-1214 | **Plain text password comparison.** When bcrypt validation fails, the code falls back to `user.password.trim() === sanitizedData.password.trim()` — a timing-attack-vulnerable plain text comparison. |
| C-04 | `api/main.ts` ~L1097-1143 | **Hardcoded test users in production.** If `NODE_ENV` or `VERCEL_ENV` is not explicitly `production`, login attempts with `seller@test.com` / `password123` auto-create accounts. Preview/staging deployments are exploitable. |

### 1.2 Security — Missing Authorization

| ID | File | Description |
|----|------|-------------|
| C-05 | `api/main.ts` ~L5234-5293 | **`handleNewCars` — No auth on any method.** GET/POST/PUT/DELETE are all unauthenticated. Anyone can CRUD the new car catalog. |
| C-06 | `api/main.ts` ~L6035-6131 | **FAQ CRUD — No auth.** Anyone can create, update, or delete FAQs without authentication. |
| C-07 | `api/main.ts` ~L6358-6547 | **`handleSellCar` — No auth.** All methods (GET/POST/PUT/DELETE) are unauthenticated. |
| C-08 | `api/main.ts` ~L6586-6838 | **`handlePayments` — No auth.** Create, approve, and reject payment requests are all unauthenticated. Anyone can approve payments. |
| C-09 | `api/main.ts` ~L5811-5884 | **Gemini AI proxy — No auth.** `/api/gemini` has no authentication. Anyone can abuse the server's API key, causing cost overruns. |

### 1.3 Data Loss & Crashes

| ID | File | Description |
|----|------|-------------|
| C-10 | `services/realtimeChatService.ts` ~L312-323 | **Offline messages lost.** `syncPendingMessages()` iterates pending messages but the `forEach` body is empty. All offline-queued messages are silently discarded on reconnect. |
| C-11 | `services/supabase-user-service.ts` ~L26 | **Passwords sent to client.** `supabaseRowToUser()` includes `password: row.password` in User objects. Hashed passwords are exposed to the browser. |
| C-12 | `components/Dashboard.tsx` ~L1988 | **Rules of Hooks violation.** `useEffect` called after conditional returns. React will crash in StrictMode. Multiple hooks (useState, useMemo, useCallback, useEffect) are called conditionally throughout this file. |
| C-13 | `components/BulkUploadModal.tsx` ~L13-28 | **CSV parser breaks on quoted fields.** `line.split(',')` doesn't handle commas inside quotes. The template itself includes `"Sunroof, Alloy Wheels"` which would break its own parser. |
| C-14 | `vite.config.ts` ~L28 | **IIFE format disables code splitting.** Non-Capacitor builds use `format: 'iife'`, producing a single 4.6 MB bundle. All `React.lazy()` calls are rendered useless. |
| C-15 | `scripts/complete-supabase-schema.sql` ~L593-678 | **All RLS policies commented out.** RLS is enabled but with zero policies, client-side anon key queries return empty results. App relies entirely on service role key bypass. |

---

## SECTION 2: HIGH SEVERITY ISSUES (56)

### 2.1 Security & Auth (12)

| ID | File | Description |
|----|------|-------------|
| H-01 | `api/main.ts` ~L518-533 | **CSRF bypass via header spoofing.** CSRF is skipped when `x-app-client: capacitor` + `Origin: http://localhost`. Any attacker can forge these headers. |
| H-02 | `api/main.ts` ~L1713-1716 | **Refresh token not rotated.** Same refresh token returned on refresh — stolen tokens provide indefinite access. |
| H-03 | `api/main.ts` ~L4950-5006 | **`/api/seed` — No user auth.** Only checks optional `SEED_SECRET_KEY`. In non-production, anyone can seed/overwrite the database. |
| H-04 | `api/main.ts` ~L5546-5628 | **Test endpoints have no auth.** `/utils/test-connection` and `/utils/test-firebase-writes` perform DB operations without authentication. |
| H-05 | `utils/security.ts` ~L212-226 | **Token refresh ignores user status.** `refreshAccessToken` doesn't check if the user still exists or is active. Deleted users' tokens remain valid. |
| H-06 | `utils/security-config.ts` ~L30 | **Dev JWT secret is hardcoded.** `'dev-only-secret-not-for-production'` — preview deployments use this if `NODE_ENV` isn't `production`. Anyone knowing this can forge JWTs. |
| H-07 | `api/main.ts` ~L517 | **PATCH bypasses CSRF.** `isStateChanging` only checks POST/PUT/DELETE. PATCH requests skip CSRF validation entirely. |
| H-08 | `vercel.json` ~L90 | **CSP allows `unsafe-eval`.** `script-src` includes `'unsafe-inline' 'unsafe-eval'`, effectively nullifying XSS protection. |
| H-09 | `api/main.ts` ~L4405-4510 | **Vehicle creation mass assignment.** `...req.body` spread allows attacker to inject `status: 'published'`, `isFeatured: true`, `views: 999999`. |
| H-10 | `api/main.ts` ~L4503-4511 | **Vehicle ID is `Date.now()`.** Predictable, not unique under concurrency. Two simultaneous creates will collide. |
| H-11 | `vercel.json` ~headers | **Camera permission denied.** `Permissions-Policy: camera=()` blocks camera, but `mobileFeatures.ts` has camera capture functionality. |
| H-12 | `services/supabase-user-service.ts` ~L393-415 | **PII logged in production.** Sample user data including emails logged to console/Vercel logs. |

### 2.2 React Hooks Violations (7)

These will cause crashes in React StrictMode and unpredictable behavior in production.

| ID | File | Violations |
|----|------|------------|
| H-13 | `components/Dashboard.tsx` | **18 hooks violations** — useEffect, useState, useMemo, useCallback all called after conditional returns (lines 1988-2630) |
| H-14 | `components/SellerProfilePage.tsx` | **10 hooks violations** — useState, useMemo called conditionally (lines 36-92) |
| H-15 | `components/MobileSellerProfilePage.tsx` | **5 hooks violations** — useState, useMemo called conditionally (lines 58-83) |
| H-16 | `components/PaymentStatusCard.tsx` | **3 hooks violations** — useState, useEffect called conditionally (lines 15-35) |
| H-17 | `components/AdvancedFilters.tsx` | **3 hooks violations** — useMemo, useEffect called conditionally (lines 50-154) |
| H-18 | `components/Comparison.tsx` | **1 hook violation** — useMemo called conditionally (line 78) |
| H-19 | `utils/viewportZoom.ts` | **1 hook violation** — useEffect called conditionally (line 90) |

### 2.3 Chat & Real-Time (10)

| ID | File | Description |
|----|------|-------------|
| H-20 | `components/ChatWidget.tsx` ~L99-101 | **`onMarkMessagesAsRead` fires every render.** Conversation object reference changes trigger excessive API calls. |
| H-21 | `components/ChatWidget.tsx` ~L77-83 | **Chat auto-reopens after minimize.** New messages re-expand the minimized widget because `userManuallyClosed` not set on minimize. |
| H-22 | `hooks/useSupabaseRealtime.ts` | **Subscription thrashing.** Inline callback deps cause tear-down/re-subscribe on every render cycle. |
| H-23 | `services/realtimeChatService.ts` | **`joinConversation` resolves twice.** Both `once('connect')` and `setTimeout` call `resolve()`. Listener leaks after timeout. |
| H-24 | `services/realtimeChatService.ts` | **`isConnecting` blocks permanently.** Concurrent callers return `false` immediately with no retry or shared promise. |
| H-25 | `components/SupportChatWidget.tsx` | **No WebSocket reconnection.** On `onclose`, user sees "Connecting..." forever. No reconnect attempt. |
| H-26 | `components/SupportChatWidget.tsx` | **Stale socket closure.** `handleSendMessage` captures old dead socket reference after reconnect. |
| H-27 | `services/syncService.ts` | **Race condition in sync queue.** Two concurrent `processSyncQueue()` calls read same queue; second write overwrites first's results. |
| H-28 | `services/syncService.ts` | **Sync queue never triggered.** No `online` event listener, no `setInterval`. Failed items sit in localStorage forever. |
| H-29 | `services/supabase-conversation-service.ts` ~L628 | **Message add requires 2 full reads.** Every `addMessage` loads entire conversation twice. Extremely slow for long conversations. |

### 2.4 Component Bugs (12)

| ID | File | Description |
|----|------|-------------|
| H-30 | `components/Dashboard.tsx` ~L71 | **Invisible tooltip text.** `bg-white text-white` — white text on white background. |
| H-31 | `components/Dashboard.tsx` ~L1129 | **Direct DOM access.** `document.getElementById('document-type')` in a React component — can return `null` and crash. |
| H-32 | `components/AdminPanel.tsx` ~L2776, 2792 | **Missing `await` on plan mutations.** Race condition: stale data fetched before write completes. |
| H-33 | `components/AdminPanel.tsx` ~L694 vs L431 | **Plan listing limit inconsistency.** Edit allows 0 listings (sellers blocked), but Add requires ≥ 1. |
| H-34 | `components/VehicleList.tsx` ~L683-719 | **Stale closure in AI search.** `handleAiSearch` captures empty `uniqueMakes` and `allFeatures`. |
| H-35 | `components/VehicleDetail.tsx` ~L367-372 | **Pros/Cons generator — no error handling.** On failure, `isGeneratingProsCons` stays `true` forever (perpetual spinner). |
| H-36 | `components/SellCarPage.tsx` ~L211-245 | **Fake login — no actual auth.** `handleLogin` uses `setTimeout` to simulate login. Any credentials pass. |
| H-37 | `components/Profile.tsx` ~L575-622 | **False-positive logout.** Password change error handler clears all auth tokens on suspected auth errors, then force-reloads. |
| H-38 | `components/CustomerInbox.tsx` ~L125 | **Mobile layout broken.** No toggle between conversation list and chat view on mobile — chat is below the fold. |
| H-39 | `components/MobilePushNotificationManager.tsx` ~L38-57 | **Notifications re-shown.** Effect fires on every `notifications` change, re-showing old unread notifications as system notifications. |
| H-40 | `services/supabase-vehicle-service.ts` ~L131 | **Metadata overwrites vehicle fields.** `...meta` spread can replace explicit fields like `id`, `price`, `status` if present in metadata. |
| H-41 | `services/supabase-conversation-service.ts` ~L628 | **Race condition on concurrent messages.** Two simultaneous `addMessage` calls for the same conversation; second write drops the first message. |

### 2.5 API Routing & Data (8)

| ID | File | Description |
|----|------|-------------|
| H-42 | `api/main.ts` ~L728-736 | **Unmatched routes default to `handleUsers`.** Any unrecognized path silently routes to user handler instead of 404. |
| H-43 | `api/main.ts` ~L606-621 | **PUT with email → user update.** A PUT to `/api/payments` with an `email` field could trigger user updates via fallback routing. |
| H-44 | `api/service-requests.ts` ~L55-57 | **`scope=all` leaks all service requests.** Any authenticated user can see every service request. |
| H-45 | `api/provider-services.ts` ~L18-23 | **Mock provider ID in dev.** `x-mock-provider-id` header accepted when `NODE_ENV` is unset. |
| H-46 | `lib/db.ts` (MongoDB) | **Legacy MongoDB still importable.** Can create dual-database situation if any code path imports it. |
| H-47 | `api/main.ts` ~L2924 | **`listUsers()` fetches ALL users.** No pagination — times out with large user bases. |
| H-48 | `services/supabase-vehicle-service.ts` ~L214 | **Vehicle ID collision.** `Date.now()` IDs collide under concurrent serverless invocations. |
| H-49 | `vite.config.ts` | **No content hash in filenames.** Combined with `immutable` cache header (1 year), users receive stale JS after deployments. |

### 2.6 Build & Test Infrastructure (7)

| ID | File | Description |
|----|------|-------------|
| H-50 | Build output | **4,627 KB single bundle.** Vite warns about chunk size > 500 KB. All 1101 modules in one file. |
| H-51 | Jest | **5 of 8 test suites fail.** `import.meta` not supported in Jest environment; `TextEncoder` not defined. Tests are not runnable. |
| H-52 | TypeScript | **1 type error.** `MobileVehicleCard.tsx:167` — condition always true (function reference check instead of function call). |
| H-53 | ESLint | **692 errors, 1371 warnings.** 2063 total problems across the codebase. |
| H-54 | ESLint | **41 Rules of Hooks violations** across 7 files (see H-13 through H-19). |
| H-55 | `tailwind.config.js` ~L5 | **Content paths miss source files.** `./src/**/*` scanned but source is in project root. Files in `services/`, `hooks/`, `utils/`, `api/` missed. |
| H-56 | `tailwind.config.js` | **Color naming mismatch.** `reride-orange` is actually blue (`#2563EB`). `gradient-orange` is a blue gradient. |

---

## SECTION 3: MEDIUM SEVERITY ISSUES (96)

### 3.1 Security (15)

| ID | File | Description |
|----|------|-------------|
| M-01 | `api/main.ts` ~L276-333 | In-memory rate limiting is per-instance; ineffective in serverless (resets on cold start). |
| M-02 | `api/main.ts` ~L166-170 | Error messages leak server configuration details (`JWT_SECRET is missing`, Supabase config hints). |
| M-03 | `api/main.ts` ~L1798 | OTP generated via `Math.random()` — not cryptographically secure. Should use `crypto.randomInt()`. |
| M-04 | `api/main.ts` ~L2083 | OTP hash comparison uses `!==` — timing-attack vulnerable. Should use `crypto.timingSafeEqual`. |
| M-05 | `utils/csrf.ts` ~L35 | CSRF token comparison uses `===` — timing-attack vulnerable. |
| M-06 | `utils/security.ts` ~L113-119 | Token expiry override: if configured < 1 min, silently extended to 48h. Masks configuration errors. |
| M-07 | `utils/security.ts` ~L256-259 | `sanitizeObject` HTML-sanitizes object keys, causing silent data corruption. |
| M-08 | `contexts/AuthContext.tsx` ~L81 | Full User object stored in localStorage. XSS could exfiltrate sensitive fields. |
| M-09 | `contexts/AuthContext.tsx` ~L51-75 | No session expiration check on restore. Months-old sessions restored as valid. |
| M-10 | `utils/authenticatedFetch.ts` ~L49 | CSRF token cached indefinitely. Token rotation causes 403 errors until page refresh. |
| M-11 | `api/auth.ts` ~L34 | `role: decoded.role || 'customer'` — no runtime validation. `role: "superadmin"` would pass through. |
| M-12 | `services/realtimeChatService.ts` | `userEmail` and `userRole` sent in WebSocket query string. Visible in logs and proxies. |
| M-13 | `services/notificationService.ts` | JWT payload decoded with `atob` but signature never validated for authorization guard. |
| M-14 | `services/imageUploadService.ts` ~L141 | Auth check reads localStorage directly — attackers can set arbitrary values. |
| M-15 | `services/paymentService.ts` | `adminEmail` passed as query parameter — API trusts client-provided email for admin access. |

### 3.2 Validation Gaps (18)

| ID | File | Description |
|----|------|-------------|
| M-16 | `components/UnifiedLogin.tsx` | No programmatic email format validation before login/register calls. |
| M-17 | `components/UnifiedLogin.tsx` | No mobile number format validation — `type="tel"` accepts any string. |
| M-18 | `components/UnifiedLogin.tsx` | No password strength enforcement on registration. |
| M-19 | `components/Dashboard.tsx` | `validateField` only covers 5 of 15+ fields. Category, state, city, email, description never validated. |
| M-20 | `components/Dashboard.tsx` | File upload `accept` excludes WebP and HEIC (common on modern iOS). |
| M-21 | `components/Dashboard.tsx` | Offer date fields not validated — start can be after end; dates can be in the past. |
| M-22 | `components/EditVehicleModal.tsx` | Only 5 fields validated. Category, fuelType, transmission, color skipped. |
| M-23 | `components/EditVehicleModal.tsx` | Offer dates not validated (start < end, future dates). |
| M-24 | `components/BulkUploadModal.tsx` | No file size limit check — large CSVs could freeze browser. |
| M-25 | `components/BulkUploadModal.tsx` | `category` field cast directly to `VehicleCategory` with no enum validation. |
| M-26 | `components/ChatWidget.tsx` ~L118-126 | No message length validation. Only checks `!inputText.trim()`. |
| M-27 | `components/PaymentRequestModal.tsx` | Transaction ID — no format validation (UPI, bank ref, etc.). |
| M-28 | `components/ServiceCart.tsx` | Car details year/fuel fields accept any string — no format validation. |
| M-29 | `components/Login.tsx` | No email format or password strength validation — only non-empty check. |
| M-30 | `components/Profile.tsx` ~L323-336 | `validateImageFile` includes `application/pdf` but error message only mentions images. |
| M-31 | `api/service-requests.ts` ~L82 | `status` field from user input cast without validation against valid values. |
| M-32 | `api/services.ts` ~L176 | `req.body` spread directly to Supabase update — mass assignment vulnerability. |
| M-33 | `api/main.ts` ~L536-540 | Manual cookie parsing with `.split('=')[1]` — truncates values containing `=`. |

### 3.3 UI & Styling Bugs (22)

| ID | File | Description |
|----|------|-------------|
| M-34 | `components/Dashboard.tsx` ~L1629 | Cancel button: `bg-white0` (invalid) + `text-white` — invisible button. |
| M-35 | `components/Dashboard.tsx` | Invalid Tailwind class `dark:border-gray-200-300` used throughout. |
| M-36 | `components/ChatWidget.tsx` ~L33-35 | `TypingIndicator` dots: `bg-white0` (invalid class) — dots invisible. |
| M-37 | `components/ChatWidget.tsx` ~L294 | Floating button `w-16 h-14` — oval instead of circular with `rounded-full`. |
| M-38 | `components/VehicleDetail.tsx` | Invalid CSS classes `border-gray-200-200`, `border-gray-200-100` throughout. |
| M-39 | `components/VehicleDetail.tsx` ~L239-243 | `scoreColor` returns same color for score ≥ 90 and < 75 — indistinguishable in UI. |
| M-40 | `components/VehicleDetail.tsx` ~L959-961 | Location fallback produces `", Karnataka"` or `"Bangalore, "` (malformed strings). |
| M-41 | `components/AdminPanel.tsx` ~L300-301 | Approve/Reject buttons both `text-reride-orange` — visually identical. |
| M-42 | `components/VehicleList.tsx` | Mobile filter badge shows applied filter count, not temp selection count. |
| M-43 | `components/VehicleList.tsx` | Dual range slider thumbs overlap; max slider always wins via z-index. |
| M-44 | `components/CustomerInbox.tsx` ~L35 | `isOfferModalOpen` state exists but never triggered — dead code. |
| M-45 | `components/CustomerInbox.tsx` | Fixed `h-[calc(100vh-220px)]` assumes specific header height. |
| M-46 | `components/EditVehicleModal.tsx` ~L253 | `FormInput` component defined inside render — re-created every render, losing focus on keystroke. |
| M-47 | `components/PaymentRequestModal.tsx` | Uses `alert()` for success/error — blocking browser dialog in payment flow. |
| M-48 | `components/PaymentRequestModal.tsx` | Payment proof is a text field expecting a "screenshot URL" — should be file upload. |
| M-49 | `components/LocationModal.tsx` | Modal `absolute top-4` instead of centered — may be off-screen on short viewports. |
| M-50 | `components/SellCarPage.tsx` | Uses `alert()` for wizard step feedback — blocking dialogs. |
| M-51 | `components/SellCarPage.tsx` | Brand logos loaded from `logos-world.net` and `clearbit.com` — single points of failure. |
| M-52 | `components/VehicleDetail.tsx` ~L126-155 | Bank logos hardcoded from `logos-world.net` — external dependency. |
| M-53 | `components/NotificationCenter.tsx` | "View All" button has no `onClick` handler — non-functional button. |
| M-54 | `components/NotificationCenter.tsx` | `timeAgo` uses `> 1` not `>= 1`: exactly 1 hour shows "60 minutes ago". |
| M-55 | `components/BulkUploadModal.tsx` ~L150, 187 | Invalid Tailwind `dark:border-gray-200-200`, `bg-white-dark`. |

### 3.4 Logic & State Management (20)

| ID | File | Description |
|----|------|-------------|
| M-56 | `components/Dashboard.tsx` ~L1050-1052 | `window.location.reload()` as data sync — loses unsaved state, possible infinite loop. |
| M-57 | `components/AdminPanel.tsx` ~L405 | `parseInt(value) || 0` silently converts non-numeric to 0, passes validation. |
| M-58 | `components/AdminPanel.tsx` ~L1891 | `ModerationQueueView` defined as function inside parent — re-created every render. |
| M-59 | `components/VehicleList.tsx` ~L987-1001 | Search debounce timeout not cleared on Enter — stale suggestions appear. |
| M-60 | `components/VehicleList.tsx` | localStorage vehicle cache has no shape validation. Corrupted data crashes runtime. |
| M-61 | `components/VehicleDetail.tsx` ~L417-475 | View tracking `useEffect` omits `updateVehicle` from deps — stale reference. |
| M-62 | `components/ChatWidget.tsx` ~L40 | `memo` wrapper is a no-op — receives object/callback props with new references each render. |
| M-63 | `components/ChatWidget.tsx` | Rapid minimize/expand causes 300ms timeout desync — re-minimizes widget. |
| M-64 | `components/BulkUploadModal.tsx` ~L132 | `handleConfirm` always closes modal even if `parsedData.length === 0` — no user feedback. |
| M-65 | `components/BulkUploadModal.tsx` ~L112 | Vehicle object partially constructed before `isNaN` validation check. |
| M-66 | `components/PaymentRequestModal.tsx` ~L46-52 | State reset after `onSuccess/onClose` — causes "state update on unmounted component" warning. |
| M-67 | `components/AppProvider.tsx` ~L99-111 | `mergeVehicleCatalog` skips updates if incoming array is "too small" — masks real deletions. |
| M-68 | `components/AppProvider.tsx` ~L48-66 | `mergeConversationMessages` sorts by `new Date()` string — inconsistent timezone handling. |
| M-69 | `components/AppProvider.tsx` ~L127-132 | `vehicleIdsEqual` — `Number()` treats `""`, `null`, `0` as equivalent. False positives. |
| M-70 | `components/SellCarPage.tsx` ~L177-184 | `useEffect` for model changes includes `make` as dep but resets `carDetails` — potential infinite loop. |
| M-71 | `components/SellCarPage.tsx` ~L253-274 | Registration verification is simulated with `setTimeout` — no actual backend call. |
| M-72 | `components/SellCarPage.tsx` ~L341 | `carDetails.transmission` vs `selectedTransmission` divergence — two sources of truth. |
| M-73 | `components/ServiceCart.tsx` ~L129-219 | 30-second polling effect with `[]` deps — stale closures for `items` and `servicePackages`. |
| M-74 | `components/ServiceCart.tsx` ~L357-363 | State setter called inside another state setter's callback — unpredictable batching. |
| M-75 | `components/Profile.tsx` ~L388-420 | Image compression `dataUrl.length * 0.75` estimation off by 10-15%. |

### 3.5 Real-Time & Mobile (12)

| ID | File | Description |
|----|------|-------------|
| M-76 | `services/realtimeChatService.ts` | `messageCallbacks` map grows unboundedly — no timeout cleanup for unresolved callbacks. |
| M-77 | `services/realtimeChatService.ts` | `connect()` returns `true` in most error paths — callers can't detect real connection state. |
| M-78 | `services/realtimeChatService.ts` | After max reconnect attempts, socket is nullified forever. No recovery without page refresh. |
| M-79 | `hooks/useSupabaseRealtime.ts` | On `CHANNEL_ERROR`/`TIMED_OUT`, broken channel remains with no retry. Subscription silently dead. |
| M-80 | `components/SupportChatWidget.tsx` | Both REST history and WebSocket history events call `setMessages(...)`, overwriting each other. |
| M-81 | `components/SupportChatWidget.tsx` | `loadChatHistory` called before `sessionId` is set. Anonymous users get no history. |
| M-82 | `services/syncService.ts` | No deduplication in sync queue — same conversation queued twice = duplicate API calls. |
| M-83 | `services/syncService.ts` | All sync items processed sequentially — 50 items at 500ms each = 25 seconds blocking. |
| M-84 | `services/syncService.ts` | Unbounded localStorage growth. Failed items accumulate; localStorage has ~5 MB limit. |
| M-85 | `utils/mobileFeatures.ts` ~L174 | `process.env.VITE_VAPID_PUBLIC_KEY` won't be replaced by Vite — push subscriptions silently fail. |
| M-86 | `components/MobilePushNotificationManager.tsx` ~L29-34 | Auto-subscribe never prompts for permission; silently does nothing. |
| M-87 | `utils/mobileFeatures.ts` | `capturePhoto` creates DOM elements never cleaned up — memory leak in long sessions. |

### 3.6 Database & Services (9)

| ID | File | Description |
|----|------|-------------|
| M-88 | `scripts/complete-supabase-schema.sql` | No composite index on `(customer_id, last_message_at)` for conversations — frequent query requires full scan. |
| M-89 | `scripts/complete-supabase-schema.sql` | `notifications.read` uses reserved word. Should be `is_read`. |
| M-90 | `scripts/complete-supabase-schema.sql` | `vehicles.id` is `TEXT` but app uses `Number(row.id)`. Non-numeric IDs produce `NaN`. |
| M-91 | `server/supabase-admin-db.ts` ~L66 | `adminReadAll()` fallback ID `String(Date.now())` — millisecond collisions overwrite records. |
| M-92 | `server/supabase-admin-db.ts` | `adminReadAll()` has no pagination — capped at 1000 rows by Supabase default. |
| M-93 | `services/supabase-vehicle-service.ts` ~L172-198 | `|| 0` / `|| null` — `year: 0` becomes `null`, `mileage: 0` becomes `null`. |
| M-94 | `services/supabase-vehicle-service.ts` ~L519 | `findByStatus()` selects columns that don't exist in schema — query may fail. |
| M-95 | `services/supabase-conversation-service.ts` | Messages stored in JSONB array inside `conversations.metadata`, not in the `messages` table. Dead schema, no SQL indexes usable. |
| M-96 | `lib/db.ts` ~L104-108 | `ensureDatabaseInUri()` forces database name to `'reride'`, overriding staging/test configs. |

---

## SECTION 4: LOW SEVERITY ISSUES (36)

### 4.1 Code Quality (15)

| ID | Description |
|----|-------------|
| L-01 | Firebase references in comments and variable names (`USE_SUPABASE`) throughout `api/main.ts`. |
| L-02 | Excessive `console.log` with emoji prefixes in production code (`Dashboard.tsx`, `VehicleDetail.tsx`, `LocationModal.tsx`). |
| L-03 | `utils/security-config.ts` — weak password policy: no uppercase or special chars required. |
| L-04 | `utils/authStorage.ts` — iterates all localStorage keys looking for Supabase tokens; injectable. |
| L-05 | `utils/authenticatedFetch.ts` — `atob` without error handling for malformed base64 JWTs. |
| L-06 | `api/main.ts` — dynamic `import()` calls add cold-start latency; could be static imports. |
| L-07 | `api/main.ts` — extensive use of `any` type reduces type safety. |
| L-08 | `api/vehicleCatalogSupabase.ts` — accepts `payload: unknown`, no schema validation before DB write. |
| L-09 | `api/main.ts` — registration retry loop blocks serverless function for up to 3 seconds. |
| L-10 | `api/main.ts` — background `Promise.all` fire-and-forget; updates lost if function terminates. |
| L-11 | `api/main.ts` — hardcoded fallback vehicle/user data returned on errors (stale data without indication). |
| L-12 | `services/syncService.ts` — `RETRY_DELAY = 5000` defined but never used. |
| L-13 | `utils/mobileFeatures.ts` — `substr` deprecated; should use `substring`. |
| L-14 | `utils/mobileFeatures.ts` — IndexedDB always version 1; no migration path. |
| L-15 | `api/main.ts` — IP fallback rate-limit key uses `user-agent + accept-language` — easily spoofable. |

### 4.2 Internationalization (8)

| ID | Description |
|----|-------------|
| L-16 | `components/CustomerInbox.tsx` — hardcoded English strings ("My Inbox", "No conversations yet"). |
| L-17 | `components/EditVehicleModal.tsx` — all UI strings hardcoded in English. |
| L-18 | `components/PaymentRequestModal.tsx` — all strings hardcoded in English. |
| L-19 | `components/AdminPanel.tsx` — many hardcoded English strings not using i18n. |
| L-20 | `components/Dashboard.tsx` — extensive hardcoded English strings. |
| L-21 | `components/VehicleDetail.tsx` — hardcoded English strings. |
| L-22 | `components/SellCarPage.tsx` — hardcoded English strings. |
| L-23 | `components/ServiceCart.tsx` — mock London addresses shown by default. |

### 4.3 Minor Bugs (13)

| ID | Description |
|----|-------------|
| L-24 | `components/UnifiedLogin.tsx` — missing space between toggle text and button (glued together). |
| L-25 | `components/UnifiedLogin.tsx` — `toggleMode` in OTP mode unexpectedly transitions OTP → login. |
| L-26 | `components/VehicleList.tsx` — body overflow forced to `auto` on cleanup, conflicting with other components. |
| L-27 | `components/EditVehicleModal.tsx` — `qualityReport` non-null assertion can crash if undefined. |
| L-28 | `components/LocationModal.tsx` — `findNearestCity` only considers 8 cities — misleading for remote locations. |
| L-29 | `components/LocationModal.tsx` — `filteredCities` capped at 80 with no UI indication of truncation. |
| L-30 | `components/LocationModal.tsx` — Nominatim geocoding API called without proper contact email in User-Agent. |
| L-31 | `components/Profile.tsx` — data deletion uses `fetch()` directly instead of `authenticatedFetch`, missing auth headers. |
| L-32 | `components/ServiceCart.tsx` — `SERVICE_PACKAGE_TO_CATEGORY` defined inside component body, recreated every render. |
| L-33 | `components/SupportChatWidget.tsx` — `Date.now()` message IDs can collide on rapid sends. |
| L-34 | `hooks/useSupabaseRealtime.ts` — channel name collision risk from filter sanitization. |
| L-35 | `capacitor.config.ts` — splash screen 500ms too short, blank screen on slow devices. |
| L-36 | `services/paymentService.ts` — fallback `PaymentRequest` with only `id` field causes downstream errors. |

---

## SECTION 5: BUILD & TEST INFRASTRUCTURE

### 5.1 Production Build

| Metric | Value | Status |
|--------|-------|--------|
| Bundle size | **4,627 KB** (955 KB gzipped) | FAIL — exceeds 500 KB recommended limit by 9x |
| Code splitting | **Disabled** (IIFE format) | FAIL — all React.lazy() calls are no-ops |
| Cache busting | **No content hashes** in filenames | FAIL — stale files served for up to 1 year |
| Build time | 51.02 seconds | OK |
| Build warnings | 1 (chunk size) | Expected |
| Browserslist | 6 months out of date | WARNING |

### 5.2 Unit Tests (Jest)

| Metric | Value | Status |
|--------|-------|--------|
| Test suites | 3 passed, **5 failed**, 8 total | FAIL |
| Tests | 65 passed, 65 total | OK (in passing suites) |
| Failure reasons | `import.meta` not supported; `TextEncoder` not defined | Config issue |

**Failing test suites:**
1. `ErrorBoundary.test.tsx` — `import.meta` outside a module
2. `AppProvider.test.tsx` — `TextEncoder is not defined`
3. `firebase-auth.test.ts` — likely same issues
4. 2 others (same class of configuration problems)

### 5.3 Linting (ESLint)

| Metric | Value | Status |
|--------|-------|--------|
| Total problems | **2,063** | FAIL |
| Errors | **692** | FAIL |
| Warnings | **1,371** | WARNING |
| Rules of Hooks violations | **41** (across 7 files) | CRITICAL |
| Security warnings | 15+ (`detect-object-injection`) | MEDIUM |
| `no-console` warnings | 100+ | LOW |
| `no-explicit-any` warnings | 200+ | LOW |

### 5.4 TypeScript

| Metric | Value | Status |
|--------|-------|--------|
| Type errors | 1 (`MobileVehicleCard.tsx:167`) | MINOR |
| Error description | Condition always true (function reference vs function call) | |

---

## SECTION 6: RECOMMENDED FIX PRIORITY

### Phase 1: Emergency (Fix Immediately)

1. **C-01** — Add OAuth token verification in login endpoint
2. **C-02** — Add field allowlist for user updates (block `role`, `isVerified`, `status`)
3. **C-05/06/07/08/09** — Add `requireAuth`/`requireAdmin` to all unprotected mutation endpoints
4. **C-11** — Remove `password` field from `supabaseRowToUser()` return
5. **C-04** — Gate test user auto-creation behind strict `NODE_ENV === 'development'` check
6. **H-01** — Fix CSRF bypass by validating Origin more strictly

### Phase 2: Urgent (Fix This Sprint)

7. **C-14/H-50** — Switch from IIFE to ESM format in vite.config.ts to enable code splitting
8. **H-49** — Add `[hash]` to output filenames for cache busting
9. **C-12/H-13-19** — Fix all 41 Rules of Hooks violations (move hooks before conditionals)
10. **C-10** — Implement `syncPendingMessages()` body (offline message sync)
11. **H-20** — Debounce/guard `onMarkMessagesAsRead` in ChatWidget
12. **C-03** — Remove plain text password fallback
13. **H-02** — Implement refresh token rotation
14. **H-09** — Add field allowlist for vehicle creation

### Phase 3: Important (Fix This Month)

15. Fix all Medium validation gaps (M-16 through M-33)
16. Fix all invalid Tailwind classes (M-34 through M-55)
17. Implement WebSocket reconnection in SupportChatWidget
18. Fix sync queue race conditions
19. Add pagination to `adminReadAll()` and `listUsers()`
20. Fix Supabase Realtime subscription thrashing
21. Fix Jest configuration for `import.meta` support
22. Reduce ESLint errors from 692 to 0

### Phase 4: Quality (Ongoing)

23. Internationalize all hardcoded English strings
24. Remove all production `console.log` statements
25. Clean up legacy MongoDB code
26. Add proper form validation library (Zod/Yup)
27. Split `api/main.ts` monolith into separate Vercel functions
28. Split `AppProvider.tsx` (5,400 lines) into smaller contexts
29. Add RLS policies to Supabase schema
30. Add comprehensive E2E test coverage

---

*Report generated by automated code analysis. Manual verification recommended for all critical and high severity items.*
