import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { handleDonationSuccess } from '@/services/donationService';
import Link from 'next/link';

type PaymentStatus = 'processing' | 'success' | 'failed';

export default function PaymentCallback() {
  const router = useRouter();
  const { reference, trxref } = router.query;
  const [status, setStatus] = useState<PaymentStatus>('processing');
  const [message, setMessage] = useState<string>('Processing your payment...');

  useEffect(() => {
    async function verifyPayment() {
      if (reference || trxref) {
        try {
          const ref = (reference || trxref) as string;
          const response = await fetch(`/api/verify-payment?reference=${ref}`);
          const data = await response.json();
          
          if (data.status && data.data?.status === 'success') {
            setStatus('success');
            setMessage('Your donation was successful! Thank you for your support.');
            handleDonationSuccess(ref);
          } else {
            setStatus('failed');
            setMessage('Payment verification failed: ' + (data.message || data.data?.gateway_response || 'Unknown error'));
            toast.error('Payment verification failed');
          }
        } catch (error) {
          console.error('Error verifying payment:', error);
          setStatus('failed');
          setMessage('An error occurred while verifying your payment. Please contact support.');
          toast.error('Payment verification error');
        }
      } else if (router.isReady) {
        // If no reference is found but router is ready
        setStatus('failed');
        setMessage('No payment reference found. Please try again or contact support.');
      }
    }

    if (router.isReady) {
      verifyPayment();
    }
  }, [router.isReady, reference, trxref, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-background rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">
          {status === 'processing' ? 'Processing Payment' : 
           status === 'success' ? 'Payment Successful' : 'Payment Failed'}
        </h1>
        
        <div className="text-center mb-6">
          {status === 'processing' && (
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          )}

          {status === 'success' && (
            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {status === 'failed' && (
            <div className="h-12 w-12 bg-red-100 text-red-600 rounded-full mx-auto flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
        
        <p className="text-center mb-6">{message}</p>
        
        <div className="flex justify-center">
          <Link href="/">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Return to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
