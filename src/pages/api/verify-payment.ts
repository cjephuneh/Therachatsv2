import { NextApiRequest, NextApiResponse } from 'next';

// Paystack API for verifying transactions
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reference } = req.query;

    // Validate required fields
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required parameter: reference' 
      });
    }

    // Verify transaction with Paystack
    const verifyResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      console.error('Paystack verification failed:', verifyData);
      return res.status(400).json({ 
        error: 'Payment verification failed',
        details: verifyData.message || 'Transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        reference: verifyData.data.reference,
        amount: verifyData.data.amount / 100, // Convert from kobo to Naira
        status: verifyData.data.status,
        email: verifyData.data.customer.email,
        payment_method: verifyData.data.channel,
        paid_at: verifyData.data.paid_at
      }
    });

  } catch (error) {
    console.error('Verify payment API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}