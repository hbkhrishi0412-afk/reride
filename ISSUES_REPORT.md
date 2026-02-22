# Issues Report — ReRide Project

Generated from build, type-check, lint, and codebase scan.

---

## 1. Build (Vite) — Warnings

| Location | Issue |
|--------|--------|
| `constants/index.ts` | `constants/plans.ts` is both dynamically and statically imported; dynamic import will not move the module into another chunk. |
| `services/syncService.ts` | Same pattern: dynamically imported in App.tsx/AppProvider.tsx and elsewhere but also statically imported; chunking warning. |

**Suggestion:** Use either static or dynamic import consistently for these modules to avoid the warning and clarify intent.

---

## 2. TypeScript Errors (by file)

### App.tsx
- **Unused:** `logInfo`, `logError` (line 30); `MobileRentalPage` (210); `isMobile` (271).
- **Types:** `ApiResponse<Vehicle>` used without `alreadyFeatured` (1699, 1973); `ApiResponse<unknown>` missing `alreadyRequested`, `usedCertifications`, `remainingCertifications` (2065, 2078–2079, 2101, 2103).
- **Payload:** `originalMessageId` does not exist on the message/offer type (2143).
- **Assignment:** `ServiceProvider \| null` assigned where `Provider \| null` expected — `ServiceProvider` missing `email`, `phone` (2623).
- **Logic:** Comparison `"seller"` and `"customer"` has no overlap (3322, 3329).

### components/AdminServiceOps.tsx
- **Provider type:** `state`, `district`, `serviceCategories` do not exist on type `Provider` (443, 444, 452, 454).
- **Implicit any:** Parameters `cat`, `idx` in callback (454).

### components/AdvancedFilters.tsx
- **Unused:** `vehicleData` (30).
- **Operators:** `+` and `>` applied to `number | boolean` (183, 195).

### components/DashboardListings.tsx
- **Unused:** `VehicleCard`; props `onDeleteVehicle`, `onMarkAsSold`, `onFeatureListing`, `onRequestCertification` (3, 31–34).

### components/DashboardMessages.tsx
- **Unused:** `ChatWidget` (3).
- **Signature mismatch:** `sendMessage(conversationId, messageText, type?, payload?)` vs expected `(messageText, type?, payload?)` (151).

### components/DashboardOptimized.tsx
- **Unused:** `onUpdateVehicle`, `editingVehicle`, `sellerEmail`, `vehicleId` (multiple), and reference to undefined `onAddMultipleVehicles` (107).

### components/DashboardOverview.tsx
- **Unused:** `seller` (24).

### components/EditUserModal.tsx
- **VerificationStatus:** Partial objects with `emailVerified`/`phoneVerified` optional where type requires `boolean` (313, 352, 391).

### components/ErrorBoundary.tsx
- **Unused:** `React` (1).

### components/Header.tsx
- **Arity:** Two arguments passed where one expected (186, 193); unused `city` (198).

### components/Home.tsx
- **Unused:** `handleStartService` (124).

### components/ImportUsersModal.tsx
- **SubscriptionPlan:** `"basic"` not assignable to `SubscriptionPlan` (164).

### components/LazyImage.tsx
- **Property:** `error` does not exist on type `{ data: { publicUrl: string } }` (145).

### components/ListingLifecycleIndicator.tsx
- **Unused:** `getExpiryNotificationMessage` (3).

### components/MobileCityLandingPage.tsx
- **Unused:** `onViewSellerProfile` (32).
- **CityStats:** `avgPrice`, `brands` do not exist (67, 71).

### components/MobileDashboard.tsx
- **Unused:** `useMemo`, `useCallback`, `ListingLifecycleIndicator`, `PaymentStatusCard`, `conversationId`; expression always truthy (219); `vehicle.inquiriesCount` possibly undefined (955).

### components/MobileImageGallery.tsx
- **Style:** `WebkitUserDrag` not in Framer Motion `Properties` (151).

### components/MobileInbox.tsx
- **Unused:** `onUserTyping`, `onOfferResponse`, `currentUser`, `convId`; offer type missing `price`, `message` (169–171).

### components/MobilePushNotificationManager.tsx
- **Unused:** `unsubscribe`; type `Notification` missing `title`, `vehicleId`, `type` (45, 84, 85, 87, 90, 97, 100, 103).

### components/MobileSellerProfilePage.tsx
- **User:** `sellerAverageRating` / `sellerRatingCount` — suggest `averageRating`; unused vars (159, 163–164).

### components/MobileVehicleDetail.tsx, MobileVehicleCard.tsx, MobileWishlist.tsx, etc.
- **Unused:** Various props and variables (`onBack`, `onToggleCompare`, `currentUser`, `optimizeImageUrl`, `swipedId`, `vehicleId`, etc.).

### components/SellCarAdmin.tsx
- **State type:** `SellCarSubmission[]` from service has `_id?: string`; local state expects `_id: string` (59).

