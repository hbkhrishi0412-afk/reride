import { View } from '../types';

const AUTH_VIEWS = new Set<View>([
  View.LOGIN_PORTAL,
  View.CUSTOMER_LOGIN,
  View.SELLER_LOGIN,
  View.ADMIN_LOGIN,
  View.FORGOT_PASSWORD,
  View.CAR_SERVICE_LOGIN,
]);

export type MobileChrome = {
  showBrandBar: boolean;
  showBottomNav: boolean;
  showBack: boolean;
  /** Where the shell back button goes. Ignored when showBack is false. */
  backTarget: View;
};

/**
 * Phone chrome for a view. MobileLayout is the only frame; screens do not
 * add a second header or bottom nav.
 */
export function mobileChromeForView(view: View): MobileChrome {
  const isAuth = AUTH_VIEWS.has(view);
  const isDetail = view === View.DETAIL;
  const isNotifications = view === View.NOTIFICATIONS_CENTER;
  return {
    showBrandBar: !isAuth,
    showBottomNav: !isAuth && !isDetail && !isNotifications,
    showBack: isDetail || isNotifications,
    backTarget: isNotifications ? View.HOME : View.USED_CARS,
  };
}
