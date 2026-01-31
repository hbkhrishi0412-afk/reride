# Mobile App Issues Found

This document lists all issues found in the mobile app components.

## Critical Issues

### 1. MobileLayout.tsx - Missing `currentView` prop
**Location:** `components/MobileLayout.tsx:86-94`
**Issue:** The `MobileHeader` component expects a `currentView` prop (optional) but it's not being passed from `MobileLayout`, even though `MobileLayout` receives it as a prop.
**Impact:** The header may not properly detect gradient views (HOME, LOGIN views) for styling.
**Fix:** Pass `currentView` prop to `MobileHeader`:
```tsx
<MobileHeader
  onNavigate={onNavigate}
  currentUser={currentUser}
  onLogout={onLogout}
  title={headerTitle || 'ReRide'}
  showBack={showBack}
  onBack={onBack}
  rightAction={headerActions}
  currentView={currentView}  // ADD THIS
/>
```

## Minor Issues

### 2. MobileBottomNav.tsx - Unused `wishlistCount` prop
**Location:** `components/MobileBottomNav.tsx:9,22`
**Issue:** The component accepts `wishlistCount` prop but never uses it. The prop is defined in the interface but not displayed anywhere in the UI.
**Impact:** Wishlist count badge is not shown in bottom navigation, even though the prop is passed from parent.
**Fix:** Either remove the prop if not needed, or implement the wishlist count badge display.

### 3. MobileSellCarPage.tsx - Inconsistent variable naming
**Location:** `components/MobileSellCarPage.tsx:20`
**Issue:** Variable `_sellerType` is prefixed with underscore (indicating unused), but `setSellerType` is actually used in the component (lines 150, 169).
**Impact:** Code inconsistency, may confuse developers.
**Fix:** Remove underscore prefix: `const [sellerType, setSellerType] = useState<'individual' | 'dealer'>('individual');`

### 4. MobileWishlist.tsx - Incomplete swipe handler
**Location:** `components/MobileWishlist.tsx:43-46`
**Issue:** `handleSwipeStart` function has incomplete implementation. It receives touch event but doesn't store the touch position, making swipe detection unreliable.
**Impact:** Swipe-to-delete functionality may not work correctly.
**Fix:** Store touch position similar to `MobileInbox.tsx`:
```tsx
const touchStartX = useRef<number>(0);
const handleSwipeStart = (e: React.TouchEvent, vehicleId: number) => {
  touchStartX.current = e.touches[0].clientX;
};
```

### 5. MobileSupportPage.tsx - Trailing empty lines
**Location:** `components/MobileSupportPage.tsx:186-216`
**Issue:** File has 30+ empty lines at the end (lines 186-216).
**Impact:** Code cleanliness issue.
**Fix:** Remove trailing empty lines.

### 6. MobileInbox.tsx - Trailing empty lines
**Location:** `components/MobileInbox.tsx:357-380`
**Issue:** File has 24+ empty lines at the end.
**Impact:** Code cleanliness issue.
**Fix:** Remove trailing empty lines.

### 7. MobileWishlist.tsx - Trailing empty lines
**Location:** `components/MobileWishlist.tsx:232-260`
**Issue:** File has 29+ empty lines at the end.
**Impact:** Code cleanliness issue.
**Fix:** Remove trailing empty lines.

## Type Safety Issues

### 8. Optional props without null checks
**Location:** Multiple components
**Issue:** Several components have optional `onNavigate` props that are used without null checks in some places.
**Components affected:**
- `MobileInbox.tsx:138` - ✅ Has null check: `if (onNavigate) onNavigate(...)`
- `MobileWishlist.tsx:70` - ✅ Has null check: `{onNavigate && (...)}`
- `MobileSupportPage.tsx` - ✅ Doesn't use `onNavigate` (no issue)

**Status:** Most components properly check for optional props before use.

## Summary

- **Critical Issues:** 1
- **Minor Issues:** 7
- **Type Safety Issues:** 0 (all properly handled)

## Recommended Priority

1. **High Priority:** Fix MobileLayout missing `currentView` prop (#1)
2. **Medium Priority:** Fix MobileWishlist swipe handler (#4), Remove unused wishlistCount or implement it (#2)
3. **Low Priority:** Code cleanup (trailing lines, variable naming) (#3, #5, #6, #7)

