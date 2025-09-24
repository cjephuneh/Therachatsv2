import { NextApiRequest, NextApiResponse } from 'next';

// Paystack API endpoint for creating a transaction
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, email, reference } = req.body;

    // Validate required fields
    if (!amount || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount and email are required' 
      });
    }

    // Validate amount (should be in kobo for Nigerian Naira)
    const amountInKobo = Math.round(parseFloat(amount) * 100);
    if (amountInKobo < 100) { // Minimum 1 Naira
      return res.status(400).json({ 
        error: 'Amount must be at least 1 Naira' 
      });
    }

    // Create Paystack transaction
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInKobo,
        email: email,
        reference: reference || `payment_${Date.now()}`,
        currency: 'NGN',
        callback_url: `${req.headers.origin}/payment/callback`,
        metadata: {
          custom_fields: [
            {
              display_name: 'Payment Type',
              variable_name: 'payment_type',
              value: 'TheraChat Service'
            }
          ]
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Paystack API error:', data);
      return res.status(400).json({ 
        error: 'Failed to initialize payment',
        details: data.message || 'Unknown error'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference
      }
    });

  } catch (error) {
    console.error('Payment API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}