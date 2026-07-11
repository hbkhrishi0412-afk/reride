import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../types.js';
import { View as ViewEnum } from '../types.js';

interface MobileHeaderProps {
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  onLogout: () => void | Promise<void>;
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  currentView?: ViewEnum;
  showMenu?: boolean;
  onToggleMenu?: () => void;
  /** Unread Activity notifications for the signed-in user (0 = no dot). */
  unreadNotificationCount?: number;
  /** Vehicles queued for side-by-side comparison. */
  compareCount?: number;
  wishlistCount?: number;
  inboxCount?: number;
  /**
   * Logged-in service provider (separate identity from `currentUser`). When
   * present, the menu shows the provider's identity and a shortcut to the
   * service-provider dashboard / logout, even if no `currentUser` is set.
   */
  serviceProvider?: { name?: string; email?: string } | null;
  /** When false, only the slide-out menu renders (no fixed title bar). */
  showTitleBar?: boolean;
}

type MenuItemConfig = {
  icon: React.ReactNode;
  label: string;
  view: ViewEnum;
  badge?: number;
  tint?: string;
  hidden?: boolean;
};

/**
 * Mobile App Header - Compact design for installed PWA
 * Features: Small icons, minimal space, app-like feel
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({
  onNavigate,
  currentUser,
  onLogout,
  title,
  showBack = false,
  onBack,
  rightAction,
  currentView,
  showMenu: showMenuProp,
  onToggleMenu,
  unreadNotificationCount = 0,
  compareCount = 0,
  wishlistCount = 0,
  inboxCount = 0,
  serviceProvider = null,
  showTitleBar = true,
}) => {
  const { t } = useTranslation();
  const [internalShowMenu, setInternalShowMenu] = useState(false);
  const showMenu = showMenuProp !== undefined ? showMenuProp : internalShowMenu;
  const closeMenu = () => {
    if (onToggleMenu) {
      if (showMenu) onToggleMenu();
    } else {
      setInternalShowMenu(false);
    }
  };
  const toggleMenu = () => {
    if (onToggleMenu) onToggleMenu();
    else setInternalShowMenu((prev) => !prev);
  };
  const isAuthed = Boolean(currentUser) || Boolean(serviceProvider);
  const displayName =
    currentUser?.name || serviceProvider?.name || (isAuthed ? 'Account' : 'Guest');
  const displaySubtitle =
    currentUser?.email ||
    serviceProvider?.email ||
    (serviceProvider ? 'Service provider' : t('nav.loginRegister'));
  const userInitials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);
  const roleLabel =
    currentUser?.role === 'seller'
      ? t('nav.roleSeller')
      : currentUser?.role === 'customer'
        ? t('nav.roleCustomer')
        : serviceProvider
          ? 'Provider'
          : null;

  const navigateAndClose = (view: ViewEnum) => {
    onNavigate(view);
    closeMenu();
  };

  const exploreItems: MenuItemConfig[] = useMemo(
    () => [
      { icon: <HomeIcon />, label: t('nav.home'), view: ViewEnum.HOME, tint: '#334155' },
      { icon: <CarIcon />, label: t('nav.buyCar'), view: ViewEnum.USED_CARS, tint: '#334155' },
      {
        icon: <SellCarIcon />,
        label: t('nav.sellCar'),
        view: currentUser?.role === 'seller' ? ViewEnum.SELL_CAR : ViewEnum.SELLER_LOGIN,
        tint: '#334155',
      },
      { icon: <DealerIcon />, label: t('nav.dealers'), view: ViewEnum.DEALER_PROFILES, tint: '#475569' },
      { icon: <ServiceIcon />, label: t('nav.carServices'), view: ViewEnum.CAR_SERVICES, tint: '#475569' },
      {
        icon: <CompareIcon />,
        label: t('nav.compareCount', { count: compareCount }),
        view: ViewEnum.COMPARISON,
        badge: compareCount > 0 ? compareCount : undefined,
        tint: '#334155',
      },
      {
        icon: <PricingIcon />,
        label: t('nav.pricing', { defaultValue: 'Pricing' }),
        view: ViewEnum.PRICING,
        tint: '#475569',
      },
    ],
    [t, currentUser?.role, compareCount],
  );

  const accountItems: MenuItemConfig[] = useMemo(() => {
    if (!currentUser) return [];
    const items: MenuItemConfig[] = [];
    if (currentUser.role === 'seller') {
      items.push({
        icon: <DashboardIcon />,
        label: t('nav.sellerDashboard'),
        view: ViewEnum.SELLER_DASHBOARD,
        tint: '#1E293B',
      });
    }
    if (currentUser.role === 'customer') {
      items.push({
        icon: <DashboardIcon />,
        label: t('nav.myDashboard'),
        view: ViewEnum.BUYER_DASHBOARD,
        tint: '#1E293B',
      });
    }
    items.push(
      {
        icon: <HeartIcon />,
        label: t('nav.myWishlist'),
        view: ViewEnum.WISHLIST,
        badge: wishlistCount > 0 ? wishlistCount : undefined,
        tint: '#475569',
      },
      {
        icon: <MessageIcon />,
        label: t('nav.messages'),
        view: ViewEnum.INBOX,
        badge: inboxCount > 0 ? inboxCount : undefined,
        tint: '#475569',
      },
      { icon: <UserIcon />, label: t('nav.myProfile'), view: ViewEnum.PROFILE, tint: '#64748B' },
    );
    return items;
  }, [currentUser, t, wishlistCount, inboxCount]);

  const helpItems: MenuItemConfig[] = useMemo(
    () => [
      { icon: <QuestionIcon />, label: t('footer.helpCenter', { defaultValue: 'Help center' }), view: ViewEnum.HELP_CENTER, tint: '#64748B' },
      { icon: <InfoIcon />, label: t('nav.support'), view: ViewEnum.SUPPORT, tint: '#64748B' },
      { icon: <ShieldIcon />, label: t('footer.safety'), view: ViewEnum.SAFETY_CENTER, tint: '#64748B' },
      { icon: <AboutIcon />, label: t('nav.aboutUs'), view: ViewEnum.ABOUT_US, tint: '#64748B' },
      { icon: <QuestionIcon />, label: t('footer.faq'), view: ViewEnum.FAQ, tint: '#64748B' },
    ],
    [t],
  );

  const legalItems: MenuItemConfig[] = useMemo(
    () => [
      { icon: <ShieldIcon />, label: t('footer.privacy'), view: ViewEnum.PRIVACY_POLICY, tint: '#64748B' },
      { icon: <InfoIcon />, label: t('footer.terms'), view: ViewEnum.TERMS_OF_SERVICE, tint: '#64748B' },
      { icon: <InfoIcon />, label: t('footer.refund', { defaultValue: 'Refund Policy' }), view: ViewEnum.REFUND_POLICY, tint: '#64748B' },
      { icon: <ShieldIcon />, label: t('footer.complaint', { defaultValue: 'Complaint Resolution' }), view: ViewEnum.COMPLAINT_RESOLUTION, tint: '#64748B' },
      { icon: <ShieldIcon />, label: t('footer.fraud', { defaultValue: 'Fraud Policy' }), view: ViewEnum.FRAUD_POLICY, tint: '#64748B' },
      { icon: <InfoIcon />, label: t('footer.cookies', { defaultValue: 'Cookie Policy' }), view: ViewEnum.COOKIE_POLICY, tint: '#64748B' },
    ],
    [t],
  );

  // Check if current view should have transparent header
  const isGradientView = currentView && (
    currentView === ViewEnum.HOME ||
    currentView === ViewEnum.LOGIN_PORTAL ||
    currentView === ViewEnum.CUSTOMER_LOGIN ||
    currentView === ViewEnum.SELLER_LOGIN ||
    currentView === ViewEnum.ADMIN_LOGIN
  );
  const showDefaultHeaderActions =
    rightAction === undefined && currentView !== ViewEnum.DETAIL;

  return (
    <>
      {showTitleBar && (
      <header
        className="fixed left-0 right-0 z-[50] h-14"
        data-testid="mobile-header"
        style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
        paddingTop: 0,
        background: isGradientView
          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.1) 100%)'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: isGradientView
          ? '0.5px solid rgba(255, 255, 255, 0.2)'
          : '0.5px solid rgba(0, 0, 0, 0.08)',
        boxShadow: isGradientView
          ? '0 1px 3px rgba(0, 0, 0, 0.1)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="flex items-center justify-between h-full px-4">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={onBack}
                className="p-2 -ml-2 active:opacity-50 native-transition"
                style={{ minWidth: '44px', minHeight: '44px' }}
                aria-label="Go back"
              >
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={toggleMenu}
                className="p-2 -ml-2 rounded-full active:scale-95 native-transition"
                aria-label="Toggle menu"
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  background: 'rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
                data-testid="mobile-menu-button"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  style={{
                    color: isGradientView ? '#FFFFFF' : '#1A1A1A'
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Center Title - Premium Typography */}
            <h1
              className="text-base font-bold absolute left-1/2 transform -translate-x-1/2 max-w-[240px] sm:max-w-[280px] truncate tracking-tight"
              style={{
                letterSpacing: '-0.01em',
                color: isGradientView ? '#FFFFFF' : '#1A1A1A'
              }}
            >
              {title}
            </h1>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {rightAction !== undefined ? (
              rightAction
            ) : showDefaultHeaderActions ? (
              <>
                {currentView !== ViewEnum.COMPARISON && (
                  <button
                    type="button"
                    onClick={() => onNavigate(ViewEnum.COMPARISON)}
                    className="p-2 rounded-full active:scale-95 native-transition relative"
                    style={{
                      minWidth: '44px',
                      minHeight: '44px',
                      background: 'rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
                    }}
                    aria-label={
                      compareCount > 0
                        ? t('nav.compareCount', { count: compareCount })
                        : t('compare.pageTitle')
                    }
                    data-testid="mobile-compare-button"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      style={{
                        color: isGradientView ? '#FFFFFF' : '#1A1A1A'
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    {compareCount > 0 && (
                      <span
                        className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none"
                        aria-hidden
                      >
                        {compareCount}
                      </span>
                    )}
                  </button>
                )}

                {currentView !== ViewEnum.USED_CARS && currentView !== ViewEnum.RENTAL && (
                  <button
                    onClick={() => onNavigate(ViewEnum.USED_CARS)}
                    className="p-2 rounded-full active:scale-95 native-transition"
                    style={{
                      minWidth: '44px',
                      minHeight: '44px',
                      background: 'rgba(0, 0, 0, 0.04)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
                    }}
                    aria-label="Search"
                    data-testid="mobile-search-button"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      style={{
                        color: isGradientView ? '#FFFFFF' : '#1A1A1A'
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                )}

                {isAuthed && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(ViewEnum.NOTIFICATIONS_CENTER);
                    }}
                    className="p-2 active:opacity-50 native-transition relative"
                    style={{ minWidth: '44px', minHeight: '44px' }}
                    aria-label={
                      unreadNotificationCount > 0
                        ? `Notifications, ${unreadNotificationCount} unread`
                        : 'Notifications'
                    }
                  >
                    <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadNotificationCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-slate-900 rounded-full" aria-hidden />
                    )}
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </header>
      )}

      {/* Slide-out Menu */}
      {showMenu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] animate-fade-in cursor-default border-0 bg-slate-900/40 p-0 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            className="fixed top-0 left-0 bottom-0 z-[110] flex w-[min(20rem,88vw)] flex-col border-r border-slate-200/80 bg-slate-50 shadow-2xl animate-slide-in-left"
            data-testid="mobile-drawer"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Profile header */}
            <div className="relative overflow-hidden border-b border-slate-700/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 pb-4 pt-3">
              <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/[0.04]" aria-hidden />
              <div className="absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/[0.03]" aria-hidden />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    if (currentUser) navigateAndClose(ViewEnum.PROFILE);
                    else if (!isAuthed) navigateAndClose(ViewEnum.LOGIN_PORTAL);
                  }}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/20">
                    {isAuthed ? (
                      userInitials
                    ) : (
                      <svg className="h-6 w-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-white">{displayName}</p>
                    <p className="truncate text-xs text-slate-300">{displaySubtitle}</p>
                    {roleLabel ? (
                      <span className="mt-1.5 inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-200">
                        {roleLabel}
                      </span>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 active:bg-white/15"
                  data-testid="mobile-drawer-close"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {currentUser ? (
                <p className="relative mt-3 text-[11px] font-medium tracking-wide text-slate-400">
                  {t('nav.viewProfile')}
                </p>
              ) : null}
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
              <MenuSection title={t('nav.menuExplore')}>
                {exploreItems
                  .filter((item) => !item.hidden)
                  .map((item) => (
                    <MenuItem
                      key={`${item.view}-${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      tint={item.tint}
                      badge={item.badge}
                      active={currentView === item.view}
                      onClick={() => navigateAndClose(item.view)}
                    />
                  ))}
              </MenuSection>

              {accountItems.length > 0 ? (
                <MenuSection title={t('nav.menuAccount')}>
                  {accountItems.map((item) => (
                    <MenuItem
                      key={`${item.view}-${item.label}`}
                      icon={item.icon}
                      label={item.label}
                      tint={item.tint}
                      badge={item.badge}
                      active={currentView === item.view}
                      onClick={() => navigateAndClose(item.view)}
                    />
                  ))}
                </MenuSection>
              ) : null}

              {serviceProvider && !currentUser ? (
                <MenuSection title={t('nav.menuAccount')}>
                  <MenuItem
                    icon={<DashboardIcon />}
                    label="Service Provider Dashboard"
                    tint="#475569"
                    active={currentView === ViewEnum.CAR_SERVICE_DASHBOARD}
                    onClick={() => navigateAndClose(ViewEnum.CAR_SERVICE_DASHBOARD)}
                  />
                </MenuSection>
              ) : null}

              <MenuSection title={t('nav.menuHelp')}>
                {helpItems.map((item) => (
                  <MenuItem
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    tint={item.tint}
                    active={currentView === item.view}
                    onClick={() => navigateAndClose(item.view)}
                  />
                ))}
              </MenuSection>

              <MenuSection title={t('footer.trustLegal', { defaultValue: 'Trust & legal' })}>
                {legalItems.map((item) => (
                  <MenuItem
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    tint={item.tint}
                    active={currentView === item.view}
                    onClick={() => navigateAndClose(item.view)}
                  />
                ))}
              </MenuSection>
            </nav>

            {/* Footer actions */}
            <div className="border-t border-slate-200/80 bg-white px-3 py-3">
              {isAuthed ? (
                <MenuItem
                  icon={<LogoutIcon />}
                  label={t('nav.logout')}
                  variant="danger"
                  onClick={() => {
                    closeMenu();
                    void Promise.resolve(onLogout());
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <p className="px-2 text-xs leading-relaxed text-slate-500">
                    {t('nav.menuGuestPrompt')}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateAndClose(ViewEnum.LOGIN_PORTAL)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm active:bg-slate-800"
                  >
                    <LoginIcon />
                    {t('nav.loginRegister')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-1">
    <p className="px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {title}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  tint?: string;
  variant?: 'default' | 'danger';
}> = ({ icon, label, onClick, active = false, badge, tint = '#475569', variant = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all active:scale-[0.99] ${
      variant === 'danger'
        ? 'text-red-600 hover:bg-red-50'
        : active
          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
          : 'text-slate-700 hover:bg-white/80'
    }`}
    style={{ minHeight: '48px' }}
  >
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      style={{
        background: variant === 'danger' ? 'rgba(220,38,38,0.08)' : active ? '#F1F5F9' : '#FFFFFF',
        color: variant === 'danger' ? '#DC2626' : tint,
        boxShadow: variant === 'danger' ? 'none' : '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <div className="h-[18px] w-[18px]">{icon}</div>
    </div>
    <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-tight">{label}</span>
    {badge != null && badge > 0 ? (
      <span className="min-w-[20px] rounded-full bg-slate-900 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
        {badge > 99 ? '99+' : badge}
      </span>
    ) : null}
    {variant !== 'danger' ? (
      <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    ) : null}
  </button>
);

const HomeIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const CarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h.01M16 17h.01M5 11l1.5-4.5A2 2 0 018.44 5h7.12a2 2 0 011.94 1.5L19 11M5 11v6a1 1 0 001 1h1m12-7v6a1 1 0 01-1 1h-1M5 11h14" />
  </svg>
);

const SellCarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const DealerIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ServiceIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CompareIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const PricingIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m0-12a9 9 0 110 18 9 9 0 010-18z" />
  </svg>
);

const HeartIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const MessageIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const DashboardIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const UserIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const InfoIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const AboutIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const QuestionIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const LoginIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
  </svg>
);

export default MobileHeader;
