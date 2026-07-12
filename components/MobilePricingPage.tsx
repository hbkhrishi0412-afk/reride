import React, { useState, useEffect, useCallback } from 'react';
import type { User, PlanDetails, SubscriptionPlan } from '../types';
import { View as ViewEnum } from '../types';
import { planService } from '../services/planService';
import { getPaymentRequestStatus } from '../services/paymentService';
import PaymentRequestModal from './PaymentRequestModal';

interface MobilePricingPageProps {
  currentUser: User | null;
  onSelectPlan: (planId: SubscriptionPlan) => void | Promise<void>;
  onNavigate?: (view: ViewEnum) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type IconProps = { className?: string; size?: number; stroke?: number };
const Icon = ({ size = 20, stroke = 1.75, className, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);
const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);
const IconSparkles = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
  </Icon>
);
const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Icon>
);
const IconCreditCard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </Icon>
);
const IconZap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </Icon>
);
const IconCrown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 17l3-10 5 4 4-6 4 6 5-4 3 10H2z" />
    <path d="M4 20h16" />
  </Icon>
);

const PLAN_ACCENTS: Record<
  SubscriptionPlan,
  { accent: string; accentSoft: string; icon: React.ReactNode; tagline: string }
> = {
  free: {
    accent: '#64748B',
    accentSoft: 'rgba(100,116,139,0.10)',
    icon: <IconZap size={18} stroke={2} />,
    tagline: 'Get started for free',
  },
  pro: {
    accent: '#FF6B35',
    accentSoft: 'rgba(255,107,53,0.10)',
    icon: <IconSparkles size={18} stroke={2} />,
    tagline: 'Best for growing dealers',
  },
  premium: {
    accent: '#8B5CF6',
    accentSoft: 'rgba(139,92,246,0.10)',
    icon: <IconCrown size={18} stroke={2} />,
    tagline: 'For high-volume sellers',
  },
};

const formatListingLimit = (limit: number | 'unlimited') =>
  limit === 'unlimited' ? 'Unlimited' : String(limit);

/**
 * Mobile pricing: free plan immediate; paid plans open checkout (Razorpay or manual proof).
 */
