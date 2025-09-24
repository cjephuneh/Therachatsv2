import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbAuzvEG8l57RyYSXO2d';
const STORAGE_KEY = 'whatsapp_community_button_hidden';

const WhatsAppCommunityButton: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [isHidden, setIsHidden] = useState(true); // Start hidden to prevent flash

  // Load hidden state from localStorage on mount
  useEffect(() => {
    const hiddenState = localStorage.getItem(STORAGE_KEY);
    setIsHidden(hiddenState === 'true');
  }, []);

  // Toggle showing the popup
  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  // Handle dismissing the button
  const handleDismiss = () => {
    setIsHidden(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  // Handle joining the community
  const handleJoin = () => {
    window.open(WHATSAPP_CHANNEL_URL, '_blank');
    setShowPopup(false);
  };

  // If hidden, don't render anything
  if (isHidden) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-28 right-6 z-50">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute -top-2 -right-2 bg-gray-200 rounded-full p-1 shadow-sm"
        title="Dismiss"
        aria-label="Dismiss community button"
      >
        <X size={14} />
      </button>
      
      {/* Main Button - Now with label */}
      <Button
        onClick={togglePopup}
        className="group flex items-center gap-2 rounded-full bg-green-500 hover:bg-green-600 shadow-lg text-white pl-4 pr-5 py-2 h-auto"
        aria-label="Join our WhatsApp community"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium text-sm">Join Community</span>
      </Button>

      {/* Popup */}
      {showPopup && (
        <div className="absolute bottom-16 right-0 bg-background border rounded-lg shadow-xl p-4 w-80 animate-in fade-in slide-in-from-right-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-lg">Join Our Community Anonymously</h3>
            <button 
              onClick={() => setShowPopup(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              {/* <X size={18} /> */}
            </button>
          </div>
          
          <p className="text-gray-600 text-sm mb-4">
            Connect with fellow TheraChat users, get support, and share experiences in our WhatsApp channel.
          </p>
          
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPopup(false)}
              className="flex-1"
            >
              Later
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600"
              onClick={handleJoin}
            >
              Join Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppCommunityButton;
