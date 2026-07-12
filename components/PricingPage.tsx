import React, { useState, useEffect, useCallback } from 'react';
import type { User, PlanDetails, SubscriptionPlan } from '../types';
import { planService } from '../services/planService';
import { getPaymentRequestStatus } from '../services/paymentService';
import PaymentRequestModal from './PaymentRequestModal';
import { WebsitePageGutters } from './WebsitePageShell';

interface PricingPageProps {
  currentUser: User | null;
  onSelectPlan: (planId: SubscriptionPlan) => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
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
    icon: <IconZap size={20} stroke={2} />,
    tagline: 'Get started for free',
  },
  pro: {
    accent: '#FF6B35',
    accentSoft: 'rgba(255,107,53,0.10)',
    icon: <IconSparkles size={20} stroke={2} />,
    tagline: 'Best for growing dealers',
  },
  premium: {
    accent: '#8B5CF6',
    accentSoft: 'rgba(139,92,246,0.10)',
    icon: <IconCrown size={20} stroke={2} />,
    tagline: 'For high-volume sellers',
  },
};

const formatListingLimit = (limit: number | 'unlimited') =>
  limit === 'unlimited' ? 'Unlimited' : String(limit);

const PricingPage: React.FC<PricingPageProps> = ({ currentUser, onSelectPlan, addToast }) => {
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
      addToast?.(message, 'error');
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
    if (planId === 'free') {
      onSelectPlan(planId);
      return;
    }
    if (pendingPlanId === planId) {
      addToast?.('This plan is awaiting admin verification.', 'info');
      return;
    }
    setSelectedPlan(planId);
    try {
      const planDetails = await planService.getPlanDetails(planId);
      setSelectedAmount(planDetails.price);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Failed to get plan details:', error);
      addToast?.('Could not start payment. Please try again.', 'error');
    }
  };

  const currentPlanName = plans.find((p) => p.id === currentPlanId)?.name;

  if (isLoading) {
    return (
      <div className="animate-fade-in min-h-[60vh]" style={{ background: '#F8FAFC' }} aria-busy="true">
        <WebsitePageGutters className="py-12 sm:py-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="h-5 w-32 rounded-full bg-slate-200/70 animate-pulse mx-auto mb-4" />
            <div className="h-10 w-96 max-w-full rounded-lg bg-slate-200/70 animate-pulse mx-auto mb-3" />
            <div className="h-5 w-80 max-w-full rounded-md bg-slate-100 animate-pulse mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-3xl p-8 animate-pulse"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  minHeight: i === 2 ? 480 : 440,
                }}
              />
            ))}
          </div>
        </WebsitePageGutters>
      </div>
    );
  }

  if (loadError || plans.length === 0) {
    return (
      <div className="animate-fade-in min-h-[60vh] flex flex-col items-center justify-center px-4 py-16" style={{ background: '#F8FAFC' }}>
        <span
          className="w-16 h-16 rounded-2xl grid place-items-center mb-5"
          style={{ background: 'rgba(255,107,53,0.10)', color: '#FF6B35' }}
        >
          <IconSparkles size={28} stroke={1.8} />
        </span>
        <p className="text-slate-900 font-semibold text-lg mb-1">Plans unavailable</p>
        <p className="text-slate-500 mb-8 max-w-md text-center">{loadError || 'Please try again in a moment.'}</p>
        <button
          type="button"
          onClick={() => void loadPlans()}
          className="px-8 py-3 rounded-full font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
            boxShadow: '0 10px 24px -10px rgba(255,107,53,0.55)',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-24 lg:pb-12" style={{ background: '#F8FAFC' }}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(165deg, #FFF7F3 0%, #FFFFFF 45%, #F8FAFC 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute -top-16 right-[10%] w-72 h-72 rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(255,107,53,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute top-24 left-[5%] w-56 h-56 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)' }}
        />

        <WebsitePageGutters className="relative pt-12 sm:pt-16 pb-10 sm:pb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-reride-orange ring-1 ring-orange-200/60 bg-orange-50">
            Seller plans
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Find the Perfect Plan for Your Dealership
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Unlock powerful tools to sell your vehicles faster. Pay online with Razorpay or submit payment proof.
          </p>
          {currentPlanId && currentPlanName && (
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: 'rgba(255,107,53,0.08)',
                border: '1px solid rgba(255,107,53,0.18)',
                color: '#C2410C',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-reride-orange" />
              Current plan: {currentPlanName}
            </div>
          )}
        </WebsitePageGutters>
      </div>

      {/* Plan cards */}
      <WebsitePageGutters className="-mt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => {
            const accent = PLAN_ACCENTS[plan.id];
            const isCurrent = currentPlanId === plan.id;
            const isPending = pendingPlanId === plan.id;
            const isPopular = plan.isMostPopular;

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-3xl p-7 sm:p-8 transition-all duration-300 ${
                  isPopular ? 'md:-mt-2 md:mb-2 lg:scale-[1.03] z-10' : 'hover:-translate-y-1'
                }`}
                style={
                  isPopular
                    ? {
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFBF8 100%)',
                        border: '2px solid #FF6B35',
                        boxShadow:
                          '0 0 0 1px rgba(255,107,53,0.08), 0 16px 40px -12px rgba(255,107,53,0.30), 0 4px 16px -4px rgba(15,23,42,0.08)',
                      }
                    : {
                        background: '#FFFFFF',
                        border: '1px solid rgba(15,23,42,0.06)',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -16px rgba(15,23,42,0.18)',
                      }
                }
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white"
                      style={{
                        background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                        boxShadow: '0 4px 14px -2px rgba(255,107,53,0.45)',
                      }}
                    >
                      <IconSparkles size={12} stroke={2.2} />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3.5">
                    <span
                      className="w-12 h-12 rounded-2xl grid place-items-center shrink-0"
                      style={{ background: accent.accentSoft, color: accent.accent }}
                    >
                      {accent.icon}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">{plan.name}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{accent.tagline}</p>
                    </div>
                  </div>
                  {isCurrent && (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'rgba(15,23,42,0.06)', color: '#475569' }}
                    >
                      Active
                    </span>
                  )}
                  {!isCurrent && isPending && (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ background: 'rgba(234,179,8,0.15)', color: '#A16207' }}
                    >
                      Pending
                    </span>
                  )}
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      ₹{plan.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-base text-slate-500 font-medium">/month</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1.5">
                    {plan.id === 'free' ? 'No credit card required' : 'Billed monthly · Cancel anytime'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-2xl px-3.5 py-3" style={{ background: accent.accentSoft }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent.accent }}>
                      Listings
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatListingLimit(plan.listingLimit)}
                    </p>
                  </div>
                  <div className="rounded-2xl px-3.5 py-3" style={{ background: accent.accentSoft }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent.accent }}>
                      Featured
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{plan.featuredCredits}/mo</p>
                  </div>
                </div>

                <ul className="space-y-3 flex-grow mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full grid place-items-center shrink-0 mt-0.5"
                        style={{ background: accent.accentSoft, color: accent.accent }}
                      >
                        <IconCheck size={11} stroke={2.5} />
                      </span>
                      <span className="text-sm text-slate-600 leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => void handlePlanSelect(plan.id)}
                  disabled={isCurrent || isPending}
                  className={`w-full py-3.5 rounded-2xl font-semibold text-base transition-all ${
                    isCurrent || isPending ? 'cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                  style={
                    isCurrent || isPending
                      ? { background: 'rgba(15,23,42,0.05)', color: '#94A3B8' }
                      : isPopular
                        ? {
                            background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                            color: '#FFFFFF',
                            boxShadow: '0 10px 28px -10px rgba(255,107,53,0.55), inset 0 1px 0 rgba(255,255,255,0.2)',
                          }
                        : plan.id === 'premium'
                          ? {
                              background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                              color: '#FFFFFF',
                              boxShadow: '0 10px 28px -10px rgba(139,92,246,0.45)',
                            }
                          : {
                              background: '#0F172A',
                              color: '#FFFFFF',
                              boxShadow: '0 8px 24px -10px rgba(15,23,42,0.35)',
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
        <div
          className="mt-12 lg:mt-16 rounded-3xl p-6 sm:p-8"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.12)',
          }}
        >
          <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400 mb-6">
            Flexible payment options
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                icon: <IconCreditCard size={18} stroke={2} />,
                title: 'Pay online instantly',
                desc: 'Secure checkout via Razorpay — activate your plan in minutes.',
              },
              {
                icon: <IconShield size={18} stroke={2} />,
                title: 'Submit payment proof',
                desc: 'UPI or bank transfer with manual verification by our team.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <span
                  className="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                  style={{ background: 'rgba(255,107,53,0.08)', color: '#FF6B35' }}
                >
                  {item.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </WebsitePageGutters>

      <PaymentRequestModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        planId={selectedPlan}
        amount={selectedAmount}
        sellerEmail={currentUser?.email || ''}
        onSuccess={() => onSelectPlan(selectedPlan)}
        onManualSubmitted={() => {
          setPendingPlanId(selectedPlan);
        }}
        onNotify={(msg, type) => addToast?.(msg, type)}
      />
    </div>
  );
};

export default PricingPage;