### components/SellCarPage.tsx
- **Unused:** `setPassword`, `showPassword`, `setShowPassword`, `loginError`, `isLoggingIn`, `hoveredBrand`, `setHoveredBrand`, `handleLogin`, `index` (multiple lines).

### components/ServiceDetail.tsx
- **Duplicate identifiers:** `fetchServices`, `getServicePricing`, `fallbackPricing` declared twice (3 and 199); unused `loadingPricing` (204).

### components/UnifiedLogin.tsx
- **Property:** `title` does not exist on type `never` (345, 639).

### components/VehicleCard.tsx, VehicleTile.tsx
- **Unused:** `StarRating`, `onQuickView`, `handleSellerClick`.

### components/VehicleDataManagement.tsx, VehicleFilterManagement.tsx
- **Unused:** `VehicleCategory`, `isLoading`, `setIsLoading`, `findCategoryKey`, `vehicleData`.

### components/VehicleList/VehicleListFilters.tsx
- **Unused:** `Vehicle`, `SearchFilters`, `CategoryEnum`; all destructured elements unused (62).

### services/buyerService.ts — Logic bug
- **Async misuse:** `getBuyerActivity(userId)` is async but used without `await` in `trackPriceDrop`, `clearPriceDropNotifications`, `getRecentlyViewed`. Code accesses `activity.notifications` and `activity.recentlyViewed` on a Promise, causing runtime errors.
- **Fix:** Use `await getBuyerActivity(userId)` (and make callers async) or use `getBuyerActivitySync(userId)` where sync is intended.

### services/buyerActivityService.ts
- **Type:** Argument type `string` has no properties in common with options object (67).

### services/dataService.ts
- **Unused:** `RATE_LIMIT_CACHE_DURATION`; `HeadersInit` indexing for `Authorization` (125).

### services/imageUploadService.ts
- **Unused:** `ImageData`, `getCurrentUserEmail`, `userEmail`, `data`, `convertFileToBase64`; `StorageError` has no `statusCode` (203).

### services/listingService.ts
- **Vehicle type:** `lastRefreshedAt`, `expiresAt` do not exist on type `Vehicle` (39, 49).

### services/planService.ts
- **SubscriptionPlan:** `string` not assignable to `SubscriptionPlan` (41).

### services/realtimeChatService.ts
- **Unused:** `saveConversationToSupabase`, `conversationId`, `message`; `SocketInstance` has no `once` (498).

### services/syncService.ts
- **Unused:** `RETRY_DELAY`, `removeFromSyncQueue` (16, 57).

### services/trustSafetyService.ts
- **Unused:** `conversations` (72).

### services/vehicleService.ts
- **Unused:** `getAuthHeader`, `user`, `handleResponse` (45, 55, 73).

### utils/monitoring.ts
- **Missing module:** `@sentry/react` not found (26).
- **Types:** Parameter `event` implicitly `any`; `Console` has no `warning` (32, 71).

### utils/validation.ts
- **Argument:** `unknown` not assignable to `Error | undefined` (287).

### utils/vehicleEnrichment.ts
- **Conversion:** Object missing many `Vehicle` properties; cast may be wrong (67).

### src/setupTests.ts
- **IntersectionObserver mock:** Type incompatible with global; element implicitly `any` (40, 57).

---

## 3. CI / Scripts

- **Lint & type-check job:** Will fail on `npm run type-check` due to the TypeScript errors above.
- **Format check:** May fail if Prettier is not run (not verified in this run).

---

## 4. TODO / Incomplete items

| File | Item |
|------|------|
| `utils/mobileFeatures.ts` | Replace placeholder with actual VAPID public key for push (line 174). |
| `utils/monitoring.ts` | Send to centralized logging service (line 156). |
| `api/chat-websocket.js` | Placeholder support contact text. |
| Debug endpoints | Several files use `DEBUG_ENDPOINT` for dev-only logging. |

---

## 5. Summary counts

| Category | Count |
|----------|-------|
| Vite build warnings | 2 |
| TypeScript errors | ~150+ (across 40+ files) |
| Unused variables/imports | ~60+ |
| Type / API mismatches | ~40+ |
| Logic/runtime risks | 2 (buyerService async misuse; SellCarAdmin type) |

---

## 6. Recommended order of fixes

1. **Critical (runtime):** Fix `buyerService.ts` — add `await getBuyerActivity()` or switch to `getBuyerActivitySync()` where appropriate.
2. **CI blockers:** Fix TypeScript errors so `npm run type-check` passes (start with high-traffic files: App.tsx, services/buyerService.ts, ServiceDetail.tsx, types for ApiResponse/Provider/Notification).
3. **Types:** Extend `ApiResponse`, `Provider`, `Notification`, `CityStats`, `VerificationStatus`, and related types so they match usage.
4. **Cleanup:** Remove or use unused variables/imports (or suppress with eslint-disable/ts-ignore where intentional).
5. **Build:** Resolve duplicate identifiers in ServiceDetail.tsx and optional Sentry dependency in monitoring.ts (install types or make import conditional).

If you want, I can propose concrete patches for the critical and CI-blocking items first.
