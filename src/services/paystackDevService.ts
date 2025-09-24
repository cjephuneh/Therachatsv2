/**
 * This service provides direct Paystack integration methods for development environments
 * NOTE: This is for development purposes only and should NOT be used in production
 */

// Paystack test public key - replace with your own test key
const PAYSTACK_TEST_PUBLIC_KEY = 'pk_test_yourtestkeyhere';

interface PaystackPayload {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: {
    [key: string]: any;
  };
}

/**
 * Create a direct Paystack checkout URL without using backend APIs
 * For local development testing only
 */
export const createPaystackCheckoutUrl = (payload: PaystackPayload): string => {
  const params = {
    key: PAYSTACK_TEST_PUBLIC_KEY,
    email: payload.email,
    amount: payload.amount,
    currency: payload.currency,
    ref: payload.reference,
    metadata: JSON.stringify(payload.metadata)
  };
  
  // Create URL encoded parameters
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(typeof value === 'object' ? JSON.stringify(value) : value)}`)
    .join('&');
    
  return `https://checkout.paystack.com/pay?${queryString}`;
};

/**
 * Direct client-side checkout - for development only!
 */
export const initiateDevPaystackCheckout = (payload: PaystackPayload): boolean => {
  try {
    const url = createPaystackCheckoutUrl(payload);
    window.open(url, '_blank');
    return true;
  } catch (error) {
    console.error('Development Paystack checkout error:', error);
    return false;
  }
};
