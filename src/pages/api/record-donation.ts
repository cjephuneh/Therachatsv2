import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/integrations/supabase/client';

// Paystack API for verifying transactions
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
    const { reference, amount, email, user_id } = req.body;

    // Validate required fields
    if (!reference) {
      return res.status(400).json({ 
        error: 'Missing required field: reference' 
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

    if (!verifyResponse.ok || !verifyData.status) {
      console.error('Paystack verification failed:', verifyData);
      return res.status(400).json({ 
        error: 'Payment verification failed',
        details: verifyData.message || 'Transaction not found or failed'
      });
    }

    // Check if transaction is successful
    if (verifyData.data.status !== 'success') {
      return res.status(400).json({ 
        error: 'Payment not successful',
        status: verifyData.data.status
      });
    }

    // Record donation in Supabase
    const { error: insertError } = await supabase
      .from('donations')
      .insert({
        reference: reference,
        amount: verifyData.data.amount / 100, // Convert from kobo to Naira
        email: verifyData.data.customer.email,
        user_id: user_id || null,
        status: 'completed',
        payment_method: verifyData.data.channel,
        created_at: new Date().toISOString(),
        verified_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to record donation',
        details: insertError.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Donation recorded successfully',
      data: {
        reference: reference,
        amount: verifyData.data.amount / 100,
        status: verifyData.data.status
      }
    });

  } catch (error) {
    console.error('Record donation API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}