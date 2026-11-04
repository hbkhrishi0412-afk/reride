import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { View } from '../../types';
import { invalidateBrowserPlansCache, planService } from '../../services/planService';
import { planDetailsForSeller } from '../../utils/listingPlanRules.js';
import { CLIENT_POLL_INTERVALS_MS } from '../../utils/clientPolling.js';
import {
    fetchOwnSellerProfile,
    mergeSellerPlanFields,
    publishCurrentUserPlanUpdate,
    sellerPlanFieldsChanged,
} from '../../utils/sellerPlanSync.js';

export const PlanStatusCard: React.FC<{
    seller: User;
    activeListingsCount: number;
    featuredListingsCount: number;
    onNavigate: (view: View) => void;
}> = memo(({ seller, activeListingsCount, featuredListingsCount, onNavigate }) => {
    const { t } = useTranslation();
    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Real-time update state for expiry dates
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Real-time expiry date updates - update every minute (UI only, no API)
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, CLIENT_POLL_INTERVALS_MS.uiClock);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let active = true;

        const syncSellerProfile = async () => {
            const fresh = await fetchOwnSellerProfile(seller.email);
            if (!active || !fresh) return;
            if (!sellerPlanFieldsChanged(seller, fresh)) return;
            publishCurrentUserPlanUpdate(mergeSellerPlanFields(seller, fresh));
        };

        const loadPlan = async (silent = false, bustCache = false) => {
            if (!silent) setLoading(true);
            try {
                if (bustCache) invalidateBrowserPlansCache();
                const planDetails = await planService.getPlanDetails(seller.subscriptionPlan || 'free');
                if (!active) return;
                setPlan(planDetails);
            } catch (error) {
                console.error('Failed to load plan details:', error);
                if (!active) return;
                setPlan({
                    ...planDetailsForSeller(seller),
                    name: t('sellerDashboard.freePlanName'),
                });
            } finally {
                if (active) setLoading(false);
            }
        };

        const reloadOnVisibility = () => {
            if (document.visibilityState === 'visible') {
                void syncSellerProfile();
                void loadPlan(true, true);
            }
        };
        const reloadOnPlanConfigUpdate = () => void loadPlan(true, true);
        const reloadOnStoragePlanUpdate = (event: StorageEvent) => {
            if (event.key === 'reRidePlanConfigUpdatedAt') void loadPlan(true, true);
        };

        setPlan(planDetailsForSeller(seller));
        void syncSellerProfile();
        void loadPlan(false);
        window.addEventListener('focus', reloadOnVisibility);
        document.addEventListener('visibilitychange', reloadOnVisibility);
        window.addEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
        window.addEventListener('storage', reloadOnStoragePlanUpdate);
        const pollId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void syncSellerProfile();
                void loadPlan(true);
            }
        }, CLIENT_POLL_INTERVALS_MS.sellerConversations);

        return () => {
            active = false;
            window.clearInterval(pollId);
            window.removeEventListener('focus', reloadOnVisibility);
            document.removeEventListener('visibilitychange', reloadOnVisibility);
            window.removeEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
            window.removeEventListener('storage', reloadOnStoragePlanUpdate);
        };
    }, [seller, seller.subscriptionPlan, t]);
    
    if (loading || !plan) {
        return (
            <div className="text-white p-6 rounded-lg shadow-lg flex flex-col h-full" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{t('sellerDashboard.planStatus')}</h3>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                </div>
                <p className="text-sm opacity-90">{t('sellerDashboard.loadingPlan')}</p>
            </div>
        );
    }
    
    const listingLimit = plan.listingLimit === 'unlimited' ? Infinity : plan.listingLimit;
    const planFeaturedCredits = typeof plan.featuredCredits === 'number' ? plan.featuredCredits : 0;
    const storedRemainingCredits = typeof seller.featuredCredits === 'number'
        ? seller.featuredCredits
        : planFeaturedCredits;
    const featuredCreditsAfterUsage = Math.max(planFeaturedCredits - featuredListingsCount, 0);
    const effectiveFeaturedCredits = Math.min(storedRemainingCredits, featuredCreditsAfterUsage);
    const usagePercentage = listingLimit === Infinity ? 0 : (activeListingsCount / listingLimit) * 100;
    // Use currentTime for real-time updates
    const planIsExpired = !!seller.planExpiryDate && new Date(seller.planExpiryDate) < currentTime;

    return (
        <div className="text-white p-6 rounded-lg shadow-lg flex flex-col h-full" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}>
            <h3 className="text-lg font-bold flex justify-between items-center">
                <span>
                  {t('sellerDashboard.yourPlanLabel')}{' '}
                  <span className="text-reride-text-dark">{plan.name}</span>
                </span>
            </h3>
            <div className="mt-4 space-y-3 text-sm flex-grow">
                <div className="flex justify-between">
                    <span>{t('sellerDashboard.activeListingsLabel')}</span>
                    <span className="font-semibold">{activeListingsCount} / {plan.listingLimit === 'unlimited' ? '∞' : plan.listingLimit}</span>
                </div>
                <div className="w-full rounded-full h-2 mb-2" style={{ background: 'rgba(30, 136, 229, 0.1)' }}>
                    <div
                        className="bg-reride-blue h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between">
                    <span>{t('sellerDashboard.featuredCreditsLabel')}</span>
                    <span className="font-semibold">
                      {t('sellerDashboard.featuredRemaining', { count: effectiveFeaturedCredits })}
                    </span>
                </div>
                 <div className="flex justify-between">
                    <span>{t('sellerDashboard.freeCertificationsLabel')}</span>
                    <span className="font-semibold">
                      {t('sellerDashboard.featuredRemaining', {
                        count: Math.max((plan.freeCertifications ?? 0) - (seller.usedCertifications || 0), 0),
                      })}
                    </span>
                </div>

                {/* Always show expiry date section */}
                <div className="mt-4 pt-4 border-t border-reride-white/20 space-y-2">
                    {seller.planActivatedDate && (
                        <div className="flex justify-between text-xs">
                            <span>{t('sellerDashboard.planActivated')}</span>
                            <span className="font-semibold">
                                {new Date(seller.planActivatedDate).toLocaleDateString('en-IN', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs">
                        <span>{t('sellerDashboard.expiryDate')}</span>
                        {seller.planExpiryDate ? (
                            <span className={`font-semibold ${
                                (() => {
                                    const expiryDate = new Date(seller.planExpiryDate);
                                    const isExpired = expiryDate < currentTime;
                                    const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                                    if (isExpired) return 'text-red-300';
                                    if (daysRemaining <= 7) return 'text-orange-300';
                                    return '';
                                })()
                            }`}>
                                {new Date(seller.planExpiryDate).toLocaleDateString('en-IN', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                                {(() => {
                                    const expiryDate = new Date(seller.planExpiryDate);
                                    const isExpired = expiryDate < currentTime;
                                    const daysRemaining = Math.ceil((expiryDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
                                    if (isExpired) {
                                        return (
                                          <span className="ml-2 text-red-200 font-bold">{t('sellerDashboard.expired')}</span>
                                        );
                                    }
                                    if (daysRemaining <= 30 && daysRemaining > 0) {
                                        return (
                                          <span className="ml-2 text-orange-200">
                                            {daysRemaining === 1
                                              ? t('sellerDashboard.dayLeft')
                                              : t('sellerDashboard.daysLeft', { count: daysRemaining })}
                                          </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </span>
                        ) : (
                            <span className="font-semibold text-gray-300 text-xs">{t('sellerDashboard.notSet')}</span>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-reride-white/20">
                    <h4 className="font-semibold mb-2">{t('sellerDashboard.planFeatures')}</h4>
                    <ul className="space-y-2 text-xs">
                        {(plan.features || []).map((feature: string) => (
                            <li key={feature} className="flex items-start">
                                <svg className="w-4 h-4 text-reride-orange mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                </svg>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="mt-6 space-y-2">
                {(planIsExpired || plan.id !== 'premium') && (
                    <button
                        onClick={() => onNavigate(View.PRICING)}
                        className="w-full bg-white text-reride-orange font-bold py-2 px-4 rounded-lg hover:bg-white transition-colors"
                    >
                        {planIsExpired ? t('sellerDashboard.renewPlan') : t('sellerDashboard.upgradePlan')}
                    </button>
                )}
                <button
                    onClick={() => onNavigate(View.PRICING)}
                    className="w-full border border-white/40 text-white font-semibold py-2 px-4 rounded-lg hover:bg-white/10 transition-colors"
                >
                    View all plans
                </button>
            </div>
        </div>
    );
});
