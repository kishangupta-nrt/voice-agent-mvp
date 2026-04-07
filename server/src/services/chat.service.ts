import { LlmService } from './llm.service';
import { ChatRepository, Message } from '../repositories/chat.repository';

export interface ChatResult {
  response: string;
  conversationId: string | null;
}

export class ChatService {
  private llmService = new LlmService();
  private chatRepository = new ChatRepository();

  async processMessage(
    message: string,
    userId: string,
    conversationId?: string
  ): Promise<ChatResult> {
    const startTime = Date.now();

    let convId = conversationId || (await this.chatRepository.createConversation(userId));

    if (!convId) {
      throw new Error('Failed to create conversation');
    }

    const history = await this.chatRepository.getConversationHistory(convId, 5);
    const historyMessages: { role: string; content: string }[] = history.map((m: Message) => ({
      role: m.role,
      content: m.content,
    }));

    await this.chatRepository.saveMessage(convId, 'user', message, userId);

    const response = await this.llmService.generateResponse(message, historyMessages);

    const durationMs = Date.now() - startTime;

    await this.chatRepository.saveMessage(convId, 'assistant', response, userId, durationMs);

    return { response, conversationId: convId };
  }

  async getConversations(userId: string, limit = 10) {
    return this.chatRepository.getRecentConversations(userId, limit);
  }

  async healthCheck() {
    return this.chatRepository.healthCheck();
  }
}
