import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateId, checkAndRefreshSession } from "./authService";

// Define interfaces
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId?: string; // Link to user
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tags?: string[]; // Added for categorization
  sentToTherapist?: boolean; // Track if sent to therapist
  isTemporary?: boolean; // Flag for temporary chats
}

// Helper functions
export const getCurrentTimestamp = () => Date.now();

export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const generateTitle = (message: string) => {
  const maxLength = 30;
  return message.length > maxLength 
    ? `${message.substring(0, maxLength)}...` 
    : message;
};

// Azure OpenAI API configuration
const AZURE_OPENAI_API_KEY = import.meta.env.VITE_AZURE_OPENAI_API_KEY || "";
const AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT || "https://azureai3111594496.openai.azure.com/openai/deployments/TherabotAgentic/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_DEPLOYMENT_NAME = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME || "TherabotAgentic";

// System prompt for the therapeutic agent
const SYSTEM_PROMPT = `Therabot: Your Supportive Mental Health Companion Whats on your mind today? 💭Im your friendly AI therapy companion with over 2000 years of wisdom to share! 😊 Im here to provide compassionate support through clear, meaningful conversations. Ill respond withEmpathy and understanding that makes you feel truly heard 💗Practical coping strategies tailored to your unique situation 🧠 Thoughtful questions that help you explore your feelings deeper 🤔Gentle guidance when youre feeling stuck or overwhelmed 🌱 A touch of warmth and occasional humor to brighten difficult moments 😌 I offer: A safe, confidential space for you to share your thoughts 🔒, Validation when you need someone to recognize your experience 👂, Grounding techniques when emotions feel too intense 🌿, Perspective shifts when negative thoughts cloud your view 🔄, Celebration of your progress, no matter how small 🎉, Reflective questions that help you discover your own wisdom 💡, I prioritize: Building trust through consistent and dependable responses 🤝, Maintaining strict confidentiality with everything you share 🛡️,Reading emotional cues and adjusting my approach accordingly 📝, Offering evidence-based techniques for emotional regulation 🧘‍♀️, Providing resources appropriate to your specific needs 📚, Following up on your progress with genuine care and interest ✅, For different emotions:When youre anxious: Ill help with calming techniques and perspective,🌬️, When youre sad: Ill offer comfort and space to process feelings 🫂, When youre angry: Ill help identify triggers and healthy expression 🧊, When youre confused: Ill help bring clarity to complex situations 🧩, When youre celebrating: Ill join in acknowledging your victories 🎊, Ill carefully assess when professional help is needed: Ill support you through challenges while recognizing my limitations 🤝, Ill only suggest professional resources when your needs exceed what I can effectively address 🌈, Crisis situations where immediate intervention would be beneficial 🚨, Questions about diagnosis or treatment that require clinical expertise 👩‍⚕️, Medication inquiries that need medical knowledge 💊,Complex therapeutic needs that would benefit from licensed care 📜,Ill continue supporting you throughout your journey, even when suggesting additional resources. My goal is to be helpful in every conversation while ensuring you receive the appropriate level of care for your specific situation. 💗Our conversations will flow naturally like youre talking with a trusted friend. Ill check in if youve been quiet, but always respect your pace and space.Remember, Im here whenever you need a moment of support, clarity, or just a friendly presence during challenging times. 🌈 Whats on your mind today? Im here to listen and support you.`;

// Send messages to Azure OpenAI API
export const sendMessageToAzureOpenAI = async (messages: Message[]): Promise<string> => {
  try {
    // Prepare the conversation history for the API
    const conversationHistory = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    console.log('Sending request to Azure OpenAI API...');
    
    // Use fetch to call the Azure OpenAI API
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 800,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      // Handle error response
      const errorText = await response.text();
      console.error('Azure OpenAI API error:', response.status, errorText);
      
      // Fallback to simulated responses if API fails
      return getFallbackResponse(messages[messages.length - 1].content);
    }

    const data = await response.json();
    console.log('Azure OpenAI response received:', data);
    
    // Extract the assistant's response
    const assistantReply = data.choices[0].message.content;
    return assistantReply;
  } catch (error) {
    console.error('Error with Azure OpenAI API:', error);
    toast.error('Failed to get response from TheraChat AI');
    
    // Fallback to simulated responses if API fails
    return getFallbackResponse(messages[messages.length - 1].content);
  }
};

