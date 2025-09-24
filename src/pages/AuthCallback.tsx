import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleAuthCallback } from '@/services/authService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const AuthCallback = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = useAuth(); // Get the entire auth object instead of destructuring

  useEffect(() => {
    const processAuth = async () => {
      try {
        console.log('Processing auth callback...');
        
        // Check if we have URL fragments that need to be processed
        if (window.location.hash) {
          console.log('URL hash detected:', window.location.hash);
        }
        
        const user = await handleAuthCallback();
        if (user) {
          console.log('Auth callback successful, user:', user.id);
          
          // Check how auth should be updated
          if (typeof auth.login === 'function') {
            // If there's a login function, use that
            await auth.login(user.email, '', user); // Pass the user object as an optional param
          } else if (typeof auth.setAuth === 'function') {
            // If there's a setAuth function, use that
            auth.setAuth({
              isAuthenticated: true,
              user,
              isLoading: false
            });
          } else {
            console.log('Auth methods available:', Object.keys(auth));
            // Fallback to navigate only
            toast.success('Successfully signed in with Google!');
          }
          
          // Redirect to home page regardless
          navigate('/', { replace: true });
        } else {
          console.error('Auth callback failed: No user returned');
          setError('Failed to complete authentication');
          toast.error('Authentication failed');
          // Redirect back to login after a delay
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication process failed');
        toast.error('Authentication process failed');
        // Redirect back to login after a delay
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    processAuth();
  }, [navigate, auth]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md text-center">
        {error ? (
          <div>
            <h2 className="text-xl font-semibold text-red-600">Authentication Error</h2>
            <p className="mt-2 text-gray-600">{error}</p>
            <p className="mt-4">Redirecting you back to the login page...</p>
            <div className="mt-4 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold">Completing sign-in</h2>
            <p className="mt-2 text-gray-600">Please wait while we finish setting up your account...</p>
            <div className="mt-4 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-therabot-primary"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
