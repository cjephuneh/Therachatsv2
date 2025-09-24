import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// API endpoint
const PAYSTACK_ENDPOINT = '/api/donate';

// Track donation in Supabase
export const trackDonation = async (amount: number, currency: string, userId?: string): Promise<boolean> => {
  try {
    // Record donation to Supabase if you want to track them
    const { error } = await supabase
      .from('donations')
      .insert({
        amount,
        currency,
        user_id: userId || null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording donation in database:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error tracking donation:', error);
    return false;
  }
};

// Process a donation and get checkout URL
export const processDonation = async (
  email: string,
  amount: number,
  currency: string = 'NGN',
  userId?: string,
  name?: string
): Promise<{ success: boolean; checkoutUrl?: string; message?: string }> => {
  try {
    if (!email || amount <= 0) {
      return { success: false, message: 'Invalid email or amount' };
    }

    const payload = {
      email,
      amount: amount * 100, // Convert to kobo (smallest currency unit)
      currency,
      reference: `Donation_${Date.now()}`,
      metadata: {
        user_id: userId || 'anonymous',
        name: name || 'Anonymous',
        custom_fields: [
          {
            display_name: 'Donation Type',
            variable_name: 'donation_type',
            value: 'TheraChats Support'
          }
        ]
      }
    };

    const response = await fetch(PAYSTACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status && data.data?.authorization_url) {
      // Record the donation intent (even before completing payment)
      await trackDonation(amount, currency, userId);
      
      return {
        success: true,
        checkoutUrl: data.data.authorization_url
      };
    } else {
      console.error('Payment processing error:', data);
      return {
        success: false,
        message: data.message || 'Payment processing failed'
      };
    }
  } catch (error) {
    console.error('Donation processing error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
};

// Handle donation success (to be called after successful redirect)
export const handleDonationSuccess = (reference: string, userId?: string) => {
  toast.success('Thank you for your generous support!');
  
  // Optionally verify the payment with Paystack
  // You can create a verification endpoint that calls Paystack's verify endpoint
  // https://api.paystack.co/transaction/verify/:reference
  
  return true;
};
