import React, { useState, useEffect } from 'react';
import type { User, PlanDetails, SubscriptionPlan } from '../types';
import { planService } from '../services/planService';

interface MobilePricingPageProps {
  currentUser: User | null;
  onSelectPlan: (planId: 'free' | 'pro' | 'premium') => void;
  onNavigate?: (view: any) => void;
}

/**
 * Mobile-Optimized Pricing Page
 * Features:
 * - Card-based plan display
 * - Touch-friendly selection
 * - Simplified mobile layout
 */
export const MobilePricingPage: React.FC<MobilePricingPageProps> = ({ currentUser, onSelectPlan, onNavigate }) => {
  const [plans, setPlans] = useState<PlanDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentPlanId = currentUser?.subscriptionPlan;

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const plansData = await planService.getAllPlans();
        setPlans(plansData);
      } catch (error) {
        console.error('Failed to load plans:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPlans();
  }, []);

  const handlePlanSelect = async (planId: SubscriptionPlan) => {
    onSelectPlan(planId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
        <p className="text-gray-600 text-sm">Unlock powerful tools to sell faster</p>
      </div>

      {/* Plans */}
      <div className="px-4 py-6 space-y-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
              plan.isMostPopular ? 'border-orange-500' : 'border-gray-200'
            }`}
          >
            {plan.isMostPopular && (
              <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">
                MOST POPULAR
              </div>
            )}
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
            
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900">
                ₹{plan.price.toLocaleString('en-IN')}
              </span>
              <span className="text-gray-600">/month</span>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-700 text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePlanSelect(plan.id)}
              disabled={currentPlanId === plan.id}
              className={`w-full py-3 rounded-xl font-semibold ${
                currentPlanId === plan.id
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : plan.isMostPopular
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-900 text-white'
              }`}
              style={{ minHeight: '48px' }}
            >
              {currentPlanId === plan.id ? 'Current Plan' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobilePricingPage;












