import { LlmService } from './llm.service';
import { ChatRepository, Message } from '../repositories/chat.repository';
import { ToolExecutor, ExecutionResult } from './tools/executor';
import type { Customer } from './tools/customer.service';
import { Intent, detectIntent } from '../knowledge/intents';
import { conversationManager, ConversationContext } from './conversation-manager';
import { ragService } from './knowledge/rag.service';
import { memoryService } from './memory.service';
import { detectConversationStyle, ConversationStyle } from './conversation-style';
import { knowledgeService } from './knowledge/knowledge.service';
import { leadTracker, LeadState } from './lead-tracker';
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
  usedRag?: boolean;
  style?: ConversationStyle;
  language?: string;
}

interface ConversationState {
  customer: Customer | null;
  currentIntent: Intent | null;
  collectedSlots: Record<string, string>;
  context: ConversationContext;
  ragUsedThisTurn: boolean;
}

const STATE_TTL_MS = 30 * 60 * 1000;
const STATE_MAX_SIZE = 500;
const STATE_EVICTION_INTERVAL_MS = 5 * 60 * 1000;
let lastStateEviction = 0;

interface TimedState {
  state: ConversationState;
  lastAccessed: number;
}

const timedStates = new Map<string, TimedState>();

function evictExpiredStates(): void {
  const now = Date.now();
  for (const [key, timed] of timedStates.entries()) {
    if (now - timed.lastAccessed > STATE_TTL_MS) {
      timedStates.delete(key);
      conversationManager.clearContext(key);
    }
  }
}

