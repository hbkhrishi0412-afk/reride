import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types';
import Logo from './Logo';
import useIsMobileApp from '../hooks/useIsMobileApp';

interface LoginPortalProps {
  onNavigate: (view: View) => void;
}

type PortalRole = 'customer' | 'seller' | 'service_provider';

const RoleIcon: React.FC<{ role: PortalRole; className?: string }> = ({ role, className }) => {
  const base = 'h-5 w-5';
  const cn = [base, className].filter(Boolean).join(' ');
  switch (role) {
    case 'customer':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218a1.5 1.5 0 0 0 1.464-1.175l.728-3.27A1.5 1.5 0 0 0 16.178 8.25H5.25M4.5 3h15l-1.5 7.5H7.5L6 3Z"
          />
        </svg>
      );
    case 'seller':
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 21v-4.5a.75.75 0 0 0-.75-.75H8.25A2.25 2.25 0 0 0 6 18v3m3-3h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-7.5a2.25 2.25 0 0 0-2.25 2.25V9m-3-3.75A2.25 2.25 0 0 0 3 6v1.5c0 1.242 1.007 2.25 2.25h.75m-3 0h.75A2.25 2.25 0 0 0 6 6v-1.5A2.25 2.25 0 0 0 3.75 2.5h-.5a.75.75 0 0 0-.75.75V4.5Z"
          />
        </svg>
      );
    case 'service_provider':
    default:
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.42 15.17 17.25 9.33l-1.42-1.42-3.16 3.16-2.1-2.1 3.16-3.16-1.42-1.42-5.84 5.84a2.5 2.5 0 0 0 0 3.54l1.4 1.4a2.5 2.5 0 0 0 3.55 0ZM19 2l-2.5 2.5M20.5 3.5 18 6"
          />
        </svg>
      );
  }
};

const roleDestination = (role: PortalRole): View => {
  switch (role) {
    case 'customer':
      return View.CUSTOMER_LOGIN;
    case 'seller':
      return View.SELLER_LOGIN;
    case 'service_provider':
    default:
      return View.CAR_SERVICE_LOGIN;
  }
};

const mobileIconWrap = (role: PortalRole) => {
  switch (role) {
    case 'customer':
      return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600';
    case 'seller':
      return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600';
    case 'service_provider':
    default:
      return 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600';
  }
};

const LoginPortal: React.FC<LoginPortalProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { isMobileApp } = useIsMobileApp();

  const roleTileClass =
    'group flex w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left font-semibold transition-all duration-200 active:scale-[0.99] min-h-[52px] hover:border-gray-300 text-gray-800';

  const renderRoleButton = (role: PortalRole) => (
    <button
      key={role}
      type="button"
      onClick={() => onNavigate(roleDestination(role))}
      className={roleTileClass}
    >
      <span className={mobileIconWrap(role)} aria-hidden>
        <RoleIcon role={role} className="h-5 w-5 shrink-0" />
      </span>
      <span className="min-w-0 flex-1 text-left text-[15px] leading-snug">{t(`auth.role.${role}.title`)}</span>
    </button>
  );

  const accountTypeFieldset = (
    <fieldset className="border-0 p-0 m-0 min-w-0 space-y-2">
      <legend className="block text-sm font-medium text-gray-800 mb-1 w-full">
        {t('auth.accountType')} <span className="text-red-500">*</span>
      </legend>
      <div className="grid grid-cols-2 gap-2.5" role="presentation">
        {renderRoleButton('customer')}
        {renderRoleButton('seller')}
      </div>
      <div className="mt-2.5" role="presentation">
        {renderRoleButton('service_provider')}
      </div>
      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{t('auth.selectAccountTypePlaceholder')}</p>
    </fieldset>
  );

  const portalFooter = (
    <div className="mt-6 pt-5 border-t border-gray-200 space-y-1">
      <button
        type="button"
        onClick={() => onNavigate(View.USED_CARS)}
        className="w-full text-sm font-semibold text-gray-600 py-2.5 hover:text-gray-800"
      >
        {t('auth.continueGuest')}
      </button>
      <button
        type="button"
        onClick={() => onNavigate(View.ADMIN_LOGIN)}
        className="w-full text-sm font-medium text-gray-500 py-2 hover:text-gray-700"
      >
        {t('auth.administratorLogin')}
      </button>
    </div>
  );

  if (isMobileApp) {
    return (
      <div className="min-h-[100dvh] min-h-screen flex flex-col relative overflow-hidden bg-zinc-950">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(800px 500px at 50% 0%, rgba(30,30,30,0.9) 0%, transparent 55%), linear-gradient(180deg, #121212 0%, #0a0a0a 45%, #050505 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-70 mix-blend-soft-light"
          style={{
            background: 'radial-gradient(ellipse 120% 80% at 50% 20%, rgba(80,80,80,0.45) 0%, transparent 50%)',
            filter: 'blur(2px)',
          }}
        />
        <div className="absolute -top-20 left-1/2 w-[min(100vw,28rem)] h-64 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 -right-16 w-56 h-56 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

        <div className="flex-1 min-h-[10vh] shrink-0" aria-hidden={true} />

        <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col">
          <div
            className="bg-white rounded-t-[1.75rem] rounded-b-none w-full border-t border-x border-gray-200/80 px-5 pt-7 min-h-[58vh] flex flex-col"
            style={{
              boxShadow: '0 -12px 48px -8px rgba(0, 0, 0, 0.45)',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <Logo className="scale-100" size="lg" showText onClick={() => onNavigate(View.USED_CARS)} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight text-balance">
                {t('auth.welcomeToReride')}
              </h1>
            </div>

            {accountTypeFieldset}
            {portalFooter}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col justify-center items-center p-4 bg-zinc-950 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(1000px 500px at 50% 0%, rgba(30,30,30,0.85) 0%, transparent 50%), linear-gradient(180deg, #121212 0%, #0a0a0a 100%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div
          className="bg-white rounded-3xl border border-gray-200/80 p-8 shadow-xl"
          style={{ boxShadow: '0 24px 60px -16px rgba(8, 10, 30, 0.45)' }}
        >
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo className="scale-110" size="lg" showText onClick={() => onNavigate(View.USED_CARS)} />
            </div>
            <h2 className="text-2xl font-extrabold text-reride-text-dark dark:text-reride-text-dark">
              {t('auth.welcomeToReride')}
            </h2>
          </div>
          {accountTypeFieldset}
          {portalFooter}
        </div>
      </div>
    </div>
  );
};

export default LoginPortal;