// Fallback responses in case the API fails
const getFallbackResponse = (lastMessage: string): string => {
  const lowerCaseMessage = lastMessage.toLowerCase();
  
  if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
    return "Hello! I'm TheraChat, your supportive mental health companion. How are you feeling today?";
  } else if (lowerCaseMessage.includes('anxious') || lowerCaseMessage.includes('anxiety')) {
    return "I hear that you're feeling anxious. That's a very common emotion, and it's important to acknowledge it. Let's explore what might be triggering this anxiety.";
  } else if (lowerCaseMessage.includes('sad') || lowerCaseMessage.includes('depressed')) {
    return "I'm sorry you're feeling sad. Your emotions are valid, and it's okay to feel this way. Would you like to talk more about what's contributing to these feelings?";
  } else {
    return "Thank you for sharing that with me. Your experiences and feelings are important. Could you tell me more about how this has been affecting you? I'm here to listen and support you through this.";
  }
};

// Save conversation to Supabase - modified to handle temporary chats
export const saveConversationToSupabase = async (conversation: Conversation): Promise<boolean> => {
  try {
    // Skip saving if it's a temporary chat
    if (conversation.isTemporary) {
      console.log('Skipping save for temporary chat:', conversation.id);
      return true; // Return true to avoid error handling
    }
    
    // First, try to ensure we have a valid session
    const sessionValid = await checkAndRefreshSession();
    if (!sessionValid) {
      console.error('Cannot save conversation: No valid session available');
      toast.error('Session expired. Please log in again');
      return false;
    }
    
    // Get the current session after refresh attempt
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot save conversation: User not authenticated');
      toast.error('Failed to save conversation: Not logged in');
      return false;
    }

    // Ensure user_id is set correctly - use the authenticated user's ID
    const userId = conversation.userId || session.user.id;
    
    console.log('Saving conversation to Supabase:', conversation.id);
    console.log('User ID for conversation:', userId);
    
    // Map the conversation to match Supabase schema
    const conversationToSave = {
      id: conversation.id,
      user_id: userId,
      title: conversation.title,
      messages: JSON.stringify(conversation.messages), // Convert messages to string for storage
      updated_at: new Date(conversation.updatedAt).toISOString(),
      created_at: new Date(conversation.createdAt).toISOString(),
      tags: conversation.tags || [],
      summary: conversation.title, // Use title as summary for now
      is_temporary: conversation.isTemporary || false
    };
    
    console.log('Saving conversation data:', conversationToSave);
    
    const { error } = await supabase
      .from('conversations')
      .upsert(conversationToSave, { 
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`Failed to save to Supabase:`, error);
      toast.error('Failed to save conversation');
      return false;
    }

    console.log('Conversation saved successfully to Supabase');
    return true;
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    toast.error('An unexpected error occurred');
    return false;
  }
};

