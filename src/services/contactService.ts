import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  user_id?: string;
}

/**
 * Submit a contact message to the database
 */
export async function submitContactMessage(message: ContactMessage): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        id: crypto.randomUUID(), // Generate a UUID for the message
        name: message.name,
        email: message.email,
        subject: message.subject,
        message: message.message,
        user_id: message.user_id || null,
        status: 'new',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error submitting contact message:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to submit contact message:', error);
    throw error;
  }
}

/**
 * Get all contact messages for a user
 */
export async function getUserContactMessages(userId: string) {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contact messages:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch contact messages:', error);
    throw error;
  }
}
