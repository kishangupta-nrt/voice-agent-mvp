import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import type { Message } from './chat.repository';

let supabase: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_KEY) return null;
  if (!supabase) {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
  }
  return supabase;
}

export interface ConversationRecord {
  id: string;
  user_id: string | null;
  created_at: string;
  message_count: number;
  first_message: string | null;
  last_message: string | null;
  last_user_message: string | null;
  last_assistant_message: string | null;
  style: string | null;
  language: string | null;
}

export interface AdminStats {
  totalConversations: number;
  totalMessages: number;
  totalUsers: number;
  conversationsByDay: Array<{ date: string; count: number }>;
  languages: Array<{ language: string; count: number }>;
  styles: Array<{ style: string; count: number }>;
  avgMessagesPerConversation: number;
  avgResponseTimeMs: number | null;
}

export interface ConversationDetail {
  id: string;
  user_id: string | null;
  created_at: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    duration_ms: number | null;
    created_at: string;
  }>;
}

export interface LeadSummary {
  stage: string;
  count: number;
  projectType: string | null;
  hasContact: boolean;
}

class AdminRepository {
  async getStats(days = 30, userId?: string): Promise<AdminStats | null> {
    const client = getAdminClient();
    if (!client) {
      console.error('AdminRepo.getStats: Supabase client not available');
      return null;
    }

    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      let convQuery = client
        .from('conversations')
        .select('id, user_id, created_at')
        .gte('created_at', since.toISOString());

      if (userId) {
        convQuery = convQuery.eq('user_id', userId);
        console.log(`AdminRepo.getStats: filtering by userId=${userId}`);
      }

      const { data: convData, error: convError } = await convQuery;

      if (convError) {
        console.error('AdminRepo.getStats: conversation query error:', convError);
        return null;
      }

      console.log(`AdminRepo.getStats: found ${convData?.length || 0} conversations`);

      const { data: msgData } = await client
        .from('messages')
        .select('conversation_id, role, content, duration_ms, created_at')
        .in('conversation_id', (convData || []).map(c => c.id));

      const totalConversations = convData?.length || 0;
      const totalMessages = msgData?.length || 0;
      const uniqueUsers = userId ? 1 : new Set(convData?.map(c => c.user_id).filter(Boolean)).size;

      const convByDay = new Map<string, number>();
      for (const c of convData || []) {
        const date = new Date(c.created_at).toISOString().split('T')[0];
        convByDay.set(date, (convByDay.get(date) || 0) + 1);
      }

      const conversationsByDay = Array.from(convByDay.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const langMap = new Map<string, number>();
      const styleMap = new Map<string, number>();

      for (const m of msgData || []) {
        if (m.role === 'user') {
          const lang = this.detectLanguage(m.content);
          langMap.set(lang, (langMap.get(lang) || 0) + 1);
          const style = this.detectStyle(m.content);
          styleMap.set(style, (styleMap.get(style) || 0) + 1);
        }
      }

      const languages = Array.from(langMap.entries())
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count);

      const styles = Array.from(styleMap.entries())
        .map(([style, count]) => ({ style, count }))
        .sort((a, b) => b.count - a.count);

      const avgMessages = totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 10) / 10 : 0;