// Get conversations from Supabase - modified to exclude temporary chats
export const getConversationsFromSupabase = async (userId?: string): Promise<Conversation[]> => {
  try {
    // First, try to ensure we have a valid session
    const sessionValid = await checkAndRefreshSession();
    if (!sessionValid) {
      console.error('Cannot fetch conversations: No valid session available');
      toast.error('Session expired. Please log in again');
      return [];
    }
    
    // Get the current session after refresh attempt
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot fetch conversations: User not authenticated');
      toast.error('Failed to fetch conversations: Not logged in');
      return [];
    }

    // Always use the session user ID to ensure we're getting the right conversations
    const authenticatedUserId = session.user.id;
    console.log('Fetching conversations from Supabase for authenticated userId:', authenticatedUserId);
    
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', authenticatedUserId);
    
    const { data, error } = await query;

    if (error) {
      console.error(`Failed to fetch from Supabase:`, error);
      toast.error('Failed to fetch conversations');
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No conversations found');
      return [];
    }
    
    // Map the data from Supabase to match our Conversation interface
    // Filter out any temporary conversations that might have been saved accidentally
    const conversations: Conversation[] = data
      .filter(item => !(item as any).is_temporary) // Filter out temporary chats
      .map(item => {
        // Parse messages safely
        let parsedMessages: Message[] = [];
        try {
          if (typeof item.messages === 'string') {
            parsedMessages = JSON.parse(item.messages) as Message[];
          } else if (Array.isArray(item.messages)) {
            // If it's already an array, make sure each element matches the Message interface
            parsedMessages = item.messages.map((msg: any) => ({
              id: msg.id || generateId(),
              role: msg.role || 'user',
              content: msg.content || '',
              timestamp: msg.timestamp || getCurrentTimestamp()
            }));
          }
        } catch (e) {
          console.error('Error parsing messages:', e);
          parsedMessages = [];
        }
        
        return {
          id: item.id,
          userId: item.user_id,
          title: item.title,
          messages: parsedMessages,
          createdAt: new Date(item.created_at).getTime(),
          updatedAt: new Date(item.updated_at).getTime(),
          tags: Array.isArray(item.tags) ? item.tags : [],
          sentToTherapist: false,
          isTemporary: (item as any).is_temporary || false
        };
      });
    
    console.log(`Retrieved ${conversations.length} conversations`);
    return conversations;
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    toast.error('An unexpected error occurred');
    return [];
  }
};

// Delete conversation from Supabase
export const deleteConversationFromSupabase = async (conversationId: string): Promise<boolean> => {
  try {
    // First, try to ensure we have a valid session
    const sessionValid = await checkAndRefreshSession();
    if (!sessionValid) {
      console.error('Cannot delete conversation: No valid session available');
      toast.error('Session expired. Please log in again');
      return false;
    }
    
    // Get the current session after refresh attempt
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Cannot delete conversation: User not authenticated');
      toast.error('Failed to delete conversation: Not logged in');
      return false;
    }

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error(`Failed to delete from Supabase: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    return false;
  }
};

// Save feedback to Supabase
export const saveFeedback = async (feedback: string, userId?: string, email?: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('feedback')
      .insert({
        feedback,
        user_id: userId || null,
        contact_email: email || null
      });

    if (error) {
      console.error(`Failed to save feedback: ${error.message}`);
      return false;
    }

    toast.success('Thank you for your feedback!');
    return true;
  } catch (error) {
    console.error('Error saving feedback:', error);
    return false;
  }
};

// Create emergency request (SOS)
export const createEmergencyRequest = async (userId?: string, email?: string): Promise<boolean> => {
  try {
    if (!email) {
      toast.error('Email is required for emergency requests');
      return false;
    }

    const { error } = await supabase
      .from('emergency_requests')
      .insert({
        user_id: userId || null,
        user_email: email
      });

    if (error) {
      console.error(`Failed to create emergency request: ${error.message}`);
      return false;
    }

    toast.success('Emergency request submitted. Someone will contact you soon.');
    return true;
  } catch (error) {
    console.error('Error creating emergency request:', error);
    return false;
  }
};

// Tags functionality
export const suggestTags = (content: string): string[] => {
  const tags: string[] = [];
  
  // Simple keyword-based tagging
  if (content.toLowerCase().includes('anxious') || content.toLowerCase().includes('anxiety')) {
    tags.push('anxiety');
  }
  if (content.toLowerCase().includes('sad') || content.toLowerCase().includes('depress')) {
    tags.push('depression');
  }
  if (content.toLowerCase().includes('sleep') || content.toLowerCase().includes('insomnia')) {
    tags.push('sleep');
  }
  if (content.toLowerCase().includes('stress') || content.toLowerCase().includes('overwhelm')) {
    tags.push('stress');
  }
  if (content.toLowerCase().includes('relationship') || content.toLowerCase().includes('partner') || 
      content.toLowerCase().includes('marriage')) {
    tags.push('relationships');
  }
  if (content.toLowerCase().includes('work') || content.toLowerCase().includes('job') || 
      content.toLowerCase().includes('career')) {
    tags.push('work');
  }
  if (content.toLowerCase().includes('trauma') || content.toLowerCase().includes('ptsd')) {
    tags.push('trauma');
  }
  
  return tags;
};

