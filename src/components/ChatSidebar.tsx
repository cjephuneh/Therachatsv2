import { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Menu, 
  X, 
  MessageSquare, 
  Send, 
  AlertTriangle,
  Settings as SettingsIcon,
  Heart, 
  HeartHandshake, 
  Plus,
  Clock,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Conversation, formatDate, saveFeedback, createEmergencyRequest } from '@/services/azureService';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import DonationModal from './DonationModal';

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onNewTemporaryChat: () => void; // Added for temporary chat
  isOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onNewTemporaryChat,
  isOpen,
  onToggleSidebar,
}: ChatSidebarProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortedConversations, setSortedConversations] = useState<Conversation[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sosEmail, setSosEmail] = useState('');
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  useEffect(() => {
    // Sort conversations by updatedAt (most recent first)
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    setSortedConversations(sorted);
  }, [conversations]);

  const handleSubmitFeedback = async () => {
    if (!feedback) {
      toast.error('Please enter your feedback');
      return;
    }
    const success = await saveFeedback(feedback, user?.id, contactEmail || user?.email);
    if (success) {
      setFeedback('');
      setContactEmail('');
      setFeedbackOpen(false);
    }
  };

  const handleSOS = async () => {
    const email = sosEmail || user?.email;
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    const success = await createEmergencyRequest(user?.id, email);
    if (success) {
      setSosEmail('');
      setSosOpen(false);
    }
  };

  const handleSupportUs = () => {
    setIsDonateModalOpen(true);
  };

  return (
    <>
      {/* Mobile sidebar toggle button */}
      {isMobile && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed top-4 left-4 z-50" 
          onClick={onToggleSidebar}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      )}
      
      {/* Sidebar backdrop (mobile only) */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onToggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40
        h-full w-72 bg-sidebar border-r border-sidebar-border
        transition-all duration-300 ease-in-out
        ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : ''}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <h2 className="text-lg font-semibold text-sidebar-foreground">TheraChat</h2>
            <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* New chat buttons */}
          <div className="p-3 space-y-2">
            <Button 
              className="w-full gap-2 bg-sidebar-primary hover:bg-therabot-secondary"
              onClick={onNewConversation}
            >
              <PlusCircle className="h-4 w-4" />
              New Conversation
            </Button>
            
            <Button 
              variant="outline"
              className="w-full gap-2 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-400/30 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={onNewTemporaryChat}
            >
              <Clock className="h-4 w-4" />
              New Temporary Chat
            </Button>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1 px-3 py-2">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
              Recent Conversations
            </h3>
            <div className="space-y-2">
              {sortedConversations.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground p-3">
                  No conversations yet
                </p>
              ) : (
                sortedConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`
                      p-3 rounded-md cursor-pointer
                      hover:bg-sidebar-accent/50 transition-colors duration-200
                      ${conversation.id === currentConversationId ? 'bg-sidebar-accent' : ''}
                    `}
                    onClick={() => onSelectConversation(conversation)}
                  >
                    <h3 className="font-medium text-sidebar-foreground truncate">{conversation.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(conversation.updatedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Main navigation - Now moved below the conversations list */}
          <div className="px-3 py-2 border-t border-sidebar-border">
            <div className="flex flex-col space-y-1">
              <Link to="/voice">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Headphones className="h-4 w-4" />
                  Voice Chat
                </Button>
              </Link>
              <Link to="/settings">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-2"
                onClick={() => setFeedbackOpen(true)}
              >
                <Send className="h-4 w-4" />
                Feedback
              </Button>
              <Link to="/contact">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
          
          {/* SOS Button */}
          <div className="p-3 border-t border-sidebar-border">
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={() => setSosOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              SOS Emergency
            </Button>
          </div>
          
          {/* Support Us Button */}
          <div className="p-3 border-t border-sidebar-border">
            <Button 
              className="w-full py-2 px-4 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors flex items-center justify-center"
              onClick={handleSupportUs}
            >
              <HeartHandshake size={18} className="mr-1" />
              Support Us
            </Button>
          </div>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-sidebar-border">
            <p className="text-xs text-muted-foreground text-center">
              &copy; {new Date().getFullYear()} TheraChats
            </p>
          </div>
        </div>
      </aside>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Share your thoughts or suggestions to help us improve TheraChat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Your feedback..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
            />
            {!user && (
              <Input
                placeholder="Your email (optional)"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitFeedback}>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SOS Dialog */}
      <Dialog open={sosOpen} onOpenChange={setSosOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Emergency Assistance
            </DialogTitle>
            <DialogDescription>
              This will send an emergency request to our team. If you're in immediate danger, please call 988 or 911 directly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!user && (
              <Input
                placeholder="Your email (required)"
                type="email"
                value={sosEmail}
                onChange={(e) => setSosEmail(e.target.value)}
              />
            )}
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">
                <strong>IMPORTANT:</strong> For immediate emergencies, please contact:
              </p>
              <ul className="text-sm text-red-700 list-disc pl-5 mt-2 space-y-1">
                <li>988 Suicide & Crisis Lifeline: 988</li>
                <li>Crisis Text Line: Text HOME to 741741</li>
                <li>Emergency Services: 911</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSosOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSOS}>Request Help</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IntaSend Donation Modal */}
      {isDonateModalOpen && (
        <DonationModal onClose={() => setIsDonateModalOpen(false)} />
      )}
    </>
  );
}
