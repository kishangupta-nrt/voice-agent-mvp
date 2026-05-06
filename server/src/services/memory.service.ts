import axios from 'axios';
import { ENV } from '../config/env';
import { MemoryRepository, ExtractedMemory, ConversationSummaryData } from '../repositories/memory.repository';

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze the conversation below and extract important facts about the user that should be remembered for future conversations.

Extract only truly useful information:
- Personal details (name, preferences, communication style)
- Recurring issues or concerns
- Goals or intentions
- Facts about the user's situation

Rules:
- Only extract facts that are clearly stated or strongly implied
- Keep each memory concise (1 sentence max)
- Assign confidence based on how clearly it was stated (0.5 to 1.0)
- Skip temporary or situational information
- Skip generic conversation pleasantries

Return ONLY a JSON array like:
[{"category": "preference|fact|goal|issue|personal", "content": "memory text", "confidence": 0.8}]

If nothing worth remembering, return [].`;

const SUMMARIZATION_PROMPT = `Summarize this customer service conversation.

Extract:
1. A brief summary (1-2 sentences)
2. Key facts about the user
3. Any resolved issues
4. Overall sentiment (positive, neutral, or negative)

Return ONLY JSON like:
{"summary": "...", "key_facts": ["fact1", "fact2"], "resolved_issues": ["issue1"], "sentiment": "positive|neutral|negative"}`;

export class MemoryService {
  private repository = new MemoryRepository();

  async extractAndSaveMemories(userId: string, conversationText: string): Promise<void> {
    try {
      const memories = await this.extractMemories(conversationText);
      if (memories.length > 0) {
        await this.repository.saveMemories(userId, memories);
        console.log(`[Memory] Saved ${memories.length} memories`);
      }
    } catch (error) {
      console.error('[Memory] Failed to extract memories:', error);
    }
  }

  async summarizeAndSave(conversationId: string, userId: string, conversationText: string): Promise<void> {
    try {
      const summary = await this.generateSummary(conversationText);
      await this.repository.saveConversationSummary(conversationId, userId, summary);
      console.log(`[Memory] Saved conversation summary`);
    } catch (error) {
      console.error('[Memory] Failed to save summary:', error);
    }
  }

  async getContextForPrompt(userId: string): Promise<string> {
    const profile = await this.repository.getOrCreateProfile(userId);
    const memories = await this.repository.getActiveMemories(userId, 5);
    const recentSummaries = await this.repository.getConversationSummaries(userId, 2);

    let context = '';

    if (profile?.name) {
      context += `User's name: ${profile.name}\n`;
    }

    if (profile?.communication_style) {
      context += `Communication style: ${profile.communication_style}\n`;
    }

    if (memories.length > 0) {
      const formatted = memories.map(m => `- ${m.content}`).join('\n');
      context += `Things to remember about this user:\n${formatted}\n`;
    }

    if (recentSummaries.length > 0) {
      const summaries = recentSummaries
        .map(s => s.summary_text)
        .filter(Boolean)
        .join('\n');
      if (summaries) {
        context += `Recent conversation summaries:\n${summaries}\n`;
      }
    }

    if (!context) return '';

    return `\n--- User Context ---\n${context.trim()}\n--- End Context ---\n`;
  }

  async updateCommunicationStyle(userId: string, message: string): Promise<void> {
    const style = this.detectCommunicationStyle(message);
    if (style) {
      await this.repository.updateProfile(userId, { communication_style: style });
    }
  }

  async processEndOfConversation(
    conversationId: string,
    userId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<void> {
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const results = await Promise.allSettled([
      this.extractAndSaveMemories(userId, conversationText),
      this.summarizeAndSave(conversationId, userId, conversationText),
      this.repository.incrementConversationCount(userId),
      this.repository.deactivateOldMemories(userId),
    ]);

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[Memory] Task ${i} failed:`, result.reason);
      }
    });
  }

  private async extractMemories(conversationText: string): Promise<ExtractedMemory[]> {
    if (!ENV.MISTRAL_API_KEY) return [];

    try {
      const res = await axios.post(
        ENV.MISTRAL_API_URL,
        {
          model: ENV.MISTRAL_MODEL || 'mistral-small-latest',
          messages: [
            { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
            { role: 'user', content: `Conversation:\n${conversationText}` },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ENV.MISTRAL_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const content = res.data.choices[0]?.message?.content || '[]';
      const parsed = JSON.parse(this.extractJson(content));

      return Array.isArray(parsed)
        ? parsed.filter((m: { category: string; content: string; confidence: number }) => m.category && m.content && m.confidence)
        : [];
    } catch (error) {
      console.error('[Memory] LLM extraction failed:', error);
      return [];
    }
  }

  private async generateSummary(conversationText: string): Promise<ConversationSummaryData> {
    const defaultSummary: ConversationSummaryData = {
      summary: '',
      key_facts: [],
      resolved_issues: [],
      sentiment: 'neutral',
    };

    if (!ENV.MISTRAL_API_KEY) return defaultSummary;

    try {
      const res = await axios.post(
        ENV.MISTRAL_API_URL,
        {
          model: ENV.MISTRAL_MODEL || 'mistral-small-latest',
          messages: [
            { role: 'system', content: SUMMARIZATION_PROMPT },
            { role: 'user', content: `Conversation:\n${conversationText}` },
          ],
          max_tokens: 500,
          temperature: 0.3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ENV.MISTRAL_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const content = res.data.choices[0]?.message?.content || '{}';
      return JSON.parse(this.extractJson(content));
    } catch (error) {
      console.error('[Memory] Summary generation failed:', error);
      return defaultSummary;
    }
  }

  private extractJson(text: string): string {
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    return match ? match[0] : text;
  }

  private detectCommunicationStyle(message: string): string | null {
    const lower = message.toLowerCase();
    if (lower.includes('please') || lower.includes('thank you') || lower.includes('thanks')) {
      return 'polite';
    }
    if (message.length < 20 && !message.includes('please')) {
      return 'brief';
    }
    if (message.length > 100) {
      return 'detailed';
    }
    return null;
  }
}

export const memoryService = new MemoryService();
