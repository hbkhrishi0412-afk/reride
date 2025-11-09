import type { VercelRequest, VercelResponse } from '@vercel/node';
import { planService } from '../services/planService';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get all plans
        const plans = await planService.getAllPlans();
        return res.status(200).json(plans);

      case 'POST':
        // Create new plan
        const newPlanData = req.body;
        if (!newPlanData || !newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }
        
        const planId = planService.createPlan(newPlanData);
        const createdPlan = planService.getCustomPlanDetails(planId);
        
        return res.status(201).json(createdPlan);

      case 'PUT':
        // Update existing plan
        const { planId: updatePlanId, ...updateData } = req.body;
        if (!updatePlanId) {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        planService.updatePlan(updatePlanId, updateData);
        const updatedPlan = await planService.getPlanDetails(updatePlanId as any);
        
        return res.status(200).json(updatedPlan);

      case 'DELETE':
        // Delete plan
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        
        const deleted = await planService.deletePlan(deletePlanId);
        if (!deleted) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }
        
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Plans API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