function enforceStateMaxSize(): void {
  if (timedStates.size > STATE_MAX_SIZE) {
    const sorted = Array.from(timedStates.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    const toRemove = timedStates.size - STATE_MAX_SIZE;
    for (let i = 0; i < toRemove; i++) {
      const key = sorted[i][0];
      timedStates.delete(key);
      conversationManager.clearContext(key);
    }
  }
}

function getOrCreateState(conversationId: string): ConversationState {
  const now = Date.now();

  if (now - lastStateEviction > STATE_EVICTION_INTERVAL_MS) {
    evictExpiredStates();
    enforceStateMaxSize();
    lastStateEviction = now;
  }

  let timed = timedStates.get(conversationId);
  if (!timed) {
    const state: ConversationState = {
      customer: null,
      currentIntent: null,
      collectedSlots: {},
      context: conversationManager.getOrCreate(conversationId),
      ragUsedThisTurn: false,
    };
    timedStates.set(conversationId, { state, lastAccessed: now });
    return state;
  }

  timed.lastAccessed = now;
  timed.state.context = conversationManager.getOrCreate(conversationId);
  return timed.state;
}

function clearConversationState(conversationId: string): void {
  timedStates.delete(conversationId);
  conversationManager.clearContext(conversationId);
  leadTracker.clear(conversationId);
}

function toHistoryMessages(messages: Message[]): { role: string; content: string }[] {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

interface LlmPromptLayers {
  memoryContext?: string;
  leadContext?: string;
  knowledgeContext?: string;
  style?: string;
  conversationState?: string;
}

export class ChatService {
  private llmService = new LlmService();
  private chatRepository = new ChatRepository();
  private toolExecutor = new ToolExecutor();

  constructor() {
    knowledgeService.loadDocuments();
  }

  private formatResponse(response: string, state: ConversationState, style: ConversationStyle): string {
    let formatted = response;

    if (style === 'english') {
      formatted = addCasualPrefix(formatted);
    }

    formatted = personalizeForCustomer(
      state.context.customer?.name || null,
      formatted
    );

    if (Math.random() < 0.15 && !state.ragUsedThisTurn) {
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

  private async tryRagQuery(query: string, style: ConversationStyle, history: { role: string; content: string }[]): Promise<string | null> {
    try {
      const results = await ragService.search(query, 2);

      if (results.length === 0 || results[0].score < 0.5) {
        return null;
      }

      const context = ragService.getContext(results);
      const prompt = ragService.getAnswerWithContext(query, results);

      const answer = await this.llmService.generateResponse(prompt, history, { style });

      return answer;
    } catch (error) {
      return null;
    }
  }

  private async saveAssistantMessage(
    convId: string,
    response: string,
    userId: string,
    startTime: number
  ): Promise<boolean> {
    const durationMs = Date.now() - startTime;
    return this.chatRepository.saveMessage(convId, 'assistant', response, userId, durationMs);
  }

  async processMessage(
    message: string,
    userId: string,
    conversationId?: string,
    language?: string
  ): Promise<ChatResult> {
    const startTime = Date.now();
    const styleResult = detectConversationStyle(message);
    const style = styleResult.style;
    const languageCode = language || styleResult.language;

    let convId = conversationId || (await this.chatRepository.createConversation(userId));

    if (!convId) {
      throw new Error('Failed to create conversation');
    }

    const state = getOrCreateState(convId);
    state.ragUsedThisTurn = false;

    const history = await this.chatRepository.getConversationHistory(convId, 20);
    const historyMessages = toHistoryMessages(history);

    const memoryContext = await memoryService.getContextForPrompt(userId);

    const userMsgSaved = await this.chatRepository.saveMessage(convId, 'user', message, userId);
    if (!userMsgSaved) {
      console.warn(`[ChatService] Failed to persist user message for conversation ${convId}`);
    }

    await memoryService.updateCommunicationStyle(userId, message);

    const intent = detectIntent(message);
    if (intent) {
      state.currentIntent = intent;
    }

    leadTracker.update(convId, message, intent?.id);
    if (style !== 'english') {
      leadTracker.setLanguage(convId, languageCode);
    }

    const leadState = leadTracker.getState(convId);
    const leadContext = leadState ? leadTracker.formatForPrompt(leadState) : undefined;

    const knowledgeContext = intent
      ? knowledgeService.getKnowledgeForIntent(intent.id)
      : '';

    const turnCount = state.context.turnCount;
    const conversationState = turnCount > 0
      ? `CONVERSATION STATE: This is turn #${turnCount}. Last topic discussed: ${state.context.lastTopic || 'none'}. You are already in an ongoing conversation. Do NOT reintroduce yourself. Respond naturally as a continuation.`
      : undefined;

    const intentResult = await this.processWithKnownIntent(
      message,
      state,
      historyMessages,
      memoryContext,
      style,
      leadContext,
      knowledgeContext,
      conversationState,
      languageCode,
      intent
    );

    let response = intentResult.response;
    let usedRag = false;

    if (response) {
      response = this.formatResponse(response, state, style);

      const topic = conversationManager.detectTopic(message);
      if (topic) {
        conversationManager.updateContext(convId, intent?.id || undefined, topic);
      }
    } else {
      const ragAnswer = await this.tryRagQuery(message, style, historyMessages);

      if (ragAnswer) {
        response = this.formatResponse(ragAnswer, state, style);
        usedRag = true;
        state.ragUsedThisTurn = true;
      } else {
        const llmAnswer = await this.llmService.generateResponse(message, historyMessages, {
          memoryContext,
          leadContext,
          knowledgeContext: knowledgeContext || undefined,
          style,
          conversationState,
          language: languageCode,
        });
        if (llmAnswer) {
          response = this.formatResponse(llmAnswer, state, style);
        }
      }
    }

    const requiresAuth = intentResult.requiresAuth;

    if (response) {
      const msgSaved = await this.saveAssistantMessage(convId, response, userId, startTime);
      if (!msgSaved) {
        console.warn(`[ChatService] Failed to persist assistant message for conversation ${convId}`);
      }

      if (intentResult.customer) {
        state.customer = intentResult.customer;
        state.context.customer = intentResult.customer;
      }

      return { response, conversationId: convId, requiresAuth: requiresAuth, usedRag, style, language: languageCode };
    }

    throw new Error('Failed to generate response');
  }

  private async processWithKnownIntent(
    message: string,
    state: ConversationState,
    history: { role: string; content: string }[],
    memoryContext?: string,
    style?: ConversationStyle,
    leadContext?: string,
    knowledgeContext?: string,
    conversationState?: string,
    language?: string,
    intent?: Intent | null
  ): Promise<ExecutionResult> {
    if (!intent) intent = detectIntent(message);

    if (!intent) {
      try {
        const response = await this.llmService.generateResponse(message, history, {
          memoryContext,
          leadContext,
          knowledgeContext,
          style,
          conversationState,
          language,
        });
        return {
          response,
          intent: null,
          customer: state.customer || undefined,
          requiresAuth: false,
          requiresSlots: [],
          slotValues: {},
        };
      } catch (error) {
        return {
          response: '',
          intent: null,
          customer: state.customer || undefined,
          requiresAuth: false,
          requiresSlots: [],
          slotValues: {},
        };
      }
    }

    if (intent.id === 'greeting' && state.context.turnCount > 0) {
      try {
        const response = await this.llmService.generateResponse(message, history, {
          memoryContext,
          leadContext,
          knowledgeContext,
          style,
          conversationState,
          language,
        });
        return {
          response,
          intent,
          customer: state.customer || undefined,
          requiresAuth: false,
          requiresSlots: [],
          slotValues: {},
        };
      } catch (error) {
        return {
          response: '',
          intent: null,
          customer: state.customer || undefined,
          requiresAuth: false,
          requiresSlots: [],
          slotValues: {},
        };
      }
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
      const result = await this.toolExecutor.executeWithIntent(
        message,
        intent,
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

    if (customer.phone) {
      leadTracker.update(conversationId, `phone: ${customer.phone}`);
    }

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

  async endConversation(conversationId: string, userId: string): Promise<void> {
    const history = await this.chatRepository.getConversationHistory(conversationId, 50);
    const messages = toHistoryMessages(history);

    if (messages.length < 2) {
      clearConversationState(conversationId);
      return;
    }

    await memoryService.processEndOfConversation(conversationId, userId, messages);

    clearConversationState(conversationId);
  }

  getLeadState(conversationId: string): LeadState | null {
    return leadTracker.getState(conversationId);
  }
}
