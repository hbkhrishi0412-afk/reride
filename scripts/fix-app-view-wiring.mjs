import fs from 'fs';

const lines = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);

// Remove duplicate mobile dashboard shortcut block (uses AdminPanel/MobileDashboard outside AppViewRenderer)
const dashBlockStart = lines.findIndex((l) => l.includes('// Check if we\'re on a dashboard view'));
const dashBlockEnd = lines.findIndex((l) => l.includes('// For ALL other views (Home, Browse, Detail, etc.)'));
if (dashBlockStart === -1 || dashBlockEnd === -1) {
  throw new Error(`dashboard block markers not found: ${dashBlockStart} ${dashBlockEnd}`);
}
lines.splice(dashBlockStart, dashBlockEnd - dashBlockStart);

// Remove any existing appViewRenderer const (wrong placement)
const appViewStart = lines.findIndex((l) => l.trim() === 'const appViewRenderer = (');
if (appViewStart !== -1) {
  let appViewEnd = appViewStart;
  while (appViewEnd < lines.length && !lines[appViewEnd].includes(');')) appViewEnd++;
  lines.splice(appViewStart, appViewEnd - appViewStart + 1);
  if (lines[appViewStart]?.trim() === '') lines.splice(appViewStart, 1);
}

// Ensure MinimalLoader exists (used by ChatWidget / CommandPalette suspense)
if (!lines.some((l) => l.includes('const MinimalLoader'))) {
  const lazyIdx = lines.findIndex((l) => l.includes('// Lazy-loaded non-critical components'));
  if (lazyIdx === -1) throw new Error('lazy non-critical marker not found');
  lines.splice(lazyIdx, 0, '', 'const MinimalLoader: React.FC = () => null;', '');
}

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

const mobileAppIdx = lines.findIndex((l) => l.includes('// Render Mobile App Layout'));
if (mobileAppIdx === -1) throw new Error('mobile app layout marker not found');
lines.splice(mobileAppIdx, 0, appViewRendererJsx, '');

fs.writeFileSync('App.tsx', lines.join('\n'), 'utf8');
console.log('App.tsx fixed');