      const durations = msgData?.filter(m => m.duration_ms !== null).map(m => m.duration_ms) || [];
      const avgResponseTime = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      return {
        totalConversations,
        totalMessages,
        totalUsers: uniqueUsers,
        conversationsByDay,
        languages,
        styles,
        avgMessagesPerConversation: avgMessages,
        avgResponseTimeMs: avgResponseTime,
      };
    } catch (err) {
      console.error('AdminRepo.getStats: unexpected error:', err);
      return null;
    }
  }

  async getAllConversations(limit = 100, offset = 0, userId?: string): Promise<ConversationRecord[]> {
    const client = getAdminClient();
    if (!client) return [];

    try {
      let convQuery = client
        .from('conversations')
        .select('id, user_id, created_at')
        .order('created_at', { ascending: false });

      if (userId) {
        convQuery = convQuery.eq('user_id', userId);
      }

      const { data: convData } = await convQuery.range(offset, offset + limit - 1);

      if (!convData || convData.length === 0) return [];

      const convIds = convData.map(c => c.id);

      const { data: msgData } = await client
        .from('messages')
        .select('id, conversation_id, role, content, duration_ms, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: true });

      const msgByConv = new Map<string, Message[]>();
      for (const m of msgData || []) {
        if (!msgByConv.has(m.conversation_id)) msgByConv.set(m.conversation_id, []);
        msgByConv.get(m.conversation_id)!.push(m);
      }

      return convData.map(c => {
        const msgs = msgByConv.get(c.id) || [];
        return {
          id: c.id,
          user_id: c.user_id,
          created_at: c.created_at,
          message_count: msgs.length,
          first_message: msgs[0]?.content || null,
          last_message: msgs[msgs.length - 1]?.content || null,
          last_user_message: msgs.filter((m): m is Message => m.role === 'user').pop()?.content || null,
          last_assistant_message: msgs.filter((m): m is Message => m.role === 'assistant').pop()?.content || null,
          style: null,
          language: null,
        };
      });
    } catch {
      return [];
    }
  }

  async getConversationDetail(conversationId: string, userId?: string): Promise<ConversationDetail | null> {
    const client = getAdminClient();
    if (!client) return null;

    try {
      let convQuery = client
        .from('conversations')
        .select('id, user_id, created_at')
        .eq('id', conversationId);

      if (userId) {
        convQuery = convQuery.eq('user_id', userId);
      }

      const { data: convData } = await convQuery.single();

      if (!convData) return null;

      const { data: msgData } = await client
        .from('messages')
        .select('id, role, content, duration_ms, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return {
        id: convData.id,
        user_id: convData.user_id,
        created_at: convData.created_at,
        messages: msgData || [],
      };
    } catch {
      return null;
    }
  }

  async getLeadSummaries(userId?: string): Promise<LeadSummary[]> {
    const client = getAdminClient();
    if (!client) return [];

    try {
      let convQuery = client
        .from('conversations')
        .select('id, user_id');

      if (userId) {
        convQuery = convQuery.eq('user_id', userId);
      }

      const { data: convData } = await convQuery;

      if (!convData || convData.length === 0) return [];

      const convIds = convData.map(c => c.id);

      const { data: msgData } = await client
        .from('messages')
        .select('conversation_id, role, content')
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .order('created_at', { ascending: false });

      if (!msgData) return [];

      const convMessages = new Map<string, string[]>();
      for (const m of msgData) {
        if (!convMessages.has(m.conversation_id)) convMessages.set(m.conversation_id, []);
        convMessages.get(m.conversation_id)!.push(m.content);
      }

      const leads: LeadSummary[] = [];

      for (const [convId, messages] of convMessages.entries()) {
        const allText = messages.join(' ').toLowerCase();

        let projectType: string | null = null;
        if (/website|web app|landing/.test(allText)) projectType = 'website';
        else if (/mobile app|android|ios|react native/.test(allText)) projectType = 'app';
        else if (/ai |chatbot|voice agent|automation/.test(allText)) projectType = 'ai';

        let stage = 'new';
        if (projectType) stage = 'qualifying';
        if (/feature|need.*login|need.*payment|budget|cost|price/.test(allText)) stage = 'warm';
        if (/phone|email|contact|meeting|call/.test(allText)) stage = 'ready-to-close';

        const hasContact = /phone.*\d|email.*@|call me|reach me/.test(allText);

        leads.push({ stage, count: 1, projectType, hasContact });
      }

      return leads;
    } catch {
      return [];
    }
  }

  private detectLanguage(text: string): string {
    const lower = text.toLowerCase();
    if (/[\u0900-\u097F]/.test(text)) return 'hindi';
    if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
    if (/hai|nahi|kya|aap|mujhe|chahiye|kaise|banana/.test(lower)) return 'hinglish';
    return 'english';
  }

  private detectStyle(text: string): string {
    const lower = text.toLowerCase();
    if (/[\u0900-\u097F]/.test(text)) return 'hindi';
    if (/[\u0980-\u09FF]/.test(text)) return 'bengali';
    if (/hai|nahi|kya|aap|mujhe|chahiye|kaise|banana/.test(lower) && !/[\u0900-\u097F]/.test(text)) return 'hinglish';
    if (/react|next\.?js|api|database|aws|docker|typescript/i.test(text) && /hai|nahi|kya|chahiye/i.test(lower)) return 'mixed-tech';
    return 'english';
  }
}

export const adminRepository = new AdminRepository();
