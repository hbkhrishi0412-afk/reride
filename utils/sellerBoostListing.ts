import { BOOST_PACKAGES } from '../constants/boost.js';
import type { User, Vehicle } from '../types.js';
import { buildVehicleMutationBody } from './vehicleIdentity.js';

/** Razorpay checkout + verified boost API call for seller listings. */
export async function executeSellerBoostListing(deps: {
  vehicleId: number;
  packageId: string;
  seller: Pick<User, 'email' | 'name'>;
  sellerVehicles: Vehicle[];
}): Promise<Vehicle> {
  const { vehicleId, packageId, seller, sellerVehicles } = deps;
  const pkg = BOOST_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error('Unknown boost package. Please refresh and try again.');
  }

  const { openRazorpayBoostCheckout, isRazorpayConfiguredInClient } = await import(
    '../services/razorpayPlanPayment.js'
  );
  if (!isRazorpayConfiguredInClient()) {
    throw new Error('Online payments are not configured. Please contact support to boost listings.');
  }

  const razorpayProof = await new Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amountInr: number;
  }>((resolve, reject) => {
    openRazorpayBoostCheckout({
      vehicleId,
      packageId,
      packageName: pkg.name,
      amountInr: Number(pkg.price) || 0,
      sellerEmail: seller.email,
      sellerName: seller.name,
      onSuccess: (proof) => resolve(proof),
      onFailure: (message) => reject(new Error(message)),
    });
  });

  const { authenticatedFetch } = await import('../utils/authenticatedFetch.js');
  const response = await authenticatedFetch('/api/vehicles?action=boost', {
    method: 'POST',
    body: JSON.stringify(
      buildVehicleMutationBody(vehicleId, sellerVehicles, {
        packageId,
        sellerEmail: seller.email,
        razorpay_order_id: razorpayProof.razorpay_order_id,
        razorpay_payment_id: razorpayProof.razorpay_payment_id,
        razorpay_signature: razorpayProof.razorpay_signature,
        amount: razorpayProof.amountInr,
      }),
    ),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let reason = `Server returned status ${response.status}`;
    if (contentType.includes('application/json')) {
      try {
        const err = await response.json();
        reason = err.reason || err.error || err.message || reason;
      } catch {
        /* ignore parse errors */
      }
    }
    throw new Error(reason);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response format. Please try again.');
  }

  const result = await response.json();
  if (result?.success && result?.vehicle) {
    return result.vehicle as Vehicle;
  }
  throw new Error(result?.reason || result?.error || 'Failed to boost listing.');
}
