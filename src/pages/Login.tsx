import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { signInWithGoogle } from '@/services/authService';
import SEO from '@/components/SEO';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        console.log('Login successful, navigating to home page');
        navigate('/');
      } else {
        console.log('Login failed');
        toast.error('Login failed. Please check your credentials.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const success = await signInWithGoogle();
      if (!success) {
        setGoogleLoading(false);
      }
      // Note: We don't navigate here because the OAuth flow will redirect the user
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Google login failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Login to Your Account" 
        description="Log in to TheraChat to continue your mental wellness journey with our AI support assistant."
      />
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-therabot-dark dark:text-therabot-primary">TheraChat</h1>
            <p className="mt-2 text-gray-600 dark:text-muted-foreground">Your supportive mental health companion</p>
          </div>
          
          <div className="mt-8 bg-background p-6 shadow-md rounded-lg border">
            <h2 className="text-xl font-semibold mb-6 text-center">Log in to your account</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button 
                className="w-full bg-therabot-primary hover:bg-therabot-secondary" 
                type="submit"
                disabled={isLoading || googleLoading}
              >
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>
              
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-gray-300 absolute w-full"></div>
                <div className="bg-background px-4 text-sm text-muted-foreground relative">or</div>
              </div>
              
              <Button 
                type="button"
                className="w-full border border-input bg-background text-foreground hover:bg-muted"
                onClick={handleGoogleLogin}
                disabled={isLoading || googleLoading}
              >
                {googleLoading ? (
                  "Connecting to Google..."
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center text-sm">
              <p>
                Don't have an account?{' '}
                <Link to="/register" className="text-therabot-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-therabot-softPurple rounded-lg mt-8">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-left">
                <strong>Important:</strong> You're not alone — TheraChat is here to support you.
                While TheraChat is an AI companion and not a replacement for professional mental health services, it's here to listen, encourage, and help you navigate tough moments.</p>
            </div>
          </div>
          
          <div className="bg-background p-4 rounded-lg mt-4 border border-blue-200">
            <div className="flex items-start">
              <p className="text-sm text-blue-600">
                <strong>New:</strong> Try our voice chat feature at <a href="https://talktothera.com" className="underline">talktothera.com</a>!
              </p>
            </div>
          </div>
          
          {/* For testing - Quick login */}
          {/* <div className="text-center mt-4">
            <p className="text-xs text-gray-500 dark:text-muted-foreground">
              For testing, you can use any email and password
            </p>
          </div> */}
        </div>
      </div>
    </>
  );
};

export default Login;
