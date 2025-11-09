import type { VercelRequest, VercelResponse } from '@vercel/node';
import connectToDatabase from '../lib/db';
import { planService } from '../services/planService';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Route based on business type
    const { type } = req.query;
    
    switch (type) {
      case 'payments':
        return await handlePayments(req, res);
      case 'plans':
        return await handlePlans(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid business type. Use ?type=payments or ?type=plans' 
        });
    }
  } catch (error) {
    console.error('Business API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Payments Handler
async function handlePayments(req: VercelRequest, res: VercelResponse) {
  try {
    await connectToDatabase();

    const { action } = req.query;

    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail, amount, plan, packageId } = req.body;
        
        if (!sellerEmail || !amount || !plan) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email, amount, and plan are required' 
          });
        }

        // Create payment request (simplified for demo)
        const paymentRequest = {
          id: Date.now(),
          sellerEmail,
          amount,
          plan,
          packageId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        return res.status(201).json({
          success: true,
          paymentRequest,
          message: 'Payment request created successfully'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { sellerEmail } = req.query;
        
        if (!sellerEmail) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email is required' 
          });
        }

        // Get payment status (simplified for demo)
        const paymentStatus = {
          sellerEmail: sellerEmail as string,
          status: 'pending',
          lastPayment: null,
          nextDue: null
        };

        return res.status(200).json({
          success: true,
          paymentStatus
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment status',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'approve') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        // Approve payment (simplified for demo)
        return res.status(200).json({
          success: true,
          message: 'Payment request approved successfully',
          paymentRequestId
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to approve payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'reject') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const { paymentRequestId, reason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        // Reject payment (simplified for demo)
        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: reason || 'No reason provided'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to reject payment request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get all payment requests
    if (req.method === 'GET') {
      try {
        // Return empty array for demo (in real implementation, fetch from database)
        const paymentRequests: any[] = [];
        
        return res.status(200).json({
          success: true,
          paymentRequests
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment requests',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return res.status(400).json({ success: false, reason: 'Invalid payment action' });
  } catch (error) {
    console.error('Payments Handler Error:', error);
    return res.status(500).json({
      success: false,
      reason: 'Payments handler failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse) {
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
    console.error('Plans Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
