import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface DonationModalProps {
  onClose: () => void;
}

// Determine if in development environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Paystack public key - should match the same key used on the server
const PAYSTACK_PUBLIC_KEY = 'pk_live_1416e635a685de27fd457dccac6f6214ed90e3ab';

// Declare PaystackPop for TypeScript
declare global {
  interface Window {
    PaystackPop: any;
  }
}

const DonationModal: React.FC<DonationModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('10');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [currency] = useState<string>('USD'); // Fixed to USD
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>(user?.name || '');
  const [paystackLoaded, setPaystackLoaded] = useState<boolean>(false);

  const predefinedAmounts = ['5', '10', '25', '50', '100'];

  // Load Paystack script dynamically
  useEffect(() => {
    // Skip if already loaded
    if (window.PaystackPop || document.getElementById('paystack-script')) {
      setPaystackLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Paystack script');
      toast.error('Payment initialization failed. Please try again.');
    };
    
    document.head.appendChild(script);
    
    // Cleanup
    return () => {
      if (document.getElementById('paystack-script')) {
        document.getElementById('paystack-script')?.remove();
      }
    };
  }, []);

  // Initialize Paystack inline payment
  const initializePaystack = () => {
    if (!window.PaystackPop) {
      console.error('PaystackPop not available');
      toast.error('Payment system not available. Please try again later.');
      return false;
    }

    try {
      const reference = `Donation_${Date.now()}`;
      const amountInKobo = parseFloat(amount) * 100;
      
      const paystack = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: amountInKobo,
        currency: currency,
        ref: reference,
        metadata: {
          custom_fields: [
            {
              display_name: "Name",
              variable_name: "name",
              value: name || "Anonymous"
            },
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: user?.id || "anonymous"
            },
            {
              display_name: "Donation Type",
              variable_name: "donation_type",
              value: "TheraChats Support"
            }
          ]
        },
        onSuccess: (transaction: any) => {
          // Handle successful payment
          console.log('Payment successful', transaction);
          toast.success('Thank you for your donation!');
          onClose();
          
          // Optionally record the donation in your database
          try {
            fetch('/api/record-donation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: transaction.reference,
                amount: parseFloat(amount),
                currency,
                email,
                userId: user?.id,
                name
              })
            });
          } catch (error) {
            console.error('Error recording donation:', error);
          }
        },
        onCancel: () => {
          // Handle payment cancellation
          console.log('Payment cancelled');
          toast.info('Payment cancelled');
          setIsLoading(false);
        },
        onClose: () => {
          // Handle modal close
          console.log('Payment modal closed');
          setIsLoading(false);
        }
      });
      
      paystack.openIframe();
      return true;
    } catch (error) {
      console.error('Paystack initialization error:', error);
      toast.error('Payment initialization failed. Please try again.');
      return false;
    }
  };

  const handleDonation = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);

    try {
      if (paystackLoaded) {
        const initialized = initializePaystack();
        if (!initialized) {
          setIsLoading(false);
          toast.error('Could not initialize payment. Please try again later.');
        }
      } else {
        toast.error('Payment system is still loading. Please try again in a moment.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Donation error:', error);
      toast.error('Something went wrong. Please try again later.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Support TheraChat</h2>
          <button
            className="p-1 hover:bg-gray-100 rounded-full"
            onClick={onClose}
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-6 text-gray-700">
            Your contribution helps us maintain and improve TheraChat. Thank you!
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Amount</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {predefinedAmounts.map((presetAmount) => (
                <Button
                  key={presetAmount}
                  type="button"
                  variant={amount === presetAmount ? 'default' : 'outline'}
                  onClick={() => setAmount(presetAmount)}
                  className="text-center"
                >
                  ${presetAmount}
                </Button>
              ))}
            </div>

            <div className="flex items-center">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                min="1"
                step="1"
                className="flex-1"
              />
            </div>
          </div>

          <Button className="w-full" onClick={handleDonation} disabled={isLoading || !paystackLoaded}>
            {isLoading ? (
              <>
                <span className="mr-2 animate-spin">●</span>
                Processing...
              </>
            ) : !paystackLoaded ? (
              <>
                <span className="mr-2 animate-pulse">●</span>
                Loading payment system...
              </>
            ) : (
              `Donate $${amount}`
            )}
          </Button>

          <p className="mt-4 text-xs text-center text-gray-500">
            Payments are securely processed by Paystack. Your donation may be tax-deductible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DonationModal;
