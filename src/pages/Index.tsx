import { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import { ChatSidebar } from '@/components/ChatSidebar';
import { Button } from '@/components/ui/button';
import { PanelRight, AlertTriangle, Settings as SettingsIcon, Clock, Archive, Headphones } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { 
  Conversation, 
  Message,  
  getCurrentTimestamp, 
  generateTitle,
  suggestTags,
  sendMessageToAzureOpenAI as callOpenAI,
  saveConversationToSupabase as saveConversation,
  getConversationsFromSupabase as getConversations, 
  deleteConversationFromSupabase as deleteConversation
} from '@/services/azureService';
import { generateId } from '@/services/authService';
import SEO from '@/components/SEO';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const Index = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching conversations for user:', user?.id);
        
        const fetchedConversations = await getConversations(user?.id);
        console.log('Fetched conversations:', fetchedConversations);
        
        setConversations(fetchedConversations);
        
        if (fetchedConversations.length > 0) {
          const mostRecent = [...fetchedConversations].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          setCurrentConversation(mostRecent);
        }
        
        setIsDataLoaded(true);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load conversations');
        setIsDataLoaded(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchConversations();
    } else {
      setIsDataLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewConversation = (temporary = false) => {
    const newConversation: Conversation = {
      id: generateId(),
      userId: user?.id,
      title: temporary ? 'Temporary Chat' : 'New conversation',
      messages: [],
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      isTemporary: temporary,
    };
    
    setConversations([newConversation, ...conversations]);
    setCurrentConversation(newConversation);
    setIsTemporaryChat(temporary);
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setIsTemporaryChat(conversation.isTemporary || false);
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    let conversation = currentConversation;
    
    if (!conversation) {
      conversation = {
        id: generateId(),
        userId: user?.id,
        title: isTemporaryChat ? 'Temporary Chat' : generateTitle(content),
        messages: [],
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        tags: suggestTags(content),
        isTemporary: isTemporaryChat,
      };
      setConversations([conversation, ...conversations]);
    }
    
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: getCurrentTimestamp(),
    };
    
    const updatedMessages = [...(conversation.messages || []), userMessage];
    const updatedConversation = {
      ...conversation,
      messages: updatedMessages,
      title: conversation.messages.length === 0 && !isTemporaryChat ? generateTitle(content) : conversation.title,
      updatedAt: getCurrentTimestamp(),
      tags: conversation.messages.length === 0 ? suggestTags(content) : conversation.tags,
      isTemporary: isTemporaryChat,
    };
    
    setCurrentConversation(updatedConversation);
    setConversations(prevConversations => 
      prevConversations.map(c => c.id === updatedConversation.id ? updatedConversation : c)
    );
    
    setIsLoading(true);
    try {
      const aiResponse = await callOpenAI(updatedMessages);
      
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: aiResponse,
        timestamp: getCurrentTimestamp(),
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      const finalConversation = {
        ...updatedConversation,
        messages: finalMessages,
        updatedAt: getCurrentTimestamp(),
      };
      
      setCurrentConversation(finalConversation);
      setConversations(prevConversations => 
        prevConversations.map(c => c.id === finalConversation.id ? finalConversation : c)
      );
      
      if (!isTemporaryChat) {
        try {
          const saved = await saveConversation(finalConversation);
          if (!saved) {
            console.log('Failed to save conversation to Supabase');
          }
        } catch (error) {
          console.error('Error saving conversation to Supabase:', error);
        }
      }
    } catch (error) {
      console.error('Error in message flow:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!currentConversation) return;
    
    const updatedMessages = currentConversation.messages.filter(msg => msg.id !== messageId);
    
    if (updatedMessages.length === 0) {
      handleDeleteConversation(currentConversation.id);
      return;
    }
    
    const updatedConversation = {
      ...currentConversation,
      messages: updatedMessages,
      updatedAt: getCurrentTimestamp(),
    };
    
    setCurrentConversation(updatedConversation);
    setConversations(prevConversations => 
      prevConversations.map(c => c.id === updatedConversation.id ? updatedConversation : c)
    );
    
    saveConversation(updatedConversation)
      .then(success => {
        if (success) {
          toast.success('Message deleted');
        }
      })
      .catch(error => {
        console.error('Error saving conversation after deletion:', error);
      });
  };

  const handleDeleteConversation = async (conversationId: string) => {
    setConversations(prevConversations => 
      prevConversations.filter(c => c.id !== conversationId)
    );
    
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null);
    }
    
    try {
      const success = await deleteConversation(conversationId);
      if (success) {
        toast.success('Conversation deleted');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const handleSendToTherapist = (messageId: string) => {
    if (!currentConversation) return;
    
    const therapistEmail = user?.preferences?.therapistEmail;
    
    if (!therapistEmail) {
      toast.error('Please add your therapist\'s email in settings first');
      return;
    }
    
    const updatedConversation = {
      ...currentConversation,
      sentToTherapist: true,
      updatedAt: getCurrentTimestamp(),
    };
    
    setCurrentConversation(updatedConversation);
    setConversations(prevConversations => 
      prevConversations.map(c => c.id === updatedConversation.id ? updatedConversation : c)
    );
    
    saveConversation(updatedConversation)
      .then(success => {
        if (success) {
          toast.success(`Message sent to ${therapistEmail}`);
        }
      })
      .catch(error => {
        console.error('Error saving conversation after sending to therapist:', error);
        toast.error('Failed to save conversation after sending to therapist');
      });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleTemporaryChat = () => {
    if (currentConversation && currentConversation.messages.length > 0) {
      toast.info(
        isTemporaryChat 
          ? "Creating a new saved conversation" 
          : "Creating a new temporary conversation"
      );
      handleNewConversation(!isTemporaryChat);
    } else if (currentConversation) {
      const updatedConversation = {
        ...currentConversation,
        isTemporary: !isTemporaryChat,
        title: !isTemporaryChat ? 'Temporary Chat' : 'New conversation'
      };
      
      setCurrentConversation(updatedConversation);
      setConversations(prevConversations => 
        prevConversations.map(c => c.id === updatedConversation.id ? updatedConversation : c)
      );
      setIsTemporaryChat(!isTemporaryChat);
    } else {
      handleNewConversation(!isTemporaryChat);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">Loading your conversations...</h2>
          <p className="text-muted-foreground">Please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="AI-Powered Mental Health Chat" 
        description="Chat with our AI therapist assistant for support, guidance, and emotional wellness tools. Private, secure, and available 24/7."
      />
      <div className="flex h-screen bg-gray-50">
        <ChatSidebar
          conversations={conversations.filter(c => !c.isTemporary)}
          currentConversationId={currentConversation?.id || null}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => handleNewConversation(false)}
          onNewTemporaryChat={() => handleNewConversation(true)}
          isOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
        
        <main className={`flex-1 flex flex-col h-full ${!isMobile ? 'ml-72' : ''}`}>
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-therabot-dark dark:text-therabot-primary">
                {currentConversation?.title || 'TheraChat'}
              </h1>
              
              {isTemporaryChat && currentConversation && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="ml-2 flex items-center text-amber-500 dark:text-amber-400">
                        <Clock size={16} className="mr-1" />
                        <span className="text-xs font-medium">Temporary</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This chat won't be saved permanently</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-muted px-2 py-1 rounded-full">
                <Label htmlFor="temporary-mode" className="text-xs flex items-center text-foreground">
                  {isTemporaryChat 
                    ? <Clock size={14} className="mr-1 text-amber-500 dark:text-amber-400" />
                    : <Archive size={14} className="mr-1 text-green-600 dark:text-green-400" />
                  }
                  {isTemporaryChat ? 'Temporary' : 'Saved'}
                </Label>
                <Switch 
                  id="temporary-mode" 
                  checked={isTemporaryChat} 
                  onCheckedChange={toggleTemporaryChat} 
                  className="data-[state=checked]:bg-amber-500" 
                />
              </div>
              
              {!isMobile && (
                <div className="text-sm text-gray-500 dark:text-muted-foreground">
                  {user && `Welcome, ${user.name || user.email}`}
                </div>
              )}
              
              <Link to="/voice">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-600 dark:text-gray-400"
                  title="Voice Chat"
                >
                  <Headphones className="h-5 w-5" />
                </Button>
              </Link>
              
              <Link to="/settings">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-600 dark:text-gray-400"
                >
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              </Link>
              
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleSidebar}
                >
                  <PanelRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          </header>
          
          <div className="flex-1 overflow-hidden flex flex-col bg-background">
            {currentConversation ? (
              <>
                {isTemporaryChat && currentConversation.messages.length === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 border-b border-amber-100 dark:border-amber-800 flex items-center">
                    <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400 mr-2" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This is a temporary chat. Messages won't be stored in your conversation history.
                    </p>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-4 relative chat-gradient">
                  <div className="space-y-4 py-12">
                    {currentConversation.messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <p className="text-center mb-2 text-lg font-medium">
                          Hello {user?.name || 'there'}, what's on your mind today?
                        </p>
                        <p className="text-sm text-center max-w-md">
                          Your supportive mental health companion is here to listen and help
                        </p>
                      </div>
                    ) : (
                      currentConversation.messages.map((message) => (
                        <ChatMessage
                          key={message.id}
                          message={message}
                          onDelete={handleDeleteMessage}
                          onSendToTherapist={handleSendToTherapist}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                
                <ChatInput 
                  onSendMessage={handleSendMessage} 
                  isLoading={isLoading}
                  isTemporary={isTemporaryChat}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="max-w-md text-center space-y-4">
                  <h2 className="text-2xl font-bold text-therabot-primary">
                    Welcome to TheraChat, {user?.name || 'there'}!
                  </h2>
                  
                  <p className="text-muted-foreground">
                    Your supportive mental health companion is here to listen and help whenever you need someone to talk to.
                  </p>
                  
                  <div className="flex flex-col gap-4 mt-6">
                    <Button 
                      className="bg-therabot-primary hover:bg-therabot-secondary"
                      onClick={() => handleNewConversation(false)}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Start a saved conversation
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="border-amber-500 text-amber-700 hover:bg-amber-50"
                      onClick={() => handleNewConversation(true)}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start a temporary chat
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-therabot-softPurple rounded-lg mt-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-left">
                        <strong>Important:</strong> TheraChat is an AI companion and not a replacement for professional mental health services. 
                        If you're experiencing a crisis, please contact a healthcare provider or emergency services.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Index;
