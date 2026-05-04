// Client-side API service for sell car submissions
// This file should only contain client-side code, not server-side MongoDB imports
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch';

interface SellCarSubmission {
  registration: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  /** Indian state or UT name (matches sell flow picker). */
  state: string;
  district: string;
  noOfOwners: string;
  kilometers: string;
  fuelType: string;
  transmission: string;
  customerContact: string;
  submittedAt: string;
  status: 'pending' | 'contacted' | 'completed' | 'rejected';
  adminNotes?: string;
  estimatedPrice?: number;
  _id?: string;
}

class SellCarAPI {
  async submitCarData(data: Omit<SellCarSubmission, 'submittedAt' | 'status' | '_id'>): Promise<{ success: boolean; id?: string; message: string; error?: string }> {
    try {
      const response = await authenticatedFetch('/api/sell-car', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        }),
      });

      const result = await handleApiResponse<{ success: boolean; id?: string; message: string; error?: string }>(response);
      if (!result.success || !result.data?.success) {
        throw new Error(result.data?.error || result.reason || result.error || 'Failed to submit car data');
      }
      return result.data;
    } catch (error) {
      console.error('Error submitting car data:', error);
      
      // Fallback for demo purposes when API is not available
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.log('API not available, using demo mode');
        return {
          success: true,
          id: 'demo-' + Date.now(),
          message: 'Car details submitted successfully! (Demo Mode - API not available)'
        };
      }
      
      return {
        success: false,
        message: 'Failed to submit car details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getSubmissions(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}): Promise<{ success: boolean; data?: SellCarSubmission[]; pagination?: any; error?: string }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.status) queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);

      const response = await authenticatedFetch(`/api/sell-car?${queryParams.toString()}`);
      const result = await handleApiResponse<{ success: boolean; data?: SellCarSubmission[]; pagination?: any; error?: string }>(response);
      if (!result.success || result.data?.success === false) {
        throw new Error(result.data?.error || result.reason || result.error || 'Failed to fetch submissions');
      }
      return result.data || { success: true, data: [] };
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateSubmission(id: string, updates: {
    status?: string;
    adminNotes?: string;
    estimatedPrice?: number;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await authenticatedFetch('/api/sell-car', {
        method: 'PUT',
        body: JSON.stringify({ id, ...updates }),
      });

      const result = await handleApiResponse<{ success: boolean; message?: string; error?: string }>(response);
      if (!result.success || result.data?.success === false) {
        throw new Error(result.data?.error || result.reason || result.error || 'Failed to update submission');
      }
      return result.data || { success: true };
    } catch (error) {
      console.error('Error updating submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteSubmission(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await authenticatedFetch(`/api/sell-car?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      const result = await handleApiResponse<{ success: boolean; message?: string; error?: string }>(response);
      if (!result.success || result.data?.success === false) {
        throw new Error(result.data?.error || result.reason || result.error || 'Failed to delete submission');
      }
      return result.data || { success: true };
    } catch (error) {
      console.error('Error deleting submission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const sellCarAPI = new SellCarAPI();
export type { SellCarSubmission };

