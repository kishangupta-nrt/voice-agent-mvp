import { getSupabaseClient } from './chat.repository';

export interface UserProfile {
  id: string;
  user_id: string;
  name: string | null;
  preferences: Record<string, unknown>;
  communication_style: string | null;
  last_interaction: string;
  total_conversations: number;
  satisfaction_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  category: 'preference' | 'fact' | 'goal' | 'issue' | 'personal';
  content: string;
  confidence: number;
  created_at: string;
  last_accessed: string;
  access_count: number;
  is_active: boolean;
}

export interface ConversationSummary {
  id: string;
  conversation_id: string;
  user_id: string;
  summary_text: string | null;
  key_facts: string[];
  resolved_issues: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  created_at: string;
}

export interface ExtractedMemory {
  category: string;
  content: string;
  confidence: number;
}

export interface ConversationSummaryData {
  summary: string;
  key_facts: string[];
  resolved_issues: string[];
  sentiment: string;
}

const LOG_PREFIX = 'MemoryRepository';

export class MemoryRepository {
  async getOrCreateProfile(userId: string): Promise<UserProfile | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`${LOG_PREFIX} (getOrCreateProfile):`, error);
        return null;
      }

      if (data) return data;

      const { data: newProfile, error: insertError } = await client
        .from('user_profiles')
        .insert({ user_id: userId })
        .select()
        .single();

      if (insertError) {
        console.error(`${LOG_PREFIX} (getOrCreateProfile):`, insertError);
        return null;
      }

      return newProfile;
    } catch (error) {
      console.error(`${LOG_PREFIX} (getOrCreateProfile):`, error);
      return null;
    }
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { error } = await client
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) console.error(`${LOG_PREFIX} (updateProfile):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (updateProfile):`, error);
    }
  }

  async getActiveMemories(userId: string, limit = 10): Promise<UserMemory[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('access_count', { ascending: false })
        .order('last_accessed', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`${LOG_PREFIX} (getActiveMemories):`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`${LOG_PREFIX} (getActiveMemories):`, error);
      return [];
    }
  }

  async getMemoriesByCategory(userId: string, category: string): Promise<UserMemory[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('is_active', true)
        .order('confidence', { ascending: false });

      if (error) {
        console.error(`${LOG_PREFIX} (getMemoriesByCategory):`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`${LOG_PREFIX} (getMemoriesByCategory):`, error);
      return [];
    }
  }

  async saveMemory(userId: string, memory: ExtractedMemory): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { error } = await client
        .from('user_memories')
        .insert({
          user_id: userId,
          category: memory.category,
          content: memory.content,
          confidence: memory.confidence,
        });

      if (error) console.error(`${LOG_PREFIX} (saveMemory):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (saveMemory):`, error);
    }
  }

  async saveMemories(userId: string, memories: ExtractedMemory[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || memories.length === 0) return;

    try {
      const { error } = await client
        .from('user_memories')
        .insert(
          memories.map(m => ({
            user_id: userId,
            category: m.category,
            content: m.content,
            confidence: m.confidence,
          }))
        );

      if (error) console.error(`${LOG_PREFIX} (saveMemories):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (saveMemories):`, error);
    }
  }

  async touchMemory(memoryId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data: current } = await client
        .from('user_memories')
        .select('access_count')
        .eq('id', memoryId)
        .single();

      const count = (current?.access_count || 0) + 1;

      const { error } = await client
        .from('user_memories')
        .update({
          last_accessed: new Date().toISOString(),
          access_count: count,
        })
        .eq('id', memoryId);

      if (error) console.error(`${LOG_PREFIX} (touchMemory):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (touchMemory):`, error);
    }
  }

  async saveConversationSummary(
    conversationId: string,
    userId: string,
    summary: ConversationSummaryData
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { error } = await client
        .from('conversation_summaries')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          summary_text: summary.summary,
          key_facts: summary.key_facts,
          resolved_issues: summary.resolved_issues,
          sentiment: summary.sentiment,
        });

      if (error) console.error(`${LOG_PREFIX} (saveConversationSummary):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (saveConversationSummary):`, error);
    }
  }

  async getConversationSummaries(userId: string, limit = 3): Promise<ConversationSummary[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('conversation_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`${LOG_PREFIX} (getConversationSummaries):`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`${LOG_PREFIX} (getConversationSummaries):`, error);
      return [];
    }
  }

  async incrementConversationCount(userId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { error } = await client.rpc('increment_conversation_count', {
        user_id: userId,
      });

      if (error) {
        console.error(`${LOG_PREFIX} (incrementConversationCount):`, error);
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} (incrementConversationCount):`, error);
    }
  }

  async deactivateOldMemories(userId: string, maxAgeDays = 30): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxAgeDays);

      const { error } = await client
        .from('user_memories')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
        .lt('last_accessed', cutoff.toISOString())
        .eq('access_count', 0);

      if (error) console.error(`${LOG_PREFIX} (deactivateOldMemories):`, error);
    } catch (error) {
      console.error(`${LOG_PREFIX} (deactivateOldMemories):`, error);
    }
  }
}
