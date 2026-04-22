import { LlmService } from './llm.service';
import { ChatRepository, Message } from '../repositories/chat.repository';
import { ToolExecutor, ExecutionResult } from './tools/executor';
import { Customer } from './tools/customer.service';
import { Intent, detectIntent } from '../knowledge/intents';
import { conversationManager, ConversationContext } from './conversation-manager';
import { 
  CASUAL_RESPONSES, 
  addCasualPrefix, 
  varyResponse,
  personalizeForCustomer 
} from '../knowledge/response-modifiers';

export interface ChatResult {
  response: string;
  conversationId: string | null;
  requiresAuth?: boolean;
}

interface ConversationState {
  customer: Customer | null;
  currentIntent: Intent | null;
  collectedSlots: Record<string, string>;
  context: ConversationContext;
}

const conversationStates = new Map<string, ConversationState>();

function getOrCreateState(conversationId: string): ConversationState {
  let state = conversationStates.get(conversationId);
  if (!state) {
    state = { 
      customer: null, 
      currentIntent: null, 
      collectedSlots: {},
      context: conversationManager.getOrCreate(conversationId)
    };
    conversationStates.set(conversationId, state);
  }
  return state;
}

function clearConversationState(conversationId: string): void {
  conversationStates.delete(conversationId);
  conversationManager.clearContext(conversationId);
}

export class ChatService {
  private llmService = new LlmService();
  private chatRepository = new ChatRepository();
  private toolExecutor = new ToolExecutor();

  private formatResponse(response: string, state: ConversationState): string {
    let formatted = response;
    
    formatted = addCasualPrefix(formatted);
    
    formatted = personalizeForCustomer(
      state.context.customer?.name || null,
      formatted
    );
    
    if (Math.random() < 0.15) {
      const followUp = conversationManager.getFollowUp(state.context.lastTopic);
      if (followUp) {
        formatted = formatted.trim() + " " + followUp;
      }
    }
    
    return formatted;
  }

  private getCasualResponse(key: keyof typeof CASUAL_RESPONSES): string {
    return varyResponse(CASUAL_RESPONSES[key]);
  }

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

    const state = getOrCreateState(convId);
    const history = await this.chatRepository.getConversationHistory(convId, 5);
    const historyMessages: { role: string; content: string }[] = history.map((m: Message) => ({
      role: m.role,
      content: m.content,
    }));

    await this.chatRepository.saveMessage(convId, 'user', message, userId);

    const intentResult = await this.processWithKnowledge(
      message,
      state,
      historyMessages
    );

    let response = intentResult.response;
    
    if (response) {
      response = this.formatResponse(response, state);
      
      const topic = conversationManager.detectTopic(message);
      if (topic) {
        conversationManager.updateContext(convId, intentResult.intent?.id || undefined, topic);
      }
    } else {
      if (state.context.turnCount > 0) {
        response = this.getCasualResponse('clarification');
      }
    }

    const requiresAuth = intentResult.requiresAuth;

    if (response) {
      const durationMs = Date.now() - startTime;
      await this.chatRepository.saveMessage(convId, 'assistant', response, userId, durationMs);
      
      if (intentResult.customer) {
        state.customer = intentResult.customer;
        state.context.customer = intentResult.customer;
      }

      return { response, conversationId: convId, requiresAuth: requiresAuth };
    }

    const llmResponse = await this.llmService.generateResponse(message, historyMessages);
    const durationMs = Date.now() - startTime;
    await this.chatRepository.saveMessage(convId, 'assistant', llmResponse, userId, durationMs);

    return { response: llmResponse, conversationId: convId, requiresAuth: false };
  }

  private async processWithKnowledge(
    message: string,
    state: ConversationState,
    history: { role: string; content: string }[]
  ): Promise<ExecutionResult> {
    const intent = detectIntent(message);

    if (!intent) {
      if (state.context.turnCount === 0) {
        return {
          response: this.getCasualResponse('greeting'),
          intent: null,
          customer: state.customer || undefined,
          requiresAuth: false,
          requiresSlots: [],
          slotValues: {},
        };
      }
      
      return {
        response: '',
        intent: null,
        customer: state.customer || undefined,
        requiresAuth: false,
        requiresSlots: [],
        slotValues: {},
      };
    }

    if (intent.requiresAuth && !state.customer) {
      return {
        response: intent.response,
        intent,
        customer: undefined,
        requiresAuth: true,
        requiresSlots: intent.slots || [],
        slotValues: {},
      };
    }

    if (intent.tool) {
      const result = await this.toolExecutor.executeIntent(
        message,
        state.collectedSlots,
        state.customer || undefined
      );
      
      if (result.customer) {
        state.customer = result.customer;
      }

      return result;
    }

    return {
      response: intent.response,
      intent,
      customer: state.customer ?? undefined,
      requiresAuth: false,
      requiresSlots: [],
      slotValues: {},
    };
  }

  async verifyCustomer(conversationId: string, phone: string): Promise<{ success: boolean; message: string; customer?: Customer }> {
    const { CustomerService } = await import('./tools/customer.service');
    const customerService = new CustomerService();
    const state = getOrCreateState(conversationId);

    const customer = await customerService.findByPhone(phone);
    
    if (!customer) {
      const responses = [
        "Don't have that one. Want me to set you up?",
        "That's not in our system. New account?",
        "Haven't seen that number. Create one?",
      ];
      return { 
        success: false, 
        message: varyResponse(responses)
      };
    }

    state.customer = customer;
    conversationManager.setCustomer(conversationId, customer);
    
    const greetings = [
      `Hey ${customer.name || 'there'}! What do you need?`,
      `Gotcha ${customer.name || 'there'}. What's up?`,
      `Hey ${customer.name || 'there'}! How can I help?`,
    ];
    
    return { 
      success: true, 
      message: varyResponse(greetings),
      customer 
    };
  }

  setCustomer(conversationId: string, customer: Customer): void {
    const state = getOrCreateState(conversationId);
    state.customer = customer;
    conversationManager.setCustomer(conversationId, customer);
  }

  clearState(conversationId: string): void {
    clearConversationState(conversationId);
  }

  async getConversations(userId: string, limit = 10) {
    return this.chatRepository.getRecentConversations(userId, limit);
  }

  async healthCheck() {
    return this.chatRepository.healthCheck();
  }
}