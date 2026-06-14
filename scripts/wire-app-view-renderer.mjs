import fs from 'fs';

const lines = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);

// 1. Add imports after appServiceTypes import (line ~69)
const importInsertIdx = lines.findIndex((l) => l.includes("from './types/appServiceTypes.js'"));
if (importInsertIdx === -1) throw new Error('appServiceTypes import not found');
lines.splice(
  importInsertIdx + 1,
  0,
  "import { AppViewRenderer } from './components/app/AppViewRenderer';",
  "import { LoadingSpinner } from './components/app/AppViewSkeletons';",
);

// 2. Remove skeleton block (SkeletonPulse through MinimalLoader before lazy imports)
const skeletonStart = lines.findIndex((l) => l.includes('// Skeleton shimmer animation component'));
const lazyStart = lines.findIndex((l) => l.includes('// Lazy-loaded components with preloading'));
if (skeletonStart === -1 || lazyStart === -1) throw new Error('skeleton/lazy markers not found');
lines.splice(skeletonStart, lazyStart - skeletonStart);

// Re-find lazy block after splice
const lazyStart2 = lines.findIndex((l) => l.includes('// Lazy-loaded components with preloading'));
const cmdPaletteStart = lines.findIndex((l) => l.includes('// Lazy-loaded non-critical components'));
if (lazyStart2 === -1 || cmdPaletteStart === -1) throw new Error('lazy/cmd markers not found');
lines.splice(lazyStart2, cmdPaletteStart - lazyStart2);

// 3. Remove renderView useCallback
const renderViewStart = lines.findIndex((l) => l.includes('// Memoize renderView to prevent unnecessary re-renders'));
const renderViewEnd = lines.findIndex((l, i) => i > renderViewStart && l.trim() === ']);' && lines[i - 1]?.includes('isMobileApp'));
if (renderViewStart === -1 || renderViewEnd === -1) throw new Error('renderView block not found');
lines.splice(renderViewStart, renderViewEnd - renderViewStart + 1);

const appViewRendererJsx = `  const appViewRenderer = (
    <AppViewRenderer
      serviceProvider={serviceProvider}
      setServiceProvider={setServiceProvider}
      serviceProviderOptions={serviceProviderOptions}
      inboxConversationIdToOpen={inboxConversationIdToOpen}
      handleInboxInitialConversationConsumed={handleInboxInitialConversationConsumed}
      filtersFromUrl={filtersFromUrl}
      applyFilters={applyFilters}
      handleBrowseAllIndia={handleBrowseAllIndia}
      handleHomeUseMyLocation={handleHomeUseMyLocation}
      openSellerProfileByEmail={openSellerProfileByEmail}
      requireLoginForDealerInteraction={requireLoginForDealerInteraction}
      handleServiceRequestSubmit={handleServiceRequestSubmit}
      handleUseMyLocation={handleUseMyLocation}
      handleStartVehicleChat={handleStartVehicleChat}
      handleRequestTestDrive={handleRequestTestDrive}
      handleTestDriveResponse={handleTestDriveResponse}
      handleSellerOpenChatFromDashboard={handleSellerOpenChatFromDashboard}
      setForgotPasswordRole={setForgotPasswordRole}
      handleLogin={handleLogin}
      handleRegister={handleRegister}
      handleLogoutAll={handleLogoutAll}
      handleNotificationClick={handleNotificationClick}
      handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
      handleMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
      markAllVisibleAsRead={markAllVisibleAsRead}
      isLocating={isLocating}
      locationError={locationError}
    />
  );`;

// Insert appViewRenderer before main return (first `return (` after handleMarkAllNotificationsAsRead area)
const handleMarkAllIdx = lines.findIndex((l) => l.includes('const handleMarkAllNotificationsAsRead'));
let insertIdx = -1;
for (let i = handleMarkAllIdx; i < lines.length; i++) {
  if (lines[i].trim() === 'return (' && lines[i - 1]?.includes('getPageTitle') === false) {
    // find the AppContent final return - look for `return (` followed by `<>` or SEO
    if (lines[i + 1]?.includes('<>') || lines[i + 2]?.includes('SEO')) {
      insertIdx = i;
      break;
    }
  }
}
if (insertIdx === -1) {
  // fallback: last substantial return before App export
  insertIdx = lines.findIndex((l, i) => l.trim() === 'return (' && lines[i + 1]?.trim() === '<>');
}
if (insertIdx === -1) throw new Error('main return not found');
lines.splice(insertIdx, 0, appViewRendererJsx, '');

// Replace renderView() calls
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{renderView()}')) {
    lines[i] = lines[i].replace('{renderView()}', '{appViewRenderer}');
  }
}

fs.writeFileSync('App.tsx', lines.join('\n'), 'utf8');
console.log('App.tsx updated');
