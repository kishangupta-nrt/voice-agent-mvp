import { Customer } from './tools/customer.service';

export interface ConversationContext {
  customer: Customer | null;
  lastIntent: string | null;
  lastTopic: string | null;
  pendingQuestion: string | null;
  slotsCollected: Record<string, string>;
  turnCount: number;
  mentionedNames: string[];
  askedAbout: string[];
}

const conversationContexts = new Map<string, ConversationContext>();

const TOPIC_KEYWORDS: Record<string, string[]> = {
  order: ['order', 'delivery', 'package', 'shipped', 'arriving'],
  refund: ['refund', 'money back', 'reimburse'],
  return: ['return', 'send back', 'exchange'],
  billing: ['bill', 'charge', 'payment', 'invoice', 'price'],
  support: ['problem', 'issue', 'broken', 'not working', 'help'],
  account: ['account', 'profile', 'settings', 'update'],
  hours: ['hours', 'open', 'close', 'time'],
  callback: ['call back', 'phone', 'contact'],
};

const TOPIC_FOLLOWUPS: Record<string, string[]> = {
  order: [
    "Did you want to check the status or something else?",
    "Need help tracking that?",
    "What's the order number?",
  ],
  return: [
    "What item do you want to return?",
    "Got the receipt or order number?",
  ],
  billing: [
    "Want me to send you the pricing details?",
    "What specifically do you need to know about?",
  ],
  support: [
    "What's going on?",
    "Can you tell me what happened?",
  ],
  callback: [
    "When works best for you?",
    "What number should I call?",
  ],
};

export class ConversationManager {
  getOrCreate(conversationId: string): ConversationContext {
    let ctx = conversationContexts.get(conversationId);
    if (!ctx) {
      ctx = {
        customer: null,
        lastIntent: null,
        lastTopic: null,
        pendingQuestion: null,
        slotsCollected: {},
        turnCount: 0,
        mentionedNames: [],
        askedAbout: [],
      };
      conversationContexts.set(conversationId, ctx);
    }
    return ctx;
  }

  detectTopic(message: string): string | null {
    const lower = message.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k))) {
        return topic;
      }
    }
    return null;
  }

  getFollowUp(lastTopic: string | null): string | null {
    if (!lastTopic) return null;
    const followUps = TOPIC_FOLLOWUPS[lastTopic];
    if (!followUps || followUps.length === 0) return null;
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  updateContext(
    conversationId: string,
    intent?: string,
    topic?: string,
    slot?: { key: string; value: string },
    askedAbout?: string
  ): void {
    const ctx = this.getOrCreate(conversationId);
    ctx.turnCount++;
    
    if (intent) ctx.lastIntent = intent;
    if (topic) ctx.lastTopic = topic;
    if (slot) {
      ctx.slotsCollected[slot.key] = slot.value;
    }
    if (askedAbout && !ctx.askedAbout.includes(askedAbout)) {
      ctx.askedAbout.push(askedAbout);
    }
  }

  setCustomer(conversationId: string, customer: Customer): void {
    const ctx = this.getOrCreate(conversationId);
    ctx.customer = customer;
    if (customer.name) {
      ctx.mentionedNames.push(customer.name);
    }
  }

  getCustomer(conversationId: string): Customer | null {
    return this.getOrCreate(conversationId).customer;
  }

  clearContext(conversationId: string): void {
    conversationContexts.delete(conversationId);
  }

  formatGreeting(customerName: string | null): string {
    const greetings = [
      "Hey, thanks for calling. What's up?",
      "Hi there. How can I help?",
      "Thanks for calling. What do you need?",
      "Hey, what can I do for you?",
    ];
    
    if (customerName) {
      return `Hey ${customerName}, thanks for calling. What's going on?`;
    }
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  formatConfirmation(action: string): string {
    const confirmations = [
      `Done. ${action}`,
      `Got it. ${action}`,
      `Cool. ${action}`,
      `Alright, ${action}`,
      `No problem, ${action}`,
    ];
    return confirmations[Math.floor(Math.random() * confirmations.length)];
  }

  formatClarification(needed: string): string {
    const clarifications = [
      `Need a bit more info - ${needed}`,
      `${needed}?`,
      `What's the ${needed}?`,
      `Can I get the ${needed}?`,
    ];
    return clarifications[Math.floor(Math.random() * clarifications.length)];
  }

  formatTransition(fromIntent: string, toIntent: string): string {
    const transitions: Record<string, string[]> = {
      help: ["Cool", "Got it", "Sure thing", "Alright"],
      order: ["Looking into that", "Let me check", "Got it"],
      return: ["No problem", "Got it", "Sure"],
      ticket: ["I'll create that for you", "Let me put that in", "Got it"],
    };
    
    const prefix = transitions[fromIntent]?.[Math.floor(Math.random() * (transitions[fromIntent]?.length || 1))] || "Got it";
    return `${prefix}.`;
  }
}

export const conversationManager = new ConversationManager();