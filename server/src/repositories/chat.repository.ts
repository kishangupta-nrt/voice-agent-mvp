import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
  }

  return supabase;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  duration_ms: number | null;
  created_at: string;
}

export class ChatRepository {
  async createConversation(userId: string): Promise<string | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('conversations')
        .insert({ user_id: userId })
        .select('id')
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }

  async saveMessage(
    conversationId: string | null,
    role: 'user' | 'assistant',
    content: string,
    userId: string,
    durationMs?: number
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client || !conversationId) return;

    try {
      const { error } = await client.from('messages').insert({
        conversation_id: conversationId,
        role,
        content,
        user_id: userId,
        duration_ms: durationMs,
      });

      if (error) {
        console.error('Supabase error:', error);
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  async getConversationHistory(conversationId: string, limit = 5): Promise<Message[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Supabase error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return [];
    }
  }

  async getRecentConversations(userId: string, limit = 10): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('conversations')
        .select(`
          id,
          created_at,
          messages (content, role, created_at)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client.from('conversations').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
