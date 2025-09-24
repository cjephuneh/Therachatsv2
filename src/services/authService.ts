import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  lastLoginAt: number;
  preferences: {
    theme: 'light' | 'dark';
    notificationsEnabled: boolean;
    therapistEmail?: string;
  };
}

// Authentication states
export type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
};

// Storage keys
const AUTH_STORAGE_KEY = 'therachat_auth';

// Initial auth state
const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
};

// Generate a simple ID with timestamp and random characters
export const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomStr}`;
};

// Local storage for development/demo purposes
export const saveAuthToLocalStorage = (authState: AuthState) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
};

export const getAuthFromLocalStorage = (): AuthState => {
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
  return storedAuth ? JSON.parse(storedAuth) : initialAuthState;
};

// Profile management in Supabase
const createOrUpdateProfile = async (user: User): Promise<boolean> => {
  try {
    // Check if user is authenticated with Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Error saving profile: No authenticated session');
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: new Date(user.createdAt).toISOString(),
        last_login_at: new Date(user.lastLoginAt).toISOString(),
        theme: user.preferences.theme,
        notifications_enabled: user.preferences.notificationsEnabled,
        therapist_email: user.preferences.therapistEmail || null
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error saving profile to Supabase:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error creating/updating profile:', error);
    return false;
  }
};

// Sign in with Google through Supabase
export const signInWithGoogle = async (): Promise<boolean> => {
  try {
    // Get the current URL origin (e.g., http://localhost:8080)
    const origin = window.location.origin;
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Make sure we have the exact format Supabase expects
        redirectTo: `${origin}/auth/callback`
      }
    });
    
    if (error) {
      console.error('Error signing in with Google:', error);
      toast.error(`Google sign-in failed: ${error.message}`);
      return false;
    }
    
    console.log('Google sign-in initiated:', data);
    return true;
  } catch (error) {
    console.error('Exception during Google sign-in:', error);
    toast.error('Google sign-in failed');
    return false;
  }
};

// Handle OAuth callback and user profile creation after successful Google login
export const handleAuthCallback = async (): Promise<User | null> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No session after OAuth callback:', sessionError);
      return null;
    }
    
    const { user: authUser } = session;
    if (!authUser) {
      console.error('No user in session after OAuth callback');
      return null;
    }
    
    // Get existing profile or create new one
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id);
      
    if (profileError) {
      console.error('Error fetching profile after OAuth:', profileError);
    }
    
    const profile = profileData && profileData.length > 0 ? profileData[0] : null;
    
    // Create user object
    const user: User = {
      id: authUser.id,
      email: authUser.email || '',
      name: profile?.name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      createdAt: profile?.created_at ? new Date(profile.created_at).getTime() : Date.now(),
      lastLoginAt: Date.now(),
      preferences: {
        theme: profile?.theme || 'light',
        notificationsEnabled: profile?.notifications_enabled || true,
        therapistEmail: profile?.therapist_email || undefined
      }
    };
    
    // Update profile in Supabase
    const profileSaved = await createOrUpdateProfile(user);
    if (!profileSaved) {
      console.warn('Failed to update profile in Supabase after OAuth, but continuing with local auth');
    }
    
    // Save to local storage
    saveAuthToLocalStorage({
      isAuthenticated: true,
      user,
      isLoading: false,
    });
    
    toast.success('Logged in successfully with Google!');
    return user;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return null;
  }
};

// Check and refresh Supabase session
export const checkAndRefreshSession = async (): Promise<boolean> => {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      return false;
    }
    
    if (!session) {
      console.log('No active session found');
      // Try to refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('Failed to refresh session:', refreshError);
        return false;
      }
      
      console.log('Session refreshed successfully');
      return true;
    }
    
    console.log('Active session found:', session.user.id);
    return true;
  } catch (error) {
    console.error('Error in checkAndRefreshSession:', error);
    return false;
  }
};

// Simulate login for development - will be replaced with real auth in production
export const simulateAuth = (enabled = true) => {
  if (enabled) {
    window.registerUser = async (email: string, password: string, name: string): Promise<User | null> => {
      console.log('Registering user', { email, name });
      
      try {
        // First, create an actual Supabase auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name
            }
          }
        });

        if (authError) {
          console.error('Error registering with Supabase:', authError);
          toast.error('Registration failed: ' + authError.message);
          return null;
        }

        if (!authData.user) {
          console.error('No user returned from Supabase signup');
          toast.error('Registration failed');
          return null;
        }
        
        // Create user object from auth data
        const newUser: User = {
          id: authData.user.id,
          email,
          name,
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
          preferences: {
            theme: 'light',
            notificationsEnabled: true,
          }
        };
        
        // Save profile to Supabase
        const profileSaved = await createOrUpdateProfile(newUser);
        if (!profileSaved) {
          console.warn('Failed to save profile to Supabase, but continuing with local auth');
        }
        
        // Save to local storage
        saveAuthToLocalStorage({
          isAuthenticated: true,
          user: newUser,
          isLoading: false,
        });
        
        toast.success('Account created successfully!');
        return newUser;
      } catch (error) {
        console.error('Error during registration:', error);
        toast.error('Registration failed');
        return null;
      }
    };
    
    window.loginUser = async (email: string, password: string): Promise<User | null> => {
      console.log('Logging in user', { email });
      
      try {
        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authError) {
          console.error('Error logging in with Supabase:', authError);
          toast.error('Login failed: ' + authError.message);
          return null;
        }

        if (!authData.user) {
          console.error('No user returned from Supabase login');
          toast.error('Login failed');
          return null;
        }
        
        console.log('Successful login with Supabase. User ID:', authData.user.id);
        
        // Get user profile if it exists - using the array query method instead of single()
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id);
          
        if (profileError) {
          console.log('Error fetching profile:', profileError);
        }
        
        // Get the first profile or null
        const profile = profileData && profileData.length > 0 ? profileData[0] : null;
        console.log('Profile found:', profile ? 'Yes' : 'No');
        
        // Create user object
        const user: User = {
          id: authData.user.id,
          email: authData.user.email || email,
          name: profile?.name || authData.user.user_metadata?.name || email.split('@')[0],
          createdAt: profile?.created_at ? new Date(profile.created_at).getTime() : Date.now(),
          lastLoginAt: Date.now(),
          preferences: {
            theme: profile?.theme || 'light',
            notificationsEnabled: profile?.notifications_enabled || true,
            therapistEmail: profile?.therapist_email || undefined
          }
        };
        
        // Update lastLoginAt
        const profileSaved = await createOrUpdateProfile(user);
        if (!profileSaved) {
          console.warn('Failed to update profile in Supabase, but continuing with local auth');
        }
        
        // Save to local storage
        saveAuthToLocalStorage({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
        
        toast.success('Logged in successfully!');
        return user;
      } catch (error) {
        console.error('Error during login:', error);
        toast.error('Login failed');
        return null;
      }
    };
    
    window.logoutUser = async (): Promise<boolean> => {
      console.log('Logging out user');
      
      try {
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Error signing out from Supabase:', error);
        }
        
        // Clear from local storage
        saveAuthToLocalStorage({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        
        toast.success('Logged out successfully!');
        return true;
      } catch (error) {
        console.error('Error during logout:', error);
        return false;
      }
    };
    
    window.updateUserPreferences = async (userId: string, preferences: User['preferences']): Promise<boolean> => {
      console.log('Updating user preferences', { userId, preferences });
      
      // Get current auth state
      const authState = getAuthFromLocalStorage();
      
      if (authState.user && authState.user.id === userId) {
        // Update preferences
        const updatedUser = {
          ...authState.user,
          preferences,
        };
        
        // Save profile to Supabase
        const profileSaved = await createOrUpdateProfile(updatedUser);
        if (!profileSaved) {
          console.warn('Failed to save profile to Supabase, but continuing with local preference update');
        }
        
        // Save to local storage
        saveAuthToLocalStorage({
          ...authState,
          user: updatedUser,
        });
        
        toast.success('Preferences updated successfully!');
        return true;
      }
      
      toast.error('Failed to update preferences');
      return false;
    };
  }
};

// Make auth functions available on the window object
declare global {
  interface Window {
    registerUser: (email: string, password: string, name: string) => Promise<User | null>;
    loginUser: (email: string, password: string) => Promise<User | null>;
    logoutUser: () => Promise<boolean>;
    updateUserPreferences: (userId: string, preferences: User['preferences']) => Promise<boolean>;
  }
}

// Initialize simulation
simulateAuth(true);