export const MobilePricingPage: React.FC<MobilePricingPageProps> = ({
  currentUser,
  onSelectPlan,
  onNavigate,
  addToast,
}) => {
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentPlanId = currentUser?.subscriptionPlan;
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro');
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [pendingPlanId, setPendingPlanId] = useState<SubscriptionPlan | null>(null);

  const loadPendingPayment = useCallback(async () => {
    if (!currentUser?.email || currentUser.role !== 'seller') {
      setPendingPlanId(null);
      return;
    }
    try {
      const request = await getPaymentRequestStatus(currentUser.email);
      setPendingPlanId(request?.status === 'pending' ? request.planId : null);
    } catch {
      setPendingPlanId(null);
    }
  }, [currentUser?.email, currentUser?.role]);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const plansData = await planService.getAllPlans();
      setPlans(plansData);
      if (plansData.length === 0) {
        setLoadError('No pricing plans are available right now.');
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      const message = 'Could not load pricing plans. Please try again.';
      setLoadError(message);
      addToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    void loadPendingPayment();
  }, [loadPendingPayment]);

  const handlePlanSelect = async (planId: SubscriptionPlan) => {
    if (!currentUser || currentUser.role !== 'seller') {
      addToast('Please sign in as a seller to choose a plan.', 'info');
      if (onNavigate) onNavigate(ViewEnum.LOGIN_PORTAL);
      return;
    }
    if (planId === 'free') {
      await onSelectPlan(planId);
      return;
    }
    if (pendingPlanId === planId) {
      addToast('This plan is awaiting admin verification.', 'info');
      return;
    }
    setSelectedPlan(planId);
    try {
      const planDetails = await planService.getPlanDetails(planId);
      setSelectedAmount(planDetails.price);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Failed to get plan details:', error);
      addToast('Could not start payment. Please try again.', 'error');
    }
  };

  const currentPlanName = plans.find((p) => p.id === currentPlanId)?.name;

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24" style={{ background: '#F8FAFC' }} aria-busy="true">
        <div
          className="px-5 pt-6 pb-8"
          style={{
            background: 'linear-gradient(165deg, #FFF7F3 0%, #FFFFFF 55%, #F8FAFC 100%)',
          }}
        >
          <div className="h-7 w-48 rounded-lg bg-slate-200/70 animate-pulse mb-3" />
          <div className="h-4 w-64 rounded-md bg-slate-100 animate-pulse" />
        </div>
        <div className="px-4 -mt-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-3xl p-5 animate-pulse"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(15,23,42,0.06)',
                minHeight: i === 2 ? 280 : 240,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || plans.length === 0) {
    return (
      <div className="min-h-screen pb-24 flex flex-col" style={{ background: '#F8FAFC' }}>
        <div
          className="px-5 pt-6 pb-8"
          style={{
            background: 'linear-gradient(165deg, #FFF7F3 0%, #FFFFFF 55%, #F8FAFC 100%)',
          }}
        >
          <h1 className="text-[26px] font-bold text-slate-900 tracking-tight">Choose Your Plan</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span
            className="w-14 h-14 rounded-2xl grid place-items-center mb-4"
            style={{ background: 'rgba(255,107,53,0.10)', color: '#FF6B35' }}
          >
            <IconSparkles size={24} stroke={1.8} />
          </span>
          <p className="text-slate-900 font-semibold mb-1">Plans unavailable</p>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">{loadError || 'Please try again in a moment.'}</p>
          <button
            type="button"
            onClick={() => void loadPlans()}
            className="px-6 py-3 rounded-full font-semibold text-white active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
              boxShadow: '0 10px 24px -10px rgba(255,107,53,0.55)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#F8FAFC' }}>
      {/* Hero */}
      <div
        className="relative overflow-hidden px-5 pt-6 pb-10"
        style={{
          background: 'linear-gradient(165deg, #FFF7F3 0%, #FFFFFF 50%, #F8FAFC 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.25) 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute top-16 -left-8 w-28 h-28 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)' }}
        />

        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-reride-orange mb-2">
          Seller plans
        </p>
        <h1 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
          Choose Your Plan
        </h1>
        <p className="mt-2 text-[14px] text-slate-500 leading-relaxed max-w-sm">
          Unlock tools to sell faster — pay online with Razorpay or submit payment proof.
        </p>

        {currentPlanId && currentPlanName && (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
            style={{
              background: 'rgba(255,107,53,0.08)',
              border: '1px solid rgba(255,107,53,0.18)',
              color: '#C2410C',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-reride-orange" />
            Current plan: {currentPlanName}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="px-4 -mt-4 space-y-4">
        {plans.map((plan) => {
          const accent = PLAN_ACCENTS[plan.id];
          const isCurrent = currentPlanId === plan.id;
          const isPending = pendingPlanId === plan.id;
          const isPopular = plan.isMostPopular;

          return (
            <article
              key={plan.id}
              className={`relative rounded-3xl p-5 transition-transform active:scale-[0.99] ${
                isPopular ? 'pt-7' : ''
              }`}
              style={
                isPopular
                  ? {
                      background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFBF8 100%)',
                      border: '2px solid #FF6B35',
                      boxShadow:
                        '0 0 0 1px rgba(255,107,53,0.08), 0 12px 32px -12px rgba(255,107,53,0.35), 0 4px 16px -4px rgba(15,23,42,0.08)',
                    }
                  : {
                      background: '#FFFFFF',
                      border: '1px solid rgba(15,23,42,0.06)',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.18)',
                    }
              }
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white"
                    style={{
                      background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                      boxShadow: '0 4px 12px -2px rgba(255,107,53,0.45)',
                    }}
                  >
                    <IconSparkles size={11} stroke={2.2} />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-11 h-11 rounded-2xl grid place-items-center shrink-0"
                    style={{ background: accent.accentSoft, color: accent.accent }}
                  >
                    {accent.icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">{plan.name}</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5">{accent.tagline}</p>
                  </div>
                </div>
                {isCurrent && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(15,23,42,0.06)', color: '#475569' }}
                  >
                    Active
                  </span>
                )}
                {!isCurrent && isPending && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(234,179,8,0.15)', color: '#A16207' }}
                  >
                    Pending
                  </span>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-none">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[14px] text-slate-500 font-medium">/month</span>
                </div>
                <p className="text-[12px] text-slate-400 mt-1">
                  {plan.id === 'free' ? 'No credit card required' : 'Billed monthly · Cancel anytime'}
                </p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <div
                  className="rounded-2xl px-3 py-2.5"
                  style={{ background: accent.accentSoft }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent.accent }}>
                    Listings
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold text-slate-900">
                    {formatListingLimit(plan.listingLimit)}
                  </p>
                </div>
                <div
                  className="rounded-2xl px-3 py-2.5"
                  style={{ background: accent.accentSoft }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent.accent }}>
                    Featured
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold text-slate-900">
                    {plan.featuredCredits}/mo
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5 mb-5">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span
                      className="w-5 h-5 rounded-full grid place-items-center shrink-0 mt-0.5"
                      style={{ background: accent.accentSoft, color: accent.accent }}
                    >
                      <IconCheck size={11} stroke={2.5} />
                    </span>
                    <span className="text-[13px] text-slate-600 leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void handlePlanSelect(plan.id)}
                disabled={isCurrent || isPending}
                className={`w-full py-3.5 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98] ${
                  isCurrent || isPending ? 'cursor-not-allowed' : ''
                }`}
                style={
                  isCurrent || isPending
                    ? {
                        background: 'rgba(15,23,42,0.05)',
                        color: '#94A3B8',
                        minHeight: '48px',
                      }
                    : isPopular
                      ? {
                          background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                          color: '#FFFFFF',
                          boxShadow: '0 10px 24px -10px rgba(255,107,53,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                          minHeight: '48px',
                        }
                      : plan.id === 'premium'
                        ? {
                            background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                            color: '#FFFFFF',
                            boxShadow: '0 10px 24px -10px rgba(139,92,246,0.45)',
                            minHeight: '48px',
                          }
                        : {
                            background: '#0F172A',
                            color: '#FFFFFF',
                            boxShadow: '0 8px 20px -10px rgba(15,23,42,0.35)',
                            minHeight: '48px',
                          }
                }
              >
                {isCurrent
                  ? 'Current Plan'
                  : isPending
                    ? 'Verification Pending'
                    : plan.id === 'free'
                      ? 'Start Free'
                      : `Upgrade to ${plan.name}`}
              </button>
            </article>
          );
        })}
      </div>

      {/* Trust strip */}
      <div className="px-4 mt-6">
        <div
          className="rounded-3xl p-4"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-3">
            Flexible payment
          </p>
          <div className="space-y-3">
            {[
              {
                icon: <IconCreditCard size={16} stroke={2} />,
                title: 'Pay online instantly',
                desc: 'Secure checkout via Razorpay',
              },
              {
                icon: <IconShield size={16} stroke={2} />,
                title: 'Submit payment proof',
                desc: 'UPI or bank transfer with manual verification',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-xl grid place-items-center shrink-0"
                  style={{ background: 'rgba(255,107,53,0.08)', color: '#FF6B35' }}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{item.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PaymentRequestModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        planId={selectedPlan}
        amount={selectedAmount}
        sellerEmail={currentUser?.email || ''}
        onSuccess={() => void onSelectPlan(selectedPlan)}
        onManualSubmitted={() => {
          setPendingPlanId(selectedPlan);
        }}
        onNotify={(msg, type) => addToast(msg, type)}
      />
    </div>
  );
};

export default MobilePricingPage;
