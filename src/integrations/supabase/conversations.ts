import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Function to store a new conversation
export async function createConversation(
  userId: string,
  title: string,
  messages: any,
  tags?: string[],
  summary?: string,
  isTemporary?: boolean
) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        id: crypto.randomUUID(), // Generate a UUID for the conversation
        user_id: userId,
        title,
        messages,
        tags,
        summary,
        is_temporary: isTemporary ?? false,
      })
      .select()

    if (error) {
      console.error('Error creating conversation:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to create conversation:', error)
    throw error
  }
}

// Function to get conversations for a user
export async function getUserConversations(userId: string) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    throw error
  }
}

// Function to update an existing conversation
export async function updateConversation(
  conversationId: string,
  updates: Partial<Database['public']['Tables']['conversations']['Update']>
) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()

    if (error) {
      console.error('Error updating conversation:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to update conversation:', error)
    throw error
  }
}
