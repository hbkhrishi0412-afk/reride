import type { PlanDetails, SubscriptionPlan } from '../types';

// In-memory storage for plan updates (in a real app, this would be a database)
let planUpdates: Partial<Record<SubscriptionPlan, Partial<PlanDetails>>> = {};

export const planService = {
    // Get plan details with any updates applied
    getPlanDetails: async (planId: SubscriptionPlan): Promise<PlanDetails> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        const basePlan = PLAN_DETAILS[planId];
        const updates = planUpdates[planId] || {};
        return { ...basePlan, ...updates };
    },

    // Get custom plan details
    getCustomPlanDetails: (planId: string): PlanDetails | null => {
        const updates = planUpdates[planId as SubscriptionPlan];
        return updates ? { ...updates, id: planId } as PlanDetails : null;
    },

    // Get all plan details with updates applied (max 4 plans)
    getAllPlans: async (): Promise<PlanDetails[]> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        const basePlans = await Promise.all(
            Object.keys(PLAN_DETAILS).map(planId => 
                planService.getPlanDetails(planId as SubscriptionPlan)
            )
        );
        
        // Add custom plans (excluding base plans from custom updates)
        const customPlans = Object.keys(planUpdates)
            .filter(planId => !PLAN_DETAILS[planId as SubscriptionPlan])
            .map(planId => planService.getCustomPlanDetails(planId)!)
            .filter(plan => plan !== null);
        
        return [...basePlans, ...customPlans].slice(0, 4); // Max 4 plans
    },

    // Update plan details
    updatePlan: (planId: SubscriptionPlan | string, updates: Partial<PlanDetails>): void => {
        planUpdates[planId as SubscriptionPlan] = { ...planUpdates[planId as SubscriptionPlan], ...updates };
        
        // Save to localStorage for persistence
        localStorage.setItem('planUpdates', JSON.stringify(planUpdates));
    },

    // Create new plan
    createPlan: (planData: Omit<PlanDetails, 'id'>): string => {
        const planId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        planUpdates[planId as SubscriptionPlan] = planData;
        localStorage.setItem('planUpdates', JSON.stringify(planUpdates));
        
        return planId;
    },

    // Delete custom plan
    deletePlan: async (planId: string): Promise<boolean> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        if (PLAN_DETAILS[planId as SubscriptionPlan]) {
            // Cannot delete base plans
            return false;
        }
        
        delete planUpdates[planId as SubscriptionPlan];
        localStorage.setItem('planUpdates', JSON.stringify(planUpdates));
        return true;
    },

    // Load plan updates from localStorage
    loadPlanUpdates: (): void => {
        try {
            const saved = localStorage.getItem('planUpdates');
            if (saved) {
                planUpdates = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load plan updates:', error);
        }
    },

    // Reset plan updates (for testing)
    resetPlanUpdates: (): void => {
        planUpdates = {};
        localStorage.removeItem('planUpdates');
    },

    // Get original plan details without updates
    getOriginalPlanDetails: async (planId: SubscriptionPlan): Promise<PlanDetails> => {
        const { PLAN_DETAILS } = await import('../constants.js');
        return PLAN_DETAILS[planId];
    },

    // Check if plan has been modified
    isPlanModified: (planId: SubscriptionPlan): boolean => {
        return planUpdates[planId] !== undefined;
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

// Load plan updates on service initialization
planService.loadPlanUpdates();
