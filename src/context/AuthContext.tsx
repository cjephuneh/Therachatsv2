
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState, getAuthFromLocalStorage, saveAuthToLocalStorage } from '@/services/authService';
import { toast } from 'sonner';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updatePreferences: (preferences: User['preferences']) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true // Start with loading true
  });

  // Check for saved auth on mount
  useEffect(() => {
    const loadSavedAuth = async () => {
      try {
        const savedAuth = getAuthFromLocalStorage();
        
        // If we have a saved user, consider them authenticated
        if (savedAuth.user) {
          setAuthState({
            isAuthenticated: true,
            user: savedAuth.user,
            isLoading: false
          });
        } else {
          // No saved user, not authenticated but done loading
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        // Ensure we're not stuck in loading state if there's an error
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false
        });
      }
    };

    loadSavedAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const user = await window.loginUser(email, password);
      
      if (user) {
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
        return true;
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please check your credentials and try again.');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const user = await window.registerUser(email, password, name);
      
      if (user) {
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
        });
        return true;
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed. Please try again.');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const logout = async (): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const success = await window.logoutUser();
      
      if (success) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
        return true;
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed. Please try again.');
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  };

  const updatePreferences = async (preferences: User['preferences']): Promise<boolean> => {
    try {
      if (!authState.user) {
        toast.error('You must be logged in to update preferences');
        return false;
      }
      
      const success = await window.updateUserPreferences(authState.user.id, preferences);
      
      if (success && authState.user) {
        setAuthState({
          ...authState,
          user: {
            ...authState.user,
            preferences,
          },
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Update preferences error:', error);
      toast.error('Failed to update preferences. Please try again.');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      register,
      logout,
      updatePreferences,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};