import type { PlanDetails, SubscriptionPlan } from '../types';

// Lazy-load Plan model only when needed (server-side only)
let PlanModel: any = null;
let planModelPromise: Promise<any> | null = null;

const getPlanModel = async () => {
  // Return null immediately if in browser
  if (typeof window !== 'undefined') {
    return null;
  }
  
  // Return cached model if already loaded
  if (PlanModel !== null) {
    return PlanModel;
  }
  
  // Return existing promise if already loading
  if (planModelPromise) {
    return planModelPromise;
  }
  
  // Lazy load the model
  planModelPromise = (async () => {
    try {
      const PlanModule = await import('../models/Plan.js');
      PlanModel = PlanModule.default;
      return PlanModel;
    } catch (e) {
      // Plan model not available (e.g., in browser or build time)
      return null;
    }
  })();
  
  return planModelPromise;
};

export const planService = {
    // Get plan details with any updates applied
    getPlanDetails: async (planId: SubscriptionPlan): Promise<PlanDetails> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        const basePlan = PLAN_DETAILS[planId];
        
        try {
            // Only access database if Plan model is available (server-side only)
            const Plan = await getPlanModel();
            if (!Plan) {
                return basePlan;
            }
            // Try to get plan updates from database
            const planUpdate = await Plan.findOne({ planId, isCustom: false });
            if (planUpdate) {
                return {
                    ...basePlan,
                    name: planUpdate.name || basePlan.name,
                    price: planUpdate.price ?? basePlan.price,
                    features: planUpdate.features || basePlan.features,
                    listingLimit: planUpdate.listingLimit ?? basePlan.listingLimit,
                    featuredCredits: planUpdate.featuredCredits ?? basePlan.featuredCredits,
                    freeCertifications: planUpdate.freeCertifications ?? basePlan.freeCertifications,
                    isMostPopular: planUpdate.isMostPopular ?? basePlan.isMostPopular,
                };
            }
        } catch (error) {
            // If database is unavailable, return base plan
            console.warn('Failed to load plan updates from database:', error);
        }
        
        return basePlan;
    },

    // Get custom plan details
    getCustomPlanDetails: async (planId: string): Promise<PlanDetails | null> => {
        try {
            const Plan = await getPlanModel();
            // Browser fallback - return null since database access not available
            if (!Plan) {
                return null;
            }
            const plan = await Plan.findOne({ planId, isCustom: true });
            if (!plan) {
                return null;
            }
            
            return {
                id: plan.planId,
                name: plan.name,
                price: plan.price,
                features: plan.features,
                listingLimit: plan.listingLimit,
                featuredCredits: plan.featuredCredits,
                freeCertifications: plan.freeCertifications,
                isMostPopular: plan.isMostPopular || false,
            };
        } catch (error) {
            console.warn('Failed to load custom plan from database:', error);
            return null;
        }
    },

    // Get all plan details with updates applied (max 4 plans)
    getAllPlans: async (): Promise<PlanDetails[]> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        const basePlans = await Promise.all(
            Object.keys(PLAN_DETAILS).map(planId => 
                planService.getPlanDetails(planId as SubscriptionPlan)
            )
        );
        
        try {
            const Plan = await getPlanModel();
            // Browser fallback - return only base plans
            if (!Plan) {
                return basePlans.slice(0, 4);
            }
            // Add custom plans from database
            const customPlans = await Plan.find({ isCustom: true })
                .sort({ createdAt: -1 })
                .limit(4 - basePlans.length);
            
            const customPlanDetails = await Promise.all(
                customPlans.map((plan: any) => planService.getCustomPlanDetails(plan.planId))
            );
            
            const validCustomPlans = customPlanDetails.filter((plan): plan is PlanDetails => plan !== null);
            return [...basePlans, ...validCustomPlans].slice(0, 4); // Max 4 plans
        } catch (error) {
            console.warn('Failed to load custom plans from database:', error);
            return basePlans.slice(0, 4);
        }
    },

    // Update plan details
    updatePlan: async (planId: SubscriptionPlan | string, updates: Partial<PlanDetails>): Promise<void> => {
        const Plan = await getPlanModel();
        // Browser fallback - throw error since database access not available
        if (!Plan) {
            throw new Error('Plan updates are only available server-side');
        }
        try {
            const { PLAN_DETAILS } = await import('../constants.js');
            const basePlan = PLAN_DETAILS[planId as SubscriptionPlan];
            const isCustom = !basePlan;
            
            await Plan.findOneAndUpdate(
                { planId },
                {
                    $set: {
                        planId,
                        basePlanId: isCustom ? undefined : planId,
                        name: updates.name || basePlan?.name || 'Custom Plan',
                        price: updates.price ?? basePlan?.price ?? 0,
                        features: updates.features || basePlan?.features || [],
                        listingLimit: updates.listingLimit ?? basePlan?.listingLimit ?? 0,
                        featuredCredits: updates.featuredCredits ?? basePlan?.featuredCredits ?? 0,
                        freeCertifications: updates.freeCertifications ?? basePlan?.freeCertifications ?? 0,
                        isMostPopular: updates.isMostPopular ?? basePlan?.isMostPopular ?? false,
                        isCustom,
                        updatedAt: new Date().toISOString(),
                    }
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Failed to update plan in database:', error);
            throw new Error('Failed to update plan');
        }
    },

    // Create new plan
    createPlan: async (planData: Omit<PlanDetails, 'id'>): Promise<string> => {
        const Plan = await getPlanModel();
        // Browser fallback - throw error since database access not available
        if (!Plan) {
            throw new Error('Plan creation is only available server-side');
        }
        try {
            const planId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            
            await Plan.create({
                planId,
                basePlanId: undefined,
                name: planData.name,
                price: planData.price,
                features: planData.features,
                listingLimit: planData.listingLimit,
                featuredCredits: planData.featuredCredits,
                freeCertifications: planData.freeCertifications,
                isMostPopular: planData.isMostPopular || false,
                isCustom: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            
            return planId;
        } catch (error) {
            console.error('Failed to create plan in database:', error);
            throw new Error('Failed to create plan');
        }
    },

    // Delete custom plan
    deletePlan: async (planId: string): Promise<boolean> => {
        const Plan = await getPlanModel();
        // Browser fallback - return false since database access not available
        if (!Plan) {
            return false;
        }
        try {
            const { PLAN_DETAILS } = await import('../constants.js');
            if (PLAN_DETAILS[planId as SubscriptionPlan]) {
                // Cannot delete base plans
                return false;
            }
            
            const result = await Plan.deleteOne({ planId, isCustom: true });
            return result.deletedCount > 0;
        } catch (error) {
            console.error('Failed to delete plan from database:', error);
            return false;
        }
    },

    // Load plan updates from database (no-op, data is loaded on-demand)
    loadPlanUpdates: async (): Promise<void> => {
        // No-op: Plans are loaded from database on-demand
        // This method is kept for backward compatibility
    },

    // Reset plan updates (for testing)
    resetPlanUpdates: async (): Promise<void> => {
        const Plan = await getPlanModel();
        // Browser fallback - no-op
        if (!Plan) {
            return;
        }
        try {
            await Plan.deleteMany({ isCustom: false });
        } catch (error) {
            console.error('Failed to reset plan updates in database:', error);
        }
    },

    // Get original plan details without updates
    getOriginalPlanDetails: async (planId: SubscriptionPlan): Promise<PlanDetails> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        return PLAN_DETAILS[planId];
    },

    // Check if plan has been modified
    isPlanModified: async (planId: SubscriptionPlan): Promise<boolean> => {
        const Plan = await getPlanModel();
        // Browser fallback - return false since database access not available
        if (!Plan) {
            return false;
        }
        try {
            const plan = await Plan.findOne({ planId, isCustom: false });
            return plan !== null;
        } catch (error) {
            console.warn('Failed to check if plan is modified:', error);
            return false;
        }
    },

    // Check if plan limit is reached
    canAddNewPlan: async (): Promise<boolean> => {
        const plans = await planService.getAllPlans();
        return plans.length < 4;
    },

    // Get plan count
    getPlanCount: async (): Promise<number> => {
        const plans = await planService.getAllPlans();
        return plans.length;
    }
};
