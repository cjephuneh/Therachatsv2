import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { HelmetProvider } from 'react-helmet-async';
import ProtectedRoute from "@/components/ProtectedRoute";
import WhatsAppCommunityButton from "@/components/WhatsAppCommunityButton";
import SEO from "@/components/SEO";
import { useEffect } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import VoiceChat from "./pages/VoiceChat";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import AuthCallback from '@/pages/AuthCallback';

const queryClient = new QueryClient();
const WHATSAPP_BUTTON_STORAGE_KEY = 'whatsapp_community_button_hidden';

const App = () => {
  // Clear the "hidden" state on page load
  useEffect(() => {
    // Remove the localStorage item immediately
    localStorage.removeItem(WHATSAPP_BUTTON_STORAGE_KEY);
    
    // For more reliable cleanup, also reset after full page load
    window.addEventListener('load', () => {
      localStorage.removeItem(WHATSAPP_BUTTON_STORAGE_KEY);
    });

    return () => {
      window.removeEventListener('load', () => {
        localStorage.removeItem(WHATSAPP_BUTTON_STORAGE_KEY);
      });
    };
  }, []);

  return (
    <HelmetProvider>
      <SEO />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/voice" element={<ProtectedRoute><VoiceChat /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            
            <Toaster />
            <Sonner position="top-right" />

            {/* Add WhatsApp Community Button to appear on all pages */}
            <WhatsAppCommunityButton />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
