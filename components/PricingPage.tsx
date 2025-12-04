import React, { useState, useEffect } from 'react';
import type { User, PlanDetails, SubscriptionPlan } from '../types';
// Removed blocking import - will lazy load PLAN_DETAILS when needed
import { planService } from '../services/planService';
import PaymentRequestModal from './PaymentRequestModal';

interface PricingPageProps {
    currentUser: User | null;
    onSelectPlan: (planId: 'free' | 'pro' | 'premium') => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ currentUser, onSelectPlan }) => {
    const [plans, setPlans] = useState<PlanDetails[]>([]);
    const currentPlanId = currentUser?.subscriptionPlan;
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro');
    const [selectedAmount, setSelectedAmount] = useState(0);

    // Load plans from service
    useEffect(() => {
        const loadPlans = async () => {
            try {
                const plansData = await planService.getAllPlans();
                setPlans(plansData);
            } catch (error) {
                console.error('Failed to load plans:', error);
            }
        };
        loadPlans();
    }, []);

    const handlePlanSelect = async (planId: SubscriptionPlan) => {
        if (planId === 'free') {
            // Free plan - direct selection
            onSelectPlan(planId);
        } else {
            // Paid plan - show payment modal
            setSelectedPlan(planId);
            try {
                const planDetails = await planService.getPlanDetails(planId);
                setSelectedAmount(planDetails.price);
                setShowPaymentModal(true);
            } catch (error) {
                console.error('Failed to get plan details:', error);
            }
        }
    };

    const handlePaymentSuccess = () => {
        onSelectPlan(selectedPlan);
    };

    return (
        <div className="bg-white dark:bg-white py-12 sm:py-20 animate-fade-in">
            <div className="container mx-auto">
                <div className="max-w-2xl mx-auto text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-spinny-text-dark dark:text-white">
                        Find the Perfect Plan for Your Dealership
                    </h1>
                    <p className="mt-4 text-lg text-brand-gray-600 dark:text-spinny-text">
                        Unlock powerful tools to sell your vehicles faster. Choose a plan that fits your needs.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`bg-white rounded-2xl shadow-soft-lg p-8 flex flex-col transition-transform duration-300 ${plan.isMostPopular ? 'transform lg:scale-105 border-2 shadow-glow' : ''}`} style={plan.isMostPopular ? { borderColor: '#FF6B35' } : undefined}
                        >
                            {plan.isMostPopular && (
                                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                                    <span className="text-white text-xs font-bold px-4 py-1 rounded-full uppercase" style={{ background: '#FF6B35' }}>
                                        Most Popular
                                    </span>
                                </div>
                            )}
                            <h3 className="text-2xl font-bold text-spinny-text-dark dark:text-white">{plan.name}</h3>
                            <p className="mt-4 text-4xl font-extrabold text-spinny-text-dark dark:text-white">
                                ₹{plan.price.toLocaleString('en-IN')}
                                <span className="text-base font-medium text-spinny-text dark:text-spinny-text">/month</span>
                            </p>
                            <p className="mt-2 text-sm text-spinny-text dark:text-spinny-text">
                                {plan.id === 'free' ? 'Get started for free' : 'Billed monthly'}
                            </p>

                            <ul className="mt-8 space-y-4 text-brand-gray-600 dark:text-spinny-text-dark flex-grow">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start">
                                        <svg className="w-5 h-5 text-spinny-orange mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                        </svg>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handlePlanSelect(plan.id)}
                                disabled={currentPlanId === plan.id}
                                className={`mt-10 w-full font-bold py-3 px-6 rounded-lg text-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed
                                    ${currentPlanId === plan.id
                                        ? 'bg-gray-300 text-gray-600'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
                                    }`}
                            >
                                {currentPlanId === plan.id ? 'Current Plan' : plan.id === 'free' ? 'Choose Plan' : 'Pay & Upgrade'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Request Modal */}
            <PaymentRequestModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                planId={selectedPlan}
                amount={selectedAmount}
                sellerEmail={currentUser?.email || ''}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default PricingPage;
